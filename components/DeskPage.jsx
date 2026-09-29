'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, Copy, Eraser, ListChecks, Loader2, NotebookPen, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { nexusApi } from '@/lib/nexus-api'
import { addDays, seoulDate, weekRange } from '@/lib/weekly-utils.mjs'
import { TEXTAREA } from '@/components/CompletionCheck'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const dayLabel = date => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]})`
const short = date => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
const chatKey = (memberId, week) => `nexus_desk_chat_${memberId}_${week}`
const readChat = key => { try { return JSON.parse(sessionStorage.getItem(key) || '[]') } catch { return [] } }
const writeChat = (key, messages) => { try { sessionStorage.setItem(key, JSON.stringify(messages.slice(-30))) } catch {} }

const PRESETS = [
  ['회의자료 만들기', '전주 실적과 금주 계획을 주간 회의자료 양식으로 정리해 줘.'],
  ['전주 실적만', '전주 실적만 회의자료 양식으로 정리해 줘. 결과·산출물 위주로.'],
  ['금주 계획만', '금주 계획을 회의자료 양식으로 정리해 줘. 마감일이 있으면 함께 적어 줘.'],
  ['이번 주 3줄 요약', '이번 주에 한 일을 팀장님께 말로 보고하듯 3줄로 요약해 줘.'],
]

export default function DeskPage() {
  const [base, setBase] = useState(() => seoulDate())
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(() => seoulDate())
  const [logs, setLogs] = useState({})
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const logsRef = useRef(logs)
  logsRef.current = logs
  const listRef = useRef(null)

  const load = useCallback(async date => {
    setError('')
    try {
      const result = await nexusApi(`/api/desk?week=${date}`)
      setData(result)
      setLogs(Object.fromEntries(result.logs.map(l => [l.log_date, l.content])))
      setDrafts({})
      const inRange = result.today >= result.prev.start && result.today <= result.week.end
      setSelected(inRange ? result.today : result.week.start)
      setMessages(readChat(chatKey(result.memberId, result.week.start)))
    } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { load(base) }, [base, load])
  useEffect(() => { if (data) writeChat(chatKey(data.memberId, data.week.start), messages) }, [messages, data])
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, thinking])

  const saveLog = useCallback(async (date, content) => {
    setSaving(true)
    try {
      const { log } = await nexusApi('/api/desk', { action: 'save_log', date, content })
      setLogs(old => { const next = { ...old }; if (log) next[date] = log.content; else delete next[date]; return next })
      setDrafts(old => { if (old[date] !== content) return old; const next = { ...old }; delete next[date]; return next })
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      return true
    } catch (e) { toast.error(e.message); return false } finally { setSaving(false) }
  }, [])
  // 저장 안 된 날짜를 모두 저장 (주 이동·비서몬 대화 전에 최신 기록을 서버에 맞춘다)
  const flush = useCallback(async () => {
    const pending = Object.entries(draftsRef.current).filter(([date, text]) => text !== (logsRef.current[date] ?? ''))
    const results = await Promise.all(pending.map(([date, text]) => saveLog(date, text)))
    return results.every(Boolean)
  }, [saveLog])

  const text = drafts[selected] ?? logs[selected] ?? ''
  const dirty = drafts[selected] !== undefined && drafts[selected] !== (logs[selected] ?? '')
  const anyDirty = Object.entries(drafts).some(([date, value]) => value !== (logs[date] ?? ''))
  // 입력을 멈추고 1.2초 뒤 자동 저장
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => saveLog(selected, drafts[selected]), 1200)
    return () => clearTimeout(timer)
  }, [dirty, selected, drafts, saveLog])
  useEffect(() => {
    const warn = event => { if (anyDirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyDirty])

  const days = useMemo(() => data ? [data.prev.start, data.week.start].map(start => Array.from({ length: 7 }, (_, i) => addDays(start, i))) : [], [data])
  const doneOn = useMemo(() => {
    const map = {}
    for (const t of data?.tasks || []) if (t.status === '완료' && t.completed_at) (map[seoulDate(t.completed_at)] ||= []).push(t)
    return map
  }, [data])
  const stats = useMemo(() => {
    if (!data) return null
    const done = (data.tasks || []).filter(t => t.status === '완료' && t.completed_at).map(t => seoulDate(t.completed_at))
    return { prevDone: done.filter(d => d < data.week.start).length, weekDone: done.filter(d => d >= data.week.start).length, open: data.tasks.filter(t => t.status !== '완료').length, logDays: Object.keys(logs).length }
  }, [data, logs])

  const edit = value => setDrafts(old => ({ ...old, [selected]: value }))
  const importDone = () => {
    const lines = (doneOn[selected] || []).map(t => `- ${t.title} 완료`).filter(line => !text.includes(line))
    if (!lines.length) { toast('이날 완료한 업무가 이미 모두 들어 있어요.'); return }
    edit(`${text.trimEnd()}${text.trim() ? '\n' : ''}${lines.join('\n')}`)
  }
  const moveWeek = async days => {
    if (anyDirty && !(await flush())) return
    setData(null); setBase(addDays(weekRange(base).start, days))
  }

  const send = async content => {
    const message = content.trim()
    if (!message || thinking) return
    if (!(await flush())) return
    const before = messages
    const next = [...messages, { role: 'user', content: message }]
    setMessages(next); setInput(''); setThinking(true)
    try {
      const { reply } = await nexusApi('/api/desk', { action: 'chat', week: data.week.start, messages: next })
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      toast.error(e.message)
      setMessages(before); setInput(message)
    } finally { setThinking(false) }
  }
  const copy = async value => {
    try { await navigator.clipboard.writeText(value); toast.success('복사했어요. 회의자료에 붙여 넣으세요.') } catch { toast.error('복사하지 못했어요. 직접 선택해 복사해 주세요.') }
  }

  if (error) return <div role="alert" className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{error}<button className="btn-secondary ml-3" onClick={() => load(base)}>다시 불러오기</button></div>
  if (!data) return <p className="p-8 text-slate-500">작업공간을 불러오는 중…</p>
  const assistant = data.assistant
  const isThisWeek = data.week.start === weekRange(data.today).start

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-indigo-600">나만 보는 공간 · 팀장님도 볼 수 없어요</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold dark:text-white"><NotebookPen className="text-indigo-500" /> 내 작업공간</h1>
        <p className="mt-2 text-sm text-slate-500">하루 한 일을 편하게 적어 두면, 비서몬이 전주 실적·금주 계획 회의자료로 정리해 줘요.</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-secondary" onClick={() => moveWeek(-7)} disabled={saving || thinking}>← 이전 주</button>
        <span className="min-w-36 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">금주 {short(data.week.start)}~{short(data.week.end)}</span>
        <button className="btn-secondary" onClick={() => moveWeek(7)} disabled={saving || thinking || isThisWeek}>다음 주 →</button>
      </div>
    </header>

    <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.15fr]">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold dark:text-white">일일 업무 기록</h2>
          <p className="text-xs text-slate-400">기록한 날 {stats.logDays}일 · 전주 완료 {stats.prevDone} · 금주 완료 {stats.weekDone} · 진행 중 {stats.open}</p>
        </div>
        {days.map((week, w) => <div key={w}>
          <p className="mb-1.5 text-xs font-semibold text-slate-400">{w === 0 ? '전주' : '금주'}</p>
          <div className="grid grid-cols-7 gap-1.5">{week.map(date => {
            const active = date === selected
            const has = Boolean(logs[date] || drafts[date])
            const future = date > data.today
            return <button key={date} onClick={() => setSelected(date)} aria-pressed={active} aria-label={`${dayLabel(date)}${has ? ' 기록 있음' : ''}`}
              className={`rounded-lg border px-1 py-2 text-center text-xs transition ${active ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200' : 'border-slate-100 hover:border-indigo-200 dark:border-slate-800'} ${future && !active ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'} ${date === data.today ? 'font-bold' : ''}`}>
              <span className="block">{WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}</span>
              <span className="block">{short(date)}</span>
              <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${has ? 'bg-indigo-500' : doneOn[date] ? 'bg-emerald-300' : 'bg-transparent'}`} />
            </button>
          })}</div>
        </div>)}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold dark:text-white">{dayLabel(selected)}{selected === data.today && <span className="ml-2 text-xs font-medium text-indigo-600">오늘</span>}</h3>
            <button type="button" onClick={importDone} disabled={!doneOn[selected]} className="btn-secondary text-xs disabled:opacity-40"><ListChecks size={14} /> 이날 완료한 업무 넣기 {doneOn[selected] ? `(${doneOn[selected].length})` : ''}</button>
          </div>
          <textarea value={text} onChange={e => edit(e.target.value)} maxLength={8000} rows={11}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty) saveLog(selected, drafts[selected]) } }}
            placeholder={'편하게 적으세요. 한 줄에 한 가지씩이면 충분해요.\n- 9월 원가 마감 SAP 대사 (차이 없음)\n- 재료비 차이 분석 초안 작성, 팀장님 검토 요청\n- 구매팀과 단가 변경 건 통화'}
            className={`${TEXTAREA} resize-y`} />
          <p className="mt-1.5 text-xs text-slate-400" aria-live="polite">{saving ? '저장 중…' : dirty ? '입력을 멈추면 자동 저장돼요 (Ctrl+S 즉시 저장)' : savedAt ? `저장됨 · ${savedAt}` : '입력하면 자동 저장돼요'}</p>
        </div>
      </section>

      <section className="flex flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-bold dark:text-white"><Bot className="text-indigo-500" size={20} /> 비서몬</h2>
          {messages.length > 0 && <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600" disabled={thinking} onClick={() => { if (window.confirm('이 주의 대화를 지울까요?')) setMessages([]) }}><Eraser size={14} /> 대화 지우기</button>}
        </div>
        {!assistant.ready && <p className="mx-5 mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{!assistant.configured ? '서버의 비서몬 연결 설정이 필요합니다.' : '관리자가 비서몬 외부 전송을 켜면 대화할 수 있어요.'} 일일 기록은 지금도 저장됩니다.</p>}
        <div ref={listRef} className="max-h-[60vh] min-h-72 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !thinking && <div className="py-6 text-center text-sm leading-6 text-slate-500">
            <p>전주·금주 기록과 업무를 보고 회의자료를 만들어 드려요.</p>
            <p>아래 버튼을 누르거나, &quot;구매팀 협조 건은 이슈로 빼 줘&quot;처럼 편하게 말해 주세요.</p>
          </div>}
          {messages.map((m, i) => m.role === 'user'
            ? <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">{m.content}</div>
            : <div key={i} className="max-w-[95%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 dark:bg-slate-800">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-100">{m.content}</p>
              <button onClick={() => copy(m.content)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-300"><Copy size={13} /> 복사</button>
            </div>)}
          {thinking && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin text-indigo-500" /> 비서몬이 기록을 모아 정리하는 중… (길면 1분 정도)</p>}
        </div>
        <div className="space-y-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">{PRESETS.map(([label, prompt]) => <button key={label} disabled={thinking || !assistant.ready} onClick={() => send(prompt)} className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40">{label}</button>)}</div>
          <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); send(input) }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={2} maxLength={4000} disabled={!assistant.ready}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input) } }}
              placeholder="비서몬에게 요청하기 (Enter 보내기 · Shift+Enter 줄바꿈)" className={`${TEXTAREA} mt-0 resize-none`} />
            <button disabled={thinking || !input.trim() || !assistant.ready} className="btn-primary shrink-0" aria-label="보내기"><Send size={16} /></button>
          </form>
          <p className="text-xs leading-5 text-slate-400">대화하면 전주·금주 기록과 업무 목록이 비서몬(외부 AI 서비스)으로 전송됩니다. {assistant.masked ? '숫자는 가려서 보내고 답에서 원래 숫자로 되돌려요. ' : ''}대화 1번이 하루 사용 횟수 1회로 계산돼요. 완료 점검은 <Link href="/ai" className="text-indigo-500">비서몬 점검</Link>에서 볼 수 있어요.</p>
        </div>
      </section>
    </div>
  </div>
}
