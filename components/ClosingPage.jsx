'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, CalendarCheck2, CheckCircle2, Circle, Loader2, MessageSquare, Plus, Settings2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { nexusApi } from '@/lib/nexus-api'
import { entityUrl, TASKS_CHANGED_EVENT } from '@/lib/links'
import { completeWithCheck } from '@/lib/completion-gate'
import { requestChatFlush } from '@/lib/chat-client'
import { businessDaysBetween, buildClosingTasks, closingProgress, defaultRunStart, isValidPeriod } from '@/lib/closing-utils.mjs'
import { seoulDate } from '@/lib/weekly-utils.mjs'

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
const label = 'mb-1 block text-xs font-bold text-slate-500'
const emptyTemplate = { id: null, name: '', description: '', active: true, auto_start: false, items: [] }
const emptyItem = () => ({ key: crypto.randomUUID(), id: null, title: '', offset_days: 0, default_assignee_member_id: '', reference_url: '', description: '' })

export default function ClosingPage() {
  const [data, setData] = useState(null)
  const [runId, setRunId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminTab, setAdminTab] = useState(null)

  const load = useCallback(async (id = runId) => {
    setLoading(true); setError('')
    try {
      const result = await nexusApi(`/api/closing${id ? `?run=${id}` : ''}`)
      setData(result)
      setRunId(result.run?.id || null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => { load(null) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const reload = () => load()
    window.addEventListener(TASKS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, reload)
  }, [load])

  if (loading && !data) return <p className="p-6 text-sm text-slate-500">월마감을 불러오는 중…</p>
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>

  const templateName = id => data.templates.find(t => t.id === id)?.name || '월마감'
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">Monthly Closing</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">월마감</h1>
          <p className="mt-1 text-sm text-slate-500">매달 반복되는 마감 업무를 템플릿에서 자동으로 만들고, 체크만 하면 됩니다.</p>
        </div>
        {data.runs.length > 0 && (
          <select value={runId || ''} onChange={e => load(Number(e.target.value))} className={`${input} w-auto`} aria-label="월마감 선택">
            {data.runs.map(r => <option key={r.id} value={r.id}>{r.period} · {templateName(r.template_id)}{r.status === 'open' ? ' (진행 중)' : ' (완료)'}</option>)}
          </select>
        )}
      </div>

      {data.run ? <RunView data={data} templateName={templateName(data.run.template_id)} onChanged={() => load()} />
        : <div className="card-base p-10 text-center text-sm text-slate-500">
            <CalendarCheck2 className="mx-auto mb-3 text-slate-300" size={32} />
            {data.isAdmin ? '아직 시작한 월마감이 없습니다. 아래에서 템플릿을 만들고 월마감을 시작하세요.' : '관리자가 월마감을 시작하면 이곳에 내 마감 항목이 표시됩니다.'}
          </div>}

      {data.isAdmin && <AdminPanel data={data} tab={adminTab} setTab={setAdminTab} onSaved={id => load(id)} />}
    </div>
  )
}

function RunView({ data, templateName, onChanged }) {
  const { run, runTasks, previousRun, previousTasks, holidays, today, memberId, isAdmin } = data
  const [busyId, setBusyId] = useState(null)
  const progress = closingProgress(runTasks, today)
  const previousByItem = new Map(previousTasks.map(t => [t.closing_item_id, t]))

  const toggle = async task => {
    setBusyId(task.id)
    try {
      // 완료는 AI 친구 점검 창을 거친다. 되돌리기(대기)는 바로 저장
      if (task.status === '완료') {
        const { error } = await supabase.from('tasks').update({ status: '대기' }).eq('id', task.id)
        if (error) throw error
      } else await completeWithCheck(task.id)
      requestChatFlush()
      onChanged()
    } catch (e) { e.cancelled ? toast(e.message) : toast.error(e.message) }
    finally { setBusyId(null) }
  }
  const setRunStatus = async action => {
    try { await nexusApi('/api/closing', { action, run_id: run.id }); toast.success(action === 'close_run' ? '마감 완료로 표시했습니다.' : '다시 열었습니다.'); onChanged() }
    catch (e) { toast.error(e.message) }
  }

  return (
    <>
      <div className="card-base p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-slate-400">{templateName} · 시작 {run.start_date}</p>
            <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{run.period} 마감 {run.status === 'closed' && <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600 dark:bg-emerald-950/40">완료</span>}</h2>
          </div>
          <div className="flex gap-6 text-center">
            <Stat label="진행률" value={`${progress.rate}%`} />
            <Stat label="완료" value={`${progress.done}/${progress.total}`} />
            <Stat label="지연" value={progress.overdue} danger={progress.overdue > 0} />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress.rate}%` }} /></div>
        {isAdmin && (
          <div className="mt-4 flex justify-end">
            {run.status === 'open'
              ? <button onClick={() => setRunStatus('close_run')} className="btn-secondary text-xs">마감 완료로 표시</button>
              : <button onClick={() => setRunStatus('reopen_run')} className="btn-secondary text-xs">다시 열기</button>}
          </div>
        )}
      </div>

      <div className="card-base overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60">
            <tr><th className="w-12 p-3" /><th className="p-3">항목</th><th className="p-3">담당</th><th className="p-3">마감</th><th className="p-3">{previousRun ? `지난달(${previousRun.period})` : '지난달'}</th></tr>
          </thead>
          <tbody>
            {runTasks.map(task => {
              const done = task.status === '완료'
              const late = !done && task.due_date && task.due_date < today
              const previous = previousByItem.get(task.closing_item_id)
              const previousDay = previous?.completed_at && previousRun ? businessDaysBetween(previousRun.start_date, seoulDate(previous.completed_at), holidays) : null
              return (
                <tr key={task.id} className={`border-t border-slate-100 dark:border-slate-700 ${task.assignee_member_id === memberId ? 'bg-indigo-50/40 dark:bg-indigo-950/10' : ''}`}>
                  <td className="p-3">
                    <button onClick={() => toggle(task)} disabled={busyId === task.id} aria-label={done ? '완료 취소' : '완료로 표시'} className="text-slate-400 hover:text-indigo-600">
                      {busyId === task.id ? <Loader2 size={20} className="animate-spin" /> : done ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} />}
                    </button>
                  </td>
                  <td className="p-3"><Link href={entityUrl('task', task.id)} className={`font-semibold hover:text-indigo-600 ${done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{task.title.replace(/^\[\d{4}-\d{2} 마감\]\s*/, '')}</Link></td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{task.assignee || <span className="text-slate-300">미정</span>}</td>
                  <td className={`p-3 ${late ? 'font-bold text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>{task.due_date} <span className="text-xs text-slate-400">D+{businessDaysBetween(run.start_date, task.due_date, holidays)}</span>{late && ' · 지연'}</td>
                  <td className="p-3 text-xs text-slate-500">{previous ? (previousDay !== null ? `${previousDay}영업일째 완료` : '미완료') : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {runTasks.length === 0 && <p className="p-8 text-center text-sm text-slate-400">항목이 없습니다.</p>}
      </div>
    </>
  )
}

function Stat({ label: text, value, danger }) {
  return <div><strong className={`block text-xl font-black ${danger ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{value}</strong><span className="text-xs text-slate-400">{text}</span></div>
}

function AdminPanel({ data, tab, setTab, onSaved }) {
  const tabs = [['start', '새 월마감 시작'], ['template', '템플릿 관리'], ['holidays', '공휴일'], ['chat', 'Google Chat 알림']]
  return (
    <section className="card-base p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Settings2 size={18} className="text-slate-400" /><h2 className="mr-2 font-bold text-slate-900 dark:text-white">관리자 설정</h2>
        {tabs.map(([id, name]) => <button key={id} onClick={() => setTab(tab === id ? null : id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{name}</button>)}
      </div>
      {tab === 'start' && <StartRun data={data} onSaved={onSaved} />}
      {tab === 'template' && <TemplateEditor data={data} onSaved={onSaved} />}
      {tab === 'holidays' && <HolidayEditor data={data} onSaved={onSaved} />}
      {tab === 'chat' && <ChatSettings data={data} onSaved={onSaved} />}
      {!tab && <p className="text-sm text-slate-400">템플릿을 만든 뒤 월마감을 시작하세요. 자동 시작을 켜면 매월 첫 영업일 아침에 지난달 마감이 만들어집니다.</p>}
    </section>
  )
}

function StartRun({ data, onSaved }) {
  const active = data.templates.filter(t => t.active)
  const [templateId, setTemplateId] = useState(active[0]?.id || '')
  const [period, setPeriod] = useState(data.defaults.period)
  const [startDate, setStartDate] = useState(data.defaults.startDate)
  const [busy, setBusy] = useState(false)
  const items = data.items.filter(i => i.template_id === Number(templateId))
  const preview = useMemo(() => (isValidPeriod(period) && startDate ? buildClosingTasks(items, { period, startDate, holidays: data.holidays, members: data.members }) : []), [items, period, startDate, data.holidays, data.members])
  const exists = data.runs.some(r => r.template_id === Number(templateId) && r.period === period)

  const start = async () => {
    setBusy(true)
    try {
      const result = await nexusApi('/api/closing', { action: 'start_run', template_id: Number(templateId), period, start_date: startDate })
      toast.success(`${period} 월마감 업무 ${result.taskCount}건을 만들고 담당자에게 알렸습니다.`)
      onSaved(result.run.id)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (!active.length) return <p className="text-sm text-slate-500">사용 중인 템플릿이 없습니다. '템플릿 관리'에서 먼저 만드세요.</p>
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className={label}>템플릿</span><select value={templateId} onChange={e => setTemplateId(e.target.value)} className={input}>{active.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label><span className={label}>마감 대상월</span><input type="month" value={period} onChange={e => { setPeriod(e.target.value); if (isValidPeriod(e.target.value)) setStartDate(defaultRunStart(e.target.value, data.holidays)) }} className={input} /></label>
        <label><span className={label}>마감 시작일 (D+0)</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={input} /></label>
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/50">
        <p className="mb-2 text-xs font-bold text-slate-500">만들어질 업무 미리보기 ({preview.length}건)</p>
        {preview.map(t => <div key={t.item_id} className="flex justify-between gap-3 border-t border-slate-100 py-1.5 first:border-0 dark:border-slate-800"><span className="text-slate-700 dark:text-slate-200">{t.title}</span><span className="shrink-0 text-slate-500">{t.assignee || '담당 미정'} · {t.due_date}</span></div>)}
        {!preview.length && <p className="text-slate-400">템플릿에 항목이 없습니다.</p>}
      </div>
      {exists && <p className="text-sm font-semibold text-rose-600">이 템플릿으로 {period} 월마감을 이미 시작했습니다.</p>}
      <button onClick={start} disabled={busy || exists || !preview.length} className="btn-primary disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}월마감 시작 · 업무 {preview.length}건 만들기</button>
    </div>
  )
}

function TemplateEditor({ data, onSaved }) {
  const toForm = template => (template
    ? { ...template, items: data.items.filter(i => i.template_id === template.id).map(i => ({ ...i, key: `i${i.id}`, default_assignee_member_id: i.default_assignee_member_id || '', reference_url: i.reference_url || '' })) }
    : { ...emptyTemplate, items: [emptyItem()] })
  const [form, setForm] = useState(() => toForm(data.templates[0]))
  const [busy, setBusy] = useState(false)
  const setItem = (key, patch) => setForm(f => ({ ...f, items: f.items.map(i => (i.key === key ? { ...i, ...patch } : i)) }))
  const move = (index, delta) => setForm(f => {
    const items = [...f.items]; const target = index + delta
    if (target < 0 || target >= items.length) return f
    ;[items[index], items[target]] = [items[target], items[index]]
    return { ...f, items }
  })

  const save = async () => {
    setBusy(true)
    try {
      const result = await nexusApi('/api/closing', {
        action: 'save_template', id: form.id, name: form.name, description: form.description, active: form.active, auto_start: form.auto_start,
        items: form.items.map(i => ({ id: i.id, title: i.title, offset_days: Number(i.offset_days), default_assignee_member_id: i.default_assignee_member_id ? Number(i.default_assignee_member_id) : null, reference_url: i.reference_url, description: i.description })),
      })
      toast.success('템플릿을 저장했습니다.')
      setForm(f => ({ ...f, id: result.templateId }))
      onSaved()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {data.templates.map(t => <button key={t.id} onClick={() => setForm(toForm(t))} className={`rounded-lg border px-3 py-1.5 text-sm ${form.id === t.id ? 'border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>{t.name}{!t.active && ' (중단)'}</button>)}
        <button onClick={() => setForm(toForm(null))} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500"><Plus size={14} />새 템플릿</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>템플릿 이름</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} placeholder="예: 월 결산" /></label>
        <label><span className={label}>설명</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={input} placeholder="선택" /></label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-slate-600 dark:text-slate-300">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />사용 중</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.auto_start} onChange={e => setForm({ ...form, auto_start: e.target.checked })} />매월 첫 영업일 아침에 지난달 마감 자동 시작</label>
      </div>
      <div className="space-y-2">
        <p className={label}>항목 — 마감일은 시작일(D+0)로부터 영업일 기준</p>
        {form.items.map((item, index) => (
          <div key={item.key} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-[1fr_90px_140px_1fr_auto]">
            <input value={item.title} onChange={e => setItem(item.key, { title: e.target.value })} className={input} placeholder="항목 이름 (예: 재고 수불 마감)" aria-label="항목 이름" />
            <label className="flex items-center gap-1 text-xs text-slate-500">D+<input type="number" min={0} max={30} value={item.offset_days} onChange={e => setItem(item.key, { offset_days: e.target.value })} className={input} aria-label="영업일" /></label>
            <select value={item.default_assignee_member_id} onChange={e => setItem(item.key, { default_assignee_member_id: e.target.value })} className={input} aria-label="기본 담당자"><option value="">담당 미정</option>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <input value={item.reference_url} onChange={e => setItem(item.key, { reference_url: e.target.value })} className={input} placeholder="참고 링크 (지난달 산출물 등)" aria-label="참고 링크" />
            <div className="flex items-center gap-1">
              <button onClick={() => move(index, -1)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="위로"><ArrowUp size={15} /></button>
              <button onClick={() => move(index, 1)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="아래로"><ArrowDown size={15} /></button>
              <button onClick={() => setForm(f => ({ ...f, items: f.items.filter(i => i.key !== item.key) }))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="항목 삭제"><Trash2 size={15} /></button>
            </div>
            <input value={item.description} onChange={e => setItem(item.key, { description: e.target.value })} className={`${input} md:col-span-5`} placeholder="설명·확인 방법 (선택)" aria-label="항목 설명" />
          </div>
        ))}
        <button onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }))} className="btn-secondary text-sm"><Plus size={15} />항목 추가</button>
      </div>
      <button onClick={save} disabled={busy} className="btn-primary">{busy && <Loader2 size={15} className="animate-spin" />}템플릿 저장</button>
    </div>
  )
}

function HolidayEditor({ data, onSaved }) {
  const [text, setText] = useState(data.holidays.join('\n'))
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      const result = await nexusApi('/api/closing', { action: 'save_holidays', holidays: text.split(/[\s,]+/).filter(Boolean) })
      setText(result.holidays.join('\n')); toast.success(`공휴일 ${result.holidays.length}일을 저장했습니다.`); onSaved()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">영업일 계산에서 뺄 날짜(주말 제외 평일 공휴일·대체공휴일·회사 휴무일)를 한 줄에 하나씩 YYYY-MM-DD 로 적습니다. 기본값은 참고용이니 정부 발표로 확인해 주세요.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={10} className={`${input} font-mono`} />
      <button onClick={save} disabled={busy} className="btn-primary">{busy && <Loader2 size={15} className="animate-spin" />}공휴일 저장</button>
    </div>
  )
}

function ChatSettings({ data, onSaved }) {
  const chat = data.chat || {}
  const [enabled, setEnabled] = useState(Boolean(chat.chat_enabled))
  const [mention, setMention] = useState(Boolean(chat.chat_mention_by_email))
  const [busy, setBusy] = useState('')
  const run = async (action, body, message) => {
    setBusy(action)
    try { await nexusApi('/api/closing', { action, ...body }); toast.success(message); if (action === 'chat_settings') onSaved() }
    catch (e) { toast.error(e.message) } finally { setBusy('') }
  }
  return (
    <div className="space-y-4 text-sm">
      <div className={`rounded-xl p-3 ${chat.configured ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>
        <MessageSquare size={15} className="mr-1 inline" />
        {chat.configured ? '서버에 Google Chat 웹훅 주소가 설정되어 있습니다.' : '서버 환경변수 GOOGLE_CHAT_WEBHOOK_URL 이 없습니다. Chat 스페이스 > 앱 및 통합 > 웹훅에서 주소를 만든 뒤 배포 환경변수에 넣어 주세요.'}
      </div>
      <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Chat 알림 사용 (업무 배정·멘션·고위험 확인은 즉시, 평일 08:40 아침 브리핑, 금요일엔 주간보고 미제출자 안내)</label>
      <label className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={mention} onChange={e => setMention(e.target.checked)} />팀원 이메일(구글 계정)로 Chat 멘션 — 팀원 관리에 회사 이메일이 등록된 경우</label>
      <p className="text-xs text-slate-400">켜기 전에 생긴 알림은 보내지 않습니다. 브리핑은 서버 환경변수 CRON_SECRET 이 설정된 배포 환경에서만 자동 발송됩니다.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => run('chat_settings', { enabled, mention_by_email: mention }, '알림 설정을 저장했습니다.')} disabled={!!busy} className="btn-primary">{busy === 'chat_settings' && <Loader2 size={15} className="animate-spin" />}설정 저장</button>
        <button onClick={() => run('chat_test', {}, '테스트 메시지를 보냈습니다. Chat 스페이스를 확인하세요.')} disabled={!!busy || !chat.configured} className="btn-secondary">연결 테스트</button>
        <button onClick={() => run('chat_brief_now', {}, '지금 기준 브리핑을 보냈습니다.')} disabled={!!busy || !chat.configured} className="btn-secondary">브리핑 지금 보내기</button>
      </div>
    </div>
  )
}
