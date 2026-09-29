'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Bot, ShieldCheck, Settings2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { nexusApi } from '@/lib/nexus-api'
import { entityUrl } from '@/lib/links'

const LABELS = { queued: '질문 시작 전', processing: 'AI 정리 중', questions: '답변 필요', awaiting_confirmation: '요약 확인 필요', confirmed: '본인 확인 완료', failed: '재시도 필요', superseded: '원본 변경됨' }
const SUMMARY = [['done','한 일'],['evidence','근거·산출물'],['next','다음 할 일'],['risks','리스크']]

export default function AiManager() {
  const params = useSearchParams()
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(null)
  const [detail, setDetail] = useState(null)
  const [answers, setAnswers] = useState([])
  const [risk, setRisk] = useState(false)
  const [config, setConfig] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setError('')
      const [list, setup] = await Promise.all([nexusApi(`/api/ai/review?risk=${risk ? 1 : 0}`), nexusApi('/api/ai/settings')])
      setData(list); setSettings(setup)
    } catch (e) { setError(e.message) }
  }, [risk])
  const open = useCallback(async (id, preserveAnswers = false) => {
    setLoadingDetail(true)
    try { setDetail(await nexusApi(`/api/ai/review?id=${id}`)); if (!preserveAnswers) setAnswers([]) } catch (e) { toast.error(e.message) } finally { setLoadingDetail(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const id = Number(params.get('review')); if (id) open(id) }, [params, open])
  const run = async action => {
    setBusy(true)
    let succeeded = false
    try {
      const result = await nexusApi('/api/ai/review', { id: detail.review.id, action, ...(action === 'answer' ? { answers } : {}) })
      succeeded = true
      toast.success(result.message || (action === 'confirm' ? '확정 요약을 공식 기록에 반영했습니다.' : 'AI 검토를 저장했습니다.'))
    } catch (e) { toast.error(e.message) }
    finally { await open(detail.review.id, !succeeded); await load(); setBusy(false) }
  }
  const review = detail?.review
  const last = detail?.messages.filter(m => m.role === 'assistant').at(-1)
  const questions = last?.content?.questions || []
  const enabled = settings?.settings?.ai_enabled && settings?.configured
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium text-indigo-600">기록하고, 질문하고, 확인하기</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold dark:text-white"><Bot className="text-indigo-500" /> AI 팀장</h1><p className="mt-2 text-sm text-slate-500">AI는 질문과 정리를 맡고, 기록의 확정은 내가 합니다.</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={load} className="btn-secondary"><RefreshCw size={16} /> 새로고침</button>{data?.isAdmin && <><button disabled={busy} className="btn-secondary" onClick={() => { setRisk(v => !v); setDetail(null) }}>{risk ? '내 검토 보기' : '높은 리스크 취합'}</button><button disabled={busy} className="btn-secondary" onClick={() => setConfig(v => !v)}><Settings2 size={16} /> 운영 설정</button></>}</div></header>
    {error && <div role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">{error}</div>}
    {config && settings?.isAdmin && <AiSettings initial={settings} onSaved={load} />}
    {settings && !enabled && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{!settings.configured ? '서버의 DeepSeek 모델·API 키 설정이 필요합니다.' : '관리자가 회사 보안 정책을 확인하고 운영 설정에서 외부 전송을 활성화하면 AI 질문을 시작할 수 있습니다.'} 업무·보고 기록은 AI 활성화 여부와 관계없이 저장됩니다.</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.4fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold dark:text-white">{risk ? '본인 확인된 높은 리스크' : '내 확인 목록'} <span className="font-normal text-slate-400">최근 100건</span></h2><div className="mt-4 space-y-2">{data?.reviews.map(r => <button key={r.id} disabled={busy || loadingDetail} onClick={() => open(r.id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-indigo-300 ${review?.id === r.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-100 dark:border-slate-800'}`}><span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{LABELS[r.status]}{r.status === 'confirmed' && r.risk_level === 'high' ? ' · 높은 리스크' : ''}</span><p className="mt-2 break-words text-sm font-medium dark:text-slate-100">{r.source_snapshot.title || `${r.source_snapshot.week_start} 주간보고`}</p><p className="mt-1 text-xs text-slate-400">{r.trigger_type === 'delayed' ? '지연 기록' : r.trigger_type === 'weekly_submitted' ? '주간보고 제출' : '업무 완료'} · 질문 {r.round}/2라운드</p></button>)}{data?.reviews.length === 0 && <p className="py-8 text-center text-sm text-slate-400">확인할 기록이 없습니다.</p>}</div></section>
    <section className="min-h-80 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">{loadingDetail ? <p className="text-sm text-slate-500">기록을 불러오는 중…</p> : !review ? <div className="py-14 text-center"><ShieldCheck className="mx-auto text-indigo-300" size={36} /><h2 className="mt-4 font-bold dark:text-white">확인할 기록을 선택하세요.</h2><p className="mt-2 text-sm leading-6 text-slate-500">업무 완료·지연 기록·주간보고 제출 시 검토가 준비됩니다.<br />최대 두 차례 질문 후 요약을 직접 확인합니다.</p></div> : <div className="space-y-5"><div><p className="text-xs font-semibold text-indigo-600">{LABELS[review.status]}</p><h2 className="mt-2 text-xl font-bold dark:text-white">{review.source_snapshot.title || `${review.source_snapshot.week_start} 주간보고`}</h2><Link href={review.entity_type === 'weekly_report' ? `/weekly?week=${review.source_snapshot.week_start}` : entityUrl('task', review.entity_id)} className="mt-2 inline-block text-sm text-indigo-600">원본 기록 보기 →</Link></div>
      {detail.messages.map(m => <div key={m.id} className={`rounded-xl p-4 ${m.role === 'user' ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-slate-50 dark:bg-slate-800'}`}><strong className="text-xs text-slate-500">{m.role === 'user' ? '내 답변' : 'AI 질문'}</strong>{(m.role === 'user' ? m.content : m.content.questions).map((q,i) => <p key={i} className="mt-2 whitespace-pre-wrap break-words text-sm dark:text-slate-200">{i+1}. {q}</p>)}{m.role === 'assistant' && m.content.questions.length === 0 && <p className="mt-2 text-sm text-slate-500">아래 요약을 확인해 주세요.</p>}</div>)}
      {review.error_message && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{review.error_message} 기록과 답변은 저장되어 있습니다.</p>}
      {review.summary && ['awaiting_confirmation','confirmed'].includes(review.status) && <div className="space-y-4 rounded-xl border border-indigo-100 p-5 dark:border-indigo-900"><h3 className="font-bold dark:text-white">{review.status === 'confirmed' ? '본인 확인한 공식 요약' : '확인 전 AI 요약'}</h3>{SUMMARY.map(([key,label]) => <div key={key}><strong className="text-xs text-indigo-600 dark:text-indigo-300">{label}</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 dark:text-slate-200">{review.summary[key]}</p></div>)}<p className="text-xs text-slate-400">리스크: {{ low:'낮음',medium:'보통',high:'높음' }[review.risk_level]} · {review.model}</p></div>}
      {detail.mine && review.status === 'questions' && <form className="space-y-4" onSubmit={e => { e.preventDefault(); run('answer') }}>{questions.map((q,i) => <label key={`${review.round}-${i}`} className="block text-sm font-medium dark:text-white">{q}<textarea required maxLength={3000} disabled={busy} rows={3} value={answers[i] || ''} onChange={e => setAnswers(old => questions.map((_,j) => j===i ? e.target.value : old[j] || ''))} className="input-field mt-2 w-full" /></label>)}<button disabled={busy || !enabled || questions.some((_,i) => !answers[i]?.trim())} className="btn-primary">{busy ? '답변 저장·정리 중…' : '답변 저장하고 계속'}</button></form>}
      {detail.mine && ['queued','failed','processing'].includes(review.status) && <button disabled={busy || !enabled || (review.status === 'processing' && Date.now()-Date.parse(review.processing_at)<120000)} onClick={() => run('run')} className="btn-primary">{busy ? 'AI 정리 중…' : review.status === 'queued' ? 'AI 질문 시작' : '저장된 기록으로 재시도'}</button>}
      {detail.mine && review.status === 'awaiting_confirmation' && <div><p className="mb-3 text-sm text-slate-500">내용이 정확하면 확인하세요. 수정이 필요하면 원본 기록을 고쳐 새 검토를 진행할 수 있습니다.</p><button disabled={busy} onClick={() => run('confirm')} className="btn-primary">내용 확인 · 공식 기록으로 확정</button></div>}
      {review.status === 'superseded' && <p className="text-sm text-amber-700">원본이 변경되어 이 검토는 공식 기록에서 제외되었습니다. 목록에서 새 검토를 선택하세요.</p>}
      <p className="text-xs leading-5 text-slate-400">질문 시작 시 업무 내용과 답변이 DeepSeek로 전송됩니다. {settings?.settings.ai_mask_numbers ? '숫자 가림이 켜져 있습니다.' : '숫자 가림이 꺼져 있습니다.'} AI는 업무 상태·담당자·마감일을 변경하지 않습니다.</p>
    </div>}</section></div>
  </div>
}

function AiSettings({ initial, onSaved }) {
  const [form, setForm] = useState(initial.settings)
  const [busy, setBusy] = useState(false)
  const save = async e => {
    e.preventDefault(); setBusy(true)
    try { await nexusApi('/api/ai/settings', form); toast.success('AI 운영 설정을 저장했습니다.'); await onSaved() } catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }
  return <form onSubmit={save} className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-6 dark:border-indigo-900 dark:bg-slate-900"><h2 className="text-lg font-bold dark:text-white">관리자 · AI 운영 지침</h2><label className="block text-sm dark:text-slate-200">부재 중 확인할 기준, 질문 방식, 지원·보고 원칙<textarea rows={5} maxLength={6000} value={form.ai_guidelines} onChange={e => setForm({ ...form, ai_guidelines: e.target.value })} className="input-field mt-2 w-full" placeholder="예: 근거와 산출물 링크를 먼저 확인하고, 지원이 필요한 지연은 다음 행동과 담당 협의 내용을 질문하세요." /></label><div className="grid gap-4 md:grid-cols-2"><label className="text-sm dark:text-slate-200">1인 하루 호출 상한<input required type="number" min={1} max={100} value={form.ai_daily_limit} onChange={e => setForm({ ...form, ai_daily_limit: Number(e.target.value) })} className="input-field mt-2 w-full" /></label><label className="text-sm dark:text-slate-200">팀 월 토큰 예산<input required type="number" min={1000} max={100000000} value={form.ai_monthly_token_budget} onChange={e => setForm({ ...form, ai_monthly_token_budget: Number(e.target.value) })} className="input-field mt-2 w-full" /></label></div><label className="flex items-center gap-2 text-sm dark:text-slate-200"><input type="checkbox" checked={form.ai_mask_numbers} onChange={e => setForm({ ...form, ai_mask_numbers: e.target.checked })} /> 외부 전송 전에 숫자 가리기 (이름·본문 전체 익명화 기능은 아닙니다)</label><label className="flex items-start gap-2 text-sm dark:text-slate-200"><input className="mt-1" type="checkbox" checked={form.ai_enabled} onChange={e => setForm({ ...form, ai_enabled: e.target.checked })} /> 회사 보안 정책을 확인했으며, 업무·보고·답변의 DeepSeek 외부 전송을 활성화합니다.</label><p className="text-xs text-slate-500">모델: {initial.model || '서버 DEEPSEEK_MODEL 미설정'} · JSON 재시도도 호출 한도에 포함됩니다. 응답을 확인할 수 없는 실패는 예약 토큰을 보수적으로 유지합니다.</p><button disabled={busy} className="btn-primary">{busy ? '저장 중…' : '운영 설정 저장'}</button></form>
}
