'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, CheckCircle2, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { nexusApi } from '@/lib/nexus-api'
import { entityUrl } from '@/lib/links'
import { TEXTAREA } from '@/components/CompletionCheck'

const STATUS = {
  draft: ['작성 중', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'],
  submitted: ['팀장 검토 대기', 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'],
  approved: ['팀장 확인 완료', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'],
  returned: ['보완 요청', 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'],
  superseded: ['다시 열림 · 검토 제외', 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'],
}
const time = value => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : ''
const Badge = ({ status }) => <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS[status]?.[1] || ''}`}>{STATUS[status]?.[0] || status}</span>

// 완료 점검: 팀원은 내 기록, 팀장(관리자)은 검토 대기 → 확인/보완 요청
export default function CompletionReviews({ settings, reloadKey }) {
  const params = useSearchParams()
  const isAdmin = Boolean(settings?.isAdmin)
  const [view, setView] = useState(isAdmin ? 'pending' : 'mine')
  const [list, setList] = useState(null)
  const [detail, setDetail] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setError(''); setList(await nexusApi(`/api/ai/check?view=${view}`)) } catch (e) { setError(e.message) }
  }, [view])
  const openBy = useCallback(async query => {
    setLoadingDetail(true)
    try {
      const result = await nexusApi(`/api/ai/check?${query}`)
      setDetail(result); setComment(result.check?.lead_comment || '')
    } catch (e) { toast.error(e.message) } finally { setLoadingDetail(false) }
  }, [])
  useEffect(() => { load() }, [load, reloadKey])
  useEffect(() => {
    const id = Number(params.get('check')), task = Number(params.get('task'))
    if (id) openBy(`id=${id}`)
    else if (task) openBy(`task=${task}`)
  }, [params, openBy])

  const review = async action => {
    if (action === 'return' && !comment.trim()) { toast.error('무엇을 보완하면 되는지 적어 주세요.'); return }
    setBusy(true)
    try {
      await nexusApi('/api/ai/check', { action, id: detail.check.id, comment })
      toast.success(action === 'approve' ? '확인 완료로 기록했습니다.' : '보완 요청을 보냈습니다. 업무가 진행중으로 돌아갔습니다.')
      await Promise.all([openBy(`id=${detail.check.id}`), load()])
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const views = isAdmin ? [['pending', `검토 대기${list?.pendingCount != null ? ` ${list.pendingCount}` : ''}`], ['reviewed', '검토 완료'], ['mine', '내 기록']] : []
  const check = detail?.check
  const names = { ...(list?.names || {}), ...(detail?.names || {}) }
  return <div className="space-y-5">
    {views.length > 0 && <div className="flex flex-wrap gap-2">{views.map(([id, label]) => <button key={id} onClick={() => { setView(id); setDetail(null) }} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'}`}>{label}</button>)}</div>}
    {error && <div role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">{error}</div>}
    <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.4fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-bold dark:text-white">{view === 'pending' ? '팀장 검토 대기' : view === 'reviewed' ? '검토 완료' : '내 완료 점검'} <span className="font-normal text-slate-400">최근 100건</span></h2>
        <div className="mt-4 space-y-2">
          {list?.checks.map(c => <button key={c.id} disabled={loadingDetail} onClick={() => openBy(`id=${c.id}`)} className={`w-full rounded-xl border p-4 text-left transition hover:border-indigo-300 ${check?.id === c.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-100 dark:border-slate-800'}`}>
            <Badge status={c.status} />
            <p className="mt-2 break-words text-sm font-medium dark:text-slate-100">{c.task_snapshot?.title || '제목 없음'}</p>
            <p className="mt-1 text-xs text-slate-400">{view !== 'mine' ? `${names[c.member_id] || '알 수 없음'} · ` : ''}완료 {time(c.submitted_at)}</p>
          </button>)}
          {list && list.checks.length === 0 && <p className="py-8 text-center text-sm text-slate-400">{view === 'pending' ? '검토할 완료 점검이 없습니다.' : '아직 기록이 없습니다.'}</p>}
          {!list && !error && <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p>}
        </div>
      </section>
      <section className="min-h-80 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {loadingDetail ? <p className="text-sm text-slate-500">기록을 불러오는 중…</p>
          : detail && !check ? <div className="py-14 text-center"><ClipboardCheck className="mx-auto text-slate-300" size={36} /><h2 className="mt-4 font-bold dark:text-white">이 업무의 완료 점검 기록이 없습니다.</h2><p className="mt-2 text-sm text-slate-500">자동화 규칙 등으로 점검 없이 완료되었거나, 아직 완료되지 않은 업무입니다.</p></div>
          : !check ? <div className="py-14 text-center"><ClipboardCheck className="mx-auto text-indigo-300" size={36} /><h2 className="mt-4 font-bold dark:text-white">점검 기록을 선택하세요.</h2><p className="mt-2 text-sm leading-6 text-slate-500">업무를 완료하면 비서몬이 꼭 점검할 것을 묻고,<br />답변은 여기에 저장되어 팀장이 검토합니다.</p></div>
          : <div className="space-y-5">
            <div>
              <Badge status={check.status} />
              <h2 className="mt-2 break-words text-xl font-bold dark:text-white">{check.task_snapshot?.title || '제목 없음'}</h2>
              <p className="mt-1 text-sm text-slate-500">{names[check.member_id] || '알 수 없음'} · 완료 {time(check.submitted_at)}{detail.task?.status && detail.task.status !== '완료' ? ` · 현재 상태 ${detail.task.status}` : ''}</p>
              <Link href={entityUrl('task', check.task_id)} className="mt-2 inline-block text-sm text-indigo-600">업무 보기 →</Link>
            </div>
            <ol className="space-y-3">
              {check.questions.map((q, i) => <li key={i} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                <p className="text-sm font-medium leading-6 text-slate-800 dark:text-slate-100"><span className="text-indigo-600 dark:text-indigo-300">{i + 1}.</span> {q}</p>
                <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-indigo-50 px-3 py-2 text-sm leading-6 text-slate-700 dark:bg-indigo-950/30 dark:text-slate-200">{check.answers?.[i] || '답변 없음'}</p>
              </li>)}
            </ol>
            <p className="text-xs text-slate-400">{check.question_source === 'ai' ? '비서몬이 이 업무에 맞춰 만든 질문' : '기본 점검 질문 (외부 전송 없음)'}</p>
            {check.reviewed_at && <div className={`rounded-xl p-4 text-sm ${check.status === 'returned' ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>
              <strong>{names[check.reviewed_by_member_id] || '팀장'} · {time(check.reviewed_at)}</strong>
              <p className="mt-1 whitespace-pre-wrap break-words">{check.lead_comment || '의견 없이 확인했습니다.'}</p>
              {check.status === 'returned' && detail.mine && <p className="mt-2 text-xs">보완한 뒤 업무를 다시 완료하면 새 점검이 팀장에게 전달됩니다.</p>}
            </div>}
            {detail.isAdmin && check.status === 'submitted' && <div className="space-y-3 rounded-xl border border-indigo-100 p-4 dark:border-indigo-900">
              <label className="block text-sm font-medium dark:text-slate-100">팀장 의견 <span className="font-normal text-slate-400">(확인은 선택, 보완 요청은 필수)</span>
                <textarea rows={3} maxLength={3000} disabled={busy} value={comment} onChange={e => setComment(e.target.value)} className={TEXTAREA} placeholder="예: 대사 결과 파일 링크를 업무에 추가해 주세요." />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <button disabled={busy} onClick={() => review('return')} className="btn-secondary"><Undo2 size={16} /> 보완 요청 (진행중으로 되돌림)</button>
                <button disabled={busy} onClick={() => review('approve')} className="btn-primary"><CheckCircle2 size={16} /> 확인 완료</button>
              </div>
            </div>}
          </div>}
      </section>
    </div>
  </div>
}
