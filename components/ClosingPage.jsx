'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, CalendarCheck2, CheckCircle2, Circle, Copy, Loader2, MessageSquare, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { nexusApi } from '@/lib/nexus-api'
import { entityUrl, TASKS_CHANGED_EVENT } from '@/lib/links'
import { completeWithCheck } from '@/lib/completion-gate'
import { requestChatFlush } from '@/lib/chat-client'
import {
  businessDaysBetween, buildClosingTasks, CLOSING_PLANTS, closingProgress, closingProgressByPlant,
  defaultRunStart, DEFAULT_PLANT, isValidPeriod, normalizePlant, parseClosingTitle
} from '@/lib/closing-utils.mjs'
import { seoulDate } from '@/lib/weekly-utils.mjs'

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
const label = 'mb-1 block text-xs font-bold text-slate-500'
const emptyTemplate = { id: null, name: '', description: '', active: true, auto_start: false, items: [] }
const emptyItem = (plant = DEFAULT_PLANT) => ({ key: crypto.randomUUID(), id: null, plant, title: '', offset_days: 0, default_assignee_member_id: '', reference_url: '', description: '' })
const plantName = plant => (plant === DEFAULT_PLANT ? '공통' : `${plant} 공장`)

// 처음 만드는 사람이 빈 화면에서 막히지 않도록 넣어 주는 예시. 자기 업무에 맞게 고쳐 쓰는 용도다.
const SAMPLE_COMMON = [
  { title: '월마감 일정·담당 공유', offset_days: 0 },
  { title: '전사 원가 결산 취합', offset_days: 4 }
]
const SAMPLE_PLANT = [
  { title: '생산실적 확정 확인', offset_days: 1 },
  { title: '재고 수불·재고조사 차이 정리', offset_days: 2 },
  { title: '제조원가 배부·정산 점검', offset_days: 3 },
  { title: '표준원가 대비 차이 분석', offset_days: 4 }
]

function PlantChip({ active, onClick, children }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300'}`}>{children}</button>
}

export default function ClosingPage() {
  const [data, setData] = useState(null)
  const [runId, setRunId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminTab, setAdminTab] = useState('auto')

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
          <p className="mt-1 text-sm text-slate-500">플랜트(K1·K2·K3)별 마감 체크리스트를 한 번 만들어 두면, 매달 몇 번의 클릭으로 담당자별 업무가 만들어집니다.</p>
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
            {data.isAdmin ? '아직 시작한 월마감이 없습니다.' : '관리자가 월마감을 시작하면 이곳에 내 마감 항목이 표시됩니다.'}
          </div>}

      {data.isAdmin && <AdminPanel data={data} tab={adminTab} setTab={setAdminTab} onSaved={id => load(id)} />}
    </div>
  )
}

function RunView({ data, templateName, onChanged }) {
  const { run, runTasks, previousRun, previousTasks, holidays, today, memberId, isAdmin } = data
  const [busyId, setBusyId] = useState(null)
  const [plantFilter, setPlantFilter] = useState('all')
  const [mineOnly, setMineOnly] = useState(false)
  const progress = closingProgress(runTasks, today)
  const plantProgress = closingProgressByPlant(runTasks, today)
  const showPlants = plantProgress.length > 1 || plantProgress.some(entry => entry.plant !== DEFAULT_PLANT)
  const previousByItem = new Map(previousTasks.map(t => [t.closing_item_id, t]))
  const hasMine = runTasks.some(task => task.assignee_member_id === memberId)

  const visible = runTasks.filter(task => (plantFilter === 'all' || parseClosingTitle(task.title).plant === plantFilter) && (!mineOnly || task.assignee_member_id === memberId))
  const groups = CLOSING_PLANTS
    .map(plant => ({ plant, tasks: visible.filter(task => parseClosingTitle(task.title).plant === plant) }))
    .filter(group => group.tasks.length > 0)

  const toggle = async task => {
    setBusyId(task.id)
    try {
      // 완료는 비서몬 점검 창을 거친다. 되돌리기(대기)는 바로 저장
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
        {showPlants && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {plantProgress.map(entry => (
              <button key={entry.plant} onClick={() => setPlantFilter(plantFilter === entry.plant ? 'all' : entry.plant)} aria-pressed={plantFilter === entry.plant} className={`rounded-xl border p-3 text-left transition ${plantFilter === entry.plant ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20' : 'border-slate-200 hover:border-indigo-200 dark:border-slate-700'}`}>
                <div className="flex items-center justify-between text-sm"><b className="text-slate-800 dark:text-white">{plantName(entry.plant)}</b><span className="text-xs text-slate-500">{entry.done}/{entry.total}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-full rounded-full ${entry.rate === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${entry.rate}%` }} /></div>
                {entry.overdue > 0 && <p className="mt-1.5 text-[11px] font-bold text-rose-600">지연 {entry.overdue}건</p>}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(showPlants || hasMine) && <PlantChip active={plantFilter === 'all' && !mineOnly} onClick={() => { setPlantFilter('all'); setMineOnly(false) }}>전체 보기</PlantChip>}
            {hasMine && <PlantChip active={mineOnly} onClick={() => setMineOnly(!mineOnly)}>내 항목만</PlantChip>}
          </div>
          {isAdmin && (run.status === 'open'
            ? <button onClick={() => setRunStatus('close_run')} className="btn-secondary text-xs">마감 완료로 표시</button>
            : <button onClick={() => setRunStatus('reopen_run')} className="btn-secondary text-xs">다시 열기</button>)}
        </div>
      </div>

      <div className="card-base overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60">
            <tr><th className="w-12 p-3" /><th className="p-3">항목</th><th className="p-3">담당</th><th className="p-3">마감</th><th className="p-3">{previousRun ? `지난달(${previousRun.period})` : '지난달'}</th></tr>
          </thead>
          {groups.map(group => {
            const groupProgress = closingProgress(group.tasks, today)
            return (
              <tbody key={group.plant}>
                {showPlants && <tr className="border-t border-slate-100 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40"><td colSpan={5} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300">{plantName(group.plant)} <span className="ml-1 font-normal text-slate-400">{groupProgress.done}/{groupProgress.total} 완료</span></td></tr>}
                {group.tasks.map(task => {
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
                      <td className="p-3"><Link href={entityUrl('task', task.id)} className={`font-semibold hover:text-indigo-600 ${done ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>{parseClosingTitle(task.title).label}</Link></td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{task.assignee || <span className="text-slate-300">미정</span>}</td>
                      <td className={`p-3 ${late ? 'font-bold text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>{task.due_date} <span className="text-xs text-slate-400">D+{businessDaysBetween(run.start_date, task.due_date, holidays)}</span>{late && ' · 지연'}</td>
                      <td className="p-3 text-xs text-slate-500">{previous ? (previousDay !== null ? `${previousDay}영업일째 완료` : '미완료') : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
        {groups.length === 0 && <p className="p-8 text-center text-sm text-slate-400">{runTasks.length === 0 ? '항목이 없습니다.' : '조건에 맞는 항목이 없습니다.'}</p>}
      </div>
    </>
  )
}

function Stat({ label: text, value, danger }) {
  return <div><strong className={`block text-xl font-black ${danger ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{value}</strong><span className="text-xs text-slate-400">{text}</span></div>
}

function AdminPanel({ data, tab, setTab, onSaved }) {
  const tabs = [['template', '① 체크리스트 만들기'], ['start', '② 월마감 시작'], ['holidays', '공휴일'], ['chat', 'Google Chat 알림']]
  // 아직 아무것도 없으면 다음에 할 일을 바로 펼쳐 준다 (직접 접으면 그대로 접힌 채로 둔다)
  const current = tab === 'auto' ? (!data.templates.length ? 'template' : !data.runs.length ? 'start' : null) : tab
  const toggleTab = id => setTab(current === id ? null : id)
  return (
    <section className="card-base p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Settings2 size={18} className="text-slate-400" /><h2 className="mr-2 font-bold text-slate-900 dark:text-white">관리자 설정</h2>
        {tabs.map(([id, name]) => <button key={id} onClick={() => toggleTab(id)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${current === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{name}</button>)}
      </div>
      {current === 'start' && <StartRun data={data} onSaved={onSaved} />}
      {current === 'template' && <TemplateEditor data={data} onSaved={onSaved} />}
      {current === 'holidays' && <HolidayEditor data={data} onSaved={onSaved} />}
      {current === 'chat' && <ChatSettings data={data} onSaved={onSaved} />}
      {!current && <p className="text-sm text-slate-400">체크리스트는 ① 탭에서 고치고, 매달 ② 탭에서 월마감을 시작하세요. 체크리스트의 ‘자동 시작’을 켜면 매월 첫 영업일 아침에 지난달 마감이 저절로 만들어집니다.</p>}
    </section>
  )
}

function StartRun({ data, onSaved }) {
  const active = data.templates.filter(t => t.active)
  const [templateId, setTemplateId] = useState(active[0]?.id || '')
  const [period, setPeriod] = useState(data.defaults.period)
  const [startDate, setStartDate] = useState(data.defaults.startDate)
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const items = useMemo(() => data.items.filter(i => i.template_id === Number(templateId)), [data.items, templateId])
  const plantCounts = CLOSING_PLANTS.map(plant => ({ plant, count: items.filter(i => normalizePlant(i.plant) === plant).length })).filter(entry => entry.count > 0)
  const selected = picked ?? plantCounts.map(entry => entry.plant)
  const chosenItems = items.filter(i => selected.includes(normalizePlant(i.plant)))
  const preview = useMemo(() => (isValidPeriod(period) && startDate ? buildClosingTasks(chosenItems, { period, startDate, holidays: data.holidays, members: data.members }) : []), [chosenItems, period, startDate, data.holidays, data.members])
  const exists = data.runs.some(r => r.template_id === Number(templateId) && r.period === period)
  const togglePlant = plant => setPicked(selected.includes(plant) ? selected.filter(value => value !== plant) : [...selected, plant])

  const start = async () => {
    setBusy(true)
    try {
      const result = await nexusApi('/api/closing', { action: 'start_run', template_id: Number(templateId), period, start_date: startDate, plants: selected })
      toast.success(`${period} 월마감 업무 ${result.taskCount}건을 만들고 담당자에게 알렸습니다.`)
      onSaved(result.run.id)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (!active.length) return <p className="text-sm text-slate-500">사용 중인 체크리스트가 없습니다. ‘① 체크리스트 만들기’에서 먼저 만드세요.</p>
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className={label}>체크리스트</span><select value={templateId} onChange={e => { setTemplateId(e.target.value); setPicked(null) }} className={input}>{active.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label><span className={label}>마감 대상월 (몇 월 마감인가요?)</span><input type="month" value={period} onChange={e => { setPeriod(e.target.value); if (isValidPeriod(e.target.value)) setStartDate(defaultRunStart(e.target.value, data.holidays)) }} className={input} /></label>
        <label><span className={label}>마감 시작일 (D+0, 다음 달 첫 영업일)</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={input} /></label>
      </div>
      {plantCounts.length > 1 && (
        <div>
          <span className={label}>이번 마감에 포함할 플랜트</span>
          <div className="flex flex-wrap gap-2">{plantCounts.map(entry => <PlantChip key={entry.plant} active={selected.includes(entry.plant)} onClick={() => togglePlant(entry.plant)}>{plantName(entry.plant)} · {entry.count}건</PlantChip>)}</div>
          <p className="mt-1.5 text-[11px] text-slate-400">같은 달에 같은 체크리스트는 한 번만 시작할 수 있어요. 나중에 추가하려면 플랜트를 한꺼번에 골라 주세요.</p>
        </div>
      )}
      <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/50">
        <p className="mb-2 text-xs font-bold text-slate-500">만들어질 업무 미리보기 ({preview.length}건)</p>
        {preview.map(t => <div key={t.item_id} className="flex justify-between gap-3 border-t border-slate-100 py-1.5 first:border-0 dark:border-slate-800"><span className="text-slate-700 dark:text-slate-200">{t.title.replace(/^\[\d{4}-\d{2} 마감\]\s*/, '')}</span><span className="shrink-0 text-slate-500">{t.assignee || '담당 미정'} · {t.due_date}</span></div>)}
        {!preview.length && <p className="text-slate-400">{items.length ? '포함할 플랜트를 하나 이상 골라 주세요.' : '체크리스트에 항목이 없습니다.'}</p>}
      </div>
      {exists && <p className="text-sm font-semibold text-rose-600">이 체크리스트로 {period} 월마감을 이미 시작했습니다.</p>}
      <button onClick={start} disabled={busy || exists || !preview.length} className="btn-primary disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}월마감 시작 · 업무 {preview.length}건 만들기</button>
    </div>
  )
}

function TemplateEditor({ data, onSaved }) {
  const toForm = template => (template
    ? { ...template, items: data.items.filter(i => i.template_id === template.id).map(i => ({ ...i, plant: normalizePlant(i.plant), key: `i${i.id}`, default_assignee_member_id: i.default_assignee_member_id || '', reference_url: i.reference_url || '' })) }
    : { ...emptyTemplate, name: '월마감 체크리스트', items: [] })
  const [form, setForm] = useState(() => toForm(data.templates[0]))
  const [plant, setPlant] = useState(DEFAULT_PLANT)
  const [busy, setBusy] = useState(false)
  const setItem = (key, patch) => setForm(f => ({ ...f, items: f.items.map(i => (i.key === key ? { ...i, ...patch } : i)) }))
  const countOf = value => form.items.filter(i => i.plant === value).length
  const shown = form.items.filter(i => i.plant === plant)
  const move = (key, delta) => setForm(f => {
    const items = [...f.items]
    const index = items.findIndex(i => i.key === key)
    let target = index + delta
    while (target >= 0 && target < items.length && items[target].plant !== items[index].plant) target += delta
    if (target < 0 || target >= items.length) return f
    ;[items[index], items[target]] = [items[target], items[index]]
    return { ...f, items }
  })
  const copyTo = targetPlant => {
    if (!shown.length) return toast.error('복사할 항목이 없습니다.')
    if (countOf(targetPlant) && !window.confirm(`${plantName(targetPlant)}에 이미 항목이 ${countOf(targetPlant)}개 있습니다. 뒤에 이어서 복사할까요?`)) return
    setForm(f => ({ ...f, items: [...f.items, ...shown.map(i => ({ ...i, key: crypto.randomUUID(), id: null, plant: targetPlant, default_assignee_member_id: '' }))] }))
    toast.success(`${plantName(plant)} 항목 ${shown.length}개를 ${plantName(targetPlant)}에 복사했습니다. 플랜트마다 담당자가 다르니 담당자를 지정해 주세요.`)
  }
  const fillSamples = () => {
    const made = [
      ...SAMPLE_COMMON.map(item => ({ ...emptyItem(DEFAULT_PLANT), ...item })),
      ...CLOSING_PLANTS.filter(value => value !== DEFAULT_PLANT).flatMap(value => SAMPLE_PLANT.map(item => ({ ...emptyItem(value), ...item })))
    ]
    setForm(f => ({ ...f, items: [...f.items, ...made] }))
    toast.success('예시 항목을 넣었습니다. 내 업무에 맞게 고쳐 주세요.')
  }

  const save = async () => {
    setBusy(true)
    try {
      const result = await nexusApi('/api/closing', {
        action: 'save_template', id: form.id, name: form.name, description: form.description, active: form.active, auto_start: form.auto_start,
        items: form.items.map(i => ({ id: i.id, plant: i.plant, title: i.title, offset_days: Number(i.offset_days), default_assignee_member_id: i.default_assignee_member_id ? Number(i.default_assignee_member_id) : null, reference_url: i.reference_url, description: i.description })),
      })
      toast.success('체크리스트를 저장했습니다.')
      setForm(f => ({ ...f, id: result.templateId }))
      onSaved()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
        <b className="text-slate-800 dark:text-white">이렇게 쓰세요</b> — ① 아래 탭(공통·K1·K2·K3)에서 플랜트별로 마감 전 확인할 항목을 적고 <b>D+ 며칠째</b>·<b>담당자</b>를 정합니다. ② 한 플랜트에 만든 항목은 <b>다른 플랜트로 복사</b>해 한 번에 늘릴 수 있어요. ③ 저장한 뒤 ‘② 월마감 시작’에서 달과 플랜트를 고르면 업무가 만들어집니다.
      </div>
      <div className="flex flex-wrap gap-2">
        {data.templates.map(t => <button key={t.id} onClick={() => setForm(toForm(t))} className={`rounded-lg border px-3 py-1.5 text-sm ${form.id === t.id ? 'border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>{t.name}{!t.active && ' (중단)'}</button>)}
        <button onClick={() => setForm(toForm(null))} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500"><Plus size={14} />새 체크리스트</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={label}>체크리스트 이름</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} placeholder="예: 월마감 체크리스트" /></label>
        <label><span className={label}>설명</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={input} placeholder="선택" /></label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-slate-600 dark:text-slate-300">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />사용 중</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.auto_start} onChange={e => setForm({ ...form, auto_start: e.target.checked })} />매월 첫 영업일 아침에 지난달 마감 자동 시작 (모든 플랜트)</label>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="플랜트">
          {CLOSING_PLANTS.map(value => <PlantChip key={value} active={plant === value} onClick={() => setPlant(value)}>{plantName(value)} · {countOf(value)}</PlantChip>)}
          {form.items.length === 0 && <button onClick={fillSamples} className="ml-auto flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-600"><Sparkles size={13} />예시 항목으로 시작하기</button>}
        </div>
        <p className={label}>{plantName(plant)} 항목 — 마감일은 시작일(D+0)로부터 영업일 기준</p>
        {shown.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400 dark:border-slate-700">{plantName(plant)}에 항목이 없습니다. 아래 ‘항목 추가’로 만들거나, 다른 플랜트 탭에서 ‘복사’하세요.</p>}
        {shown.map(item => (
          <div key={item.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid gap-2 md:grid-cols-[1fr_110px_160px_auto]">
              <input value={item.title} onChange={e => setItem(item.key, { title: e.target.value })} className={input} placeholder="항목 이름 (예: 재고 수불 마감)" aria-label="항목 이름" />
              <label className="flex items-center gap-1 text-xs text-slate-500" title="마감 시작일부터 며칠째 영업일까지">D+<input type="number" min={0} max={30} value={item.offset_days} onChange={e => setItem(item.key, { offset_days: e.target.value })} className={input} aria-label="영업일" />일째</label>
              <select value={item.default_assignee_member_id} onChange={e => setItem(item.key, { default_assignee_member_id: e.target.value })} className={input} aria-label="기본 담당자"><option value="">담당 미정</option>{data.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
              <div className="flex items-center gap-1">
                <select value={item.plant} onChange={e => setItem(item.key, { plant: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900" aria-label="구분 이동" title="다른 플랜트로 옮기기">{CLOSING_PLANTS.map(value => <option key={value} value={value}>{value}</option>)}</select>
                <button onClick={() => move(item.key, -1)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="위로"><ArrowUp size={15} /></button>
                <button onClick={() => move(item.key, 1)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="아래로"><ArrowDown size={15} /></button>
                <button onClick={() => setForm(f => ({ ...f, items: f.items.filter(i => i.key !== item.key) }))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="항목 삭제"><Trash2 size={15} /></button>
              </div>
            </div>
            <details className="mt-2" open={Boolean(item.reference_url || item.description)}>
              <summary className="cursor-pointer text-xs text-slate-400">참고 링크·설명</summary>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input value={item.reference_url} onChange={e => setItem(item.key, { reference_url: e.target.value })} className={input} placeholder="참고 링크 (지난달 산출물 등)" aria-label="참고 링크" />
                <input value={item.description} onChange={e => setItem(item.key, { description: e.target.value })} className={input} placeholder="설명·확인 방법 (선택)" aria-label="항목 설명" />
              </div>
            </details>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setForm(f => ({ ...f, items: [...f.items, emptyItem(plant)] }))} className="btn-secondary text-sm"><Plus size={15} />{plantName(plant)}에 항목 추가</button>
          {shown.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500"><Copy size={13} />이 항목들을 복사:
              {CLOSING_PLANTS.filter(value => value !== plant).map(value => <button key={value} onClick={() => copyTo(value)} className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700">{value}</button>)}
            </span>
          )}
        </div>
      </div>
      <button onClick={save} disabled={busy} className="btn-primary">{busy && <Loader2 size={15} className="animate-spin" />}체크리스트 저장 ({form.items.length}개 항목)</button>
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
