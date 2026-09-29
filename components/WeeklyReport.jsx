'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, Printer, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { nexusApi } from '@/lib/nexus-api'
import { REPORT_FIELDS, weekRange, seoulDate, addDays } from '@/lib/weekly-utils.mjs'

export default function WeeklyReport() {
  const params = useSearchParams()
  const initial = params.get('week')
  const [week, setWeek] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(initial || '') && !Number.isNaN(Date.parse(initial)) ? weekRange(initial).start : weekRange().start)
  const [team, setTeam] = useState(false)
  const [data, setData] = useState(null)
  const [content, setContent] = useState({ completed: '', ongoing: '', nextWeek: '', delays: '' })
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true); setError('')
    try {
      const result = await nexusApi(`/api/weekly?week=${week}&team=${team ? 1 : 0}`)
      if (id !== requestId.current) return
      setData(result)
      if (!team) setContent(result.report?.content || result.draft)
      setDirty(false)
    } catch (e) { if (id === requestId.current) setError(e.message) }
    finally { if (id === requestId.current) setLoading(false) }
  }, [week, team])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const switchView = action => { if (!dirty || window.confirm('저장하지 않은 내용이 있습니다. 이동할까요?')) action() }
  const regenerate = async () => {
    if (!window.confirm('현재 작성 내용을 최신 업무 초안으로 바꿀까요?')) return
    setBusy(true)
    try {
      const result = await nexusApi(`/api/weekly?week=${week}`)
      setData(result); setContent(result.draft); setDirty(true)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const save = async action => {
    setBusy(true)
    try {
      const result = await nexusApi('/api/weekly', { action, week, content, version: data.report?.updated_at || null })
      setData(old => ({ ...old, report: result.report })); setDirty(false)
      toast.success(action === 'submit' ? '보고서를 제출했습니다. AI 확인은 AI 팀장에서 이어갈 수 있습니다.' : '초안을 저장했습니다.')
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="no-print flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-indigo-600">기록을 보고로</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold dark:text-white"><FileText className="text-indigo-500" /> 주간보고</h1><p className="mt-2 text-sm text-slate-500">이번 주 업무를 다듬어 제출하고 다음 주 우선순위를 공유합니다.</p></div><div className="flex flex-wrap items-center gap-2"><label className="text-sm text-slate-500">보고 주차 <input aria-label="보고 주차" type="date" value={week} disabled={busy} onChange={e => e.target.value && switchView(() => setWeek(weekRange(e.target.value).start))} className="input-field ml-2" /></label>{data?.isAdmin && <button disabled={busy} className="btn-secondary" onClick={() => switchView(() => { setLoading(true); setData(null); setTeam(v => !v) })}>{team ? '내 보고 작성' : '팀 보고 취합'}</button>}</div></header>
    {error ? <div role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">{error}<button onClick={load} className="btn-secondary ml-3">다시 불러오기</button></div> : loading ? <p className="p-8 text-slate-500">보고서를 불러오는 중…</p> : data && <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800"><div className="text-sm dark:text-slate-200"><strong>{week} ~ {addDays(week, 6)}</strong><span className="ml-3 text-slate-500">{team ? `제출 ${data.reports.length} / 팀원 ${data.members.length}` : dirty ? '저장하지 않은 변경 있음' : data.report?.status === 'submitted' ? '제출 완료' : '초안'}</span></div>{team ? <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> 취합 인쇄 / PDF</button> : <button disabled={busy} className="btn-secondary" onClick={regenerate}><Sparkles size={16} /> 업무 초안 다시 적용</button>}</div>
      {!team && <><div className="no-print rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-slate-600 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-slate-300">완료는 한국시간 완료일 기준입니다. 진행·지연·다음 주 마감은 조회 시점의 업무 상태로 만듭니다. {week !== weekRange(seoulDate()).start && '과거 시점의 업무 상태를 복원하는 기능은 아니므로 과거 주차는 내용을 확인해 주세요.'} 완료일이 없는 기존 업무는 완료 초안에 자동 포함하지 않습니다.</div><div className="grid gap-5 md:grid-cols-2">{REPORT_FIELDS.map(([key, label]) => <label key={key} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><span className="font-bold dark:text-white">{label}</span><textarea disabled={busy} maxLength={12000} rows={9} value={content[key] || ''} onChange={e => { setContent({ ...content, [key]: e.target.value }); setDirty(true) }} placeholder="기록이 없으면 직접 작성하세요." className="input-field mt-3 w-full resize-y text-sm leading-6" /></label>)}</div><div className="no-print flex flex-wrap items-center justify-between gap-3"><Link href="/ai" className="text-sm text-indigo-600">AI 후속 질문·확인한 요약 보기 →</Link><div className="flex gap-2"><button disabled={busy} onClick={() => save('save')} className="btn-secondary">{data.report?.status === 'submitted' ? '초안으로 되돌려 저장' : '초안 저장'}</button><button disabled={busy} onClick={() => save('submit')} className="btn-primary">{busy ? '저장 중…' : data.report?.status === 'submitted' ? '수정 내용 제출' : '보고 제출'}</button></div></div></>}
      {team && <div className="report-sheet space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="border-b-2 border-slate-800 pb-4"><h2 className="text-2xl font-bold dark:text-white">원가팀 주간 업무보고</h2><p className="mt-2 text-sm text-slate-500">{week} ~ {addDays(week, 6)} · 제출된 보고와 본인 확인된 AI 요약</p></div><p className="text-sm text-slate-500">미제출: {data.members.filter(m => !data.reports.some(r => r.member_id === m.id)).map(m => m.name).join(', ') || '없음'}</p>{data.reports.map(report => <article key={report.id} className="break-inside-avoid border-b border-slate-200 pb-6 dark:border-slate-700"><h3 className="mb-4 text-lg font-bold dark:text-white">{data.members.find(m => m.id === report.member_id)?.name || `팀원 #${report.member_id}`}</h3><div className="grid gap-4 md:grid-cols-2">{REPORT_FIELDS.map(([key, label]) => <div key={key}><h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{label}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{report.content[key] || '기재 없음'}</p></div>)}</div>{data.reviews.filter(r => r.entity_id === report.id).map(review => <div key={review.id} className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><strong className="text-sm dark:text-white">본인 확인한 AI 요약{review.risk_level === 'high' ? ' · 높은 리스크' : ''}</strong>{[['done','한 일'],['evidence','근거'],['next','다음 할 일'],['risks','리스크']].map(([key,label]) => <p key={key} className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{label}: {review.summary[key]}</p>)}</div>)}</article>)}{!data.reports.length && <p className="py-8 text-center text-slate-400">제출된 보고서가 없습니다.</p>}</div>}
    </>}
    {team && <style jsx global>{`@media print { body * { visibility:hidden !important; } .report-sheet,.report-sheet * { visibility:visible !important; } .report-sheet { position:absolute;left:0;top:0;width:100%;border:0!important;box-shadow:none!important;background:white!important;color:black!important; } .report-sheet * { color:black!important; } .no-print { display:none!important; } @page { margin:12mm; } }`}</style>}
  </div>
}
