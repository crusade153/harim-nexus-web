'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { nexusApi } from '@/lib/nexus-api'
import { TASKS_CHANGED_EVENT } from '@/lib/links'
import { COMPLETION_HOST_FLAG, COMPLETION_REQUEST_EVENT } from '@/lib/completion-gate'

const draftKey = id => `nexus_check_answers_${id}`
const readDraft = id => { try { return JSON.parse(sessionStorage.getItem(draftKey(id)) || '[]') } catch { return [] } }
const writeDraft = (id, answers) => { try { sessionStorage.setItem(draftKey(id), JSON.stringify(answers)) } catch {} }
const clearDraft = id => { try { sessionStorage.removeItem(draftKey(id)) } catch {} }
export const TEXTAREA = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-900'

// 레이아웃에 한 번 두면, 어느 화면에서든 requestTaskCompletion() 으로 완료 점검 창을 연다.
export default function CompletionCheckHost() {
  const pending = useRef(null)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState([])
  const [busy, setBusy] = useState(false)

  const finish = useCallback(ok => {
    const resolve = pending.current?.resolve
    pending.current = null
    setOpen(false); setData(null); setError(''); setAnswers([]); setBusy(false)
    resolve?.(ok)
  }, [])

  const prepare = useCallback(async taskId => {
    setError(''); setData(null)
    try {
      const result = await nexusApi('/api/ai/check', { action: 'prepare', taskId })
      if (pending.current?.taskId !== taskId) return
      if (result.completed) { finish(true); return }
      const saved = readDraft(result.check.id)
      setAnswers(result.check.questions.map((_, i) => (typeof saved[i] === 'string' ? saved[i] : '')))
      setData(result)
    } catch (e) { setError(e.message) }
  }, [finish])

  useEffect(() => {
    window[COMPLETION_HOST_FLAG] = true
    const onRequest = event => {
      const { taskId, resolve } = event.detail
      if (pending.current) { toast('진행 중인 완료 점검을 먼저 마쳐 주세요.'); resolve(false); return }
      pending.current = { taskId, resolve }
      setOpen(true)
      prepare(taskId)
    }
    window.addEventListener(COMPLETION_REQUEST_EVENT, onRequest)
    return () => { window.removeEventListener(COMPLETION_REQUEST_EVENT, onRequest); delete window[COMPLETION_HOST_FLAG] }
  }, [prepare])

  const cancel = useCallback(() => {
    if (busy) return
    finish(false)
  }, [busy, finish])

  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') cancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, cancel])

  const change = (index, value) => {
    setAnswers(old => {
      const next = old.map((a, i) => (i === index ? value : a))
      if (data) writeDraft(data.check.id, next)
      return next
    })
  }

  const submit = async e => {
    e.preventDefault()
    setBusy(true)
    try {
      await nexusApi('/api/ai/check', { action: 'submit', id: data.check.id, answers })
      clearDraft(data.check.id)
      toast.success('완료했어요! 점검 답변은 팀장님께 전달됐어요.')
      window.dispatchEvent(new Event(TASKS_CHANGED_EVENT))
      finish(true)
    } catch (err) {
      toast.error(err.message)
      setBusy(false)
    }
  }

  if (!open) return null
  const questions = data?.check.questions || []
  const ready = questions.length > 0 && answers.every(a => a.trim())
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) cancel() }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="completion-check-title" className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300"><Bot size={15} /> AI 친구</p>
            <h2 id="completion-check-title" className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">완료하기 전에 같이 점검해 볼까요?</h2>
            {data?.task?.title && <p className="mt-1 break-words text-sm text-slate-500">{data.task.title}</p>}
          </div>
          <button type="button" onClick={cancel} disabled={busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="닫기"><X size={18} /></button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error ? (
            <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}
              <button type="button" className="btn-secondary mt-3" onClick={() => prepare(pending.current?.taskId)}>다시 시도</button>
            </div>
          ) : !data ? (
            <p className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin text-indigo-500" /> AI 친구가 이 업무에서 놓치기 쉬운 걸 떠올리는 중…</p>
          ) : (
            <>
              {data.notice && <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{data.notice}</p>}
              {questions.map((q, i) => (
                <label key={i} className="block text-sm font-medium leading-6 text-slate-800 dark:text-slate-100">
                  <span className="text-indigo-600 dark:text-indigo-300">{i + 1}.</span> {q}
                  <textarea required autoFocus={i === 0} maxLength={3000} rows={3} disabled={busy} value={answers[i] || ''} onChange={e => change(i, e.target.value)} className={TEXTAREA} placeholder="무엇을 어떻게 확인했는지 적어 주세요." />
                </label>
              ))}
            </>
          )}
        </div>
        <footer className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <p className="mb-3 text-xs leading-5 text-slate-400">답변은 저장되어 팀장님이 검토합니다. 보완이 필요하면 업무가 다시 ‘진행중’으로 돌아올 수 있어요.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} disabled={busy} className="btn-secondary">나중에 할게요</button>
            <button disabled={busy || !ready} className="btn-primary disabled:opacity-50">{busy ? <><Loader2 size={16} className="animate-spin" /> 저장 중…</> : <><CheckCircle2 size={16} /> 답변 저장하고 완료</>}</button>
          </div>
        </footer>
      </form>
    </div>
  )
}
