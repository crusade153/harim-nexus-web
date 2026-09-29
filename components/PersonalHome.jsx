'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Bell, Bot, CheckCircle2, ClipboardList } from 'lucide-react'
import { getWorkHubData, markNotificationRead } from '@/lib/work-os'
import { classifyDueDate } from '@/lib/work-os-utils.mjs'
import { entityUrl, TASKS_CHANGED_EVENT } from '@/lib/links'
import { supabase } from '@/lib/supabase'
import { completeWithCheck } from '@/lib/completion-gate'
import toast from 'react-hot-toast'

export default function PersonalHome() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(null)
  const [completing, setCompleting] = useState(null)
  const load = useCallback(async () => { try { setError(''); setData(await getWorkHubData({ surface: 'home' })) } catch (e) { setError(e.message) } }, [])
  useEffect(() => { load(); window.addEventListener(TASKS_CHANGED_EVENT, load); return () => window.removeEventListener(TASKS_CHANGED_EVENT, load) }, [load])
  const accept = async task => {
    setAccepting(task.id)
    try {
      const result = await supabase.from('tasks').update({ accepted_at: new Date().toISOString() }).eq('id', task.id).eq('assignee_member_id', data.identity.member.id).select('id').single()
      if (result.error) throw result.error
      toast.success('요청을 확인했습니다.'); await load()
    } catch (e) { toast.error(e.message) } finally { setAccepting(null) }
  }
  const complete = async task => {
    setCompleting(task.id)
    try { await completeWithCheck(task.id); await load() }
    catch (e) { e.cancelled ? toast(e.message) : toast.error(e.message) }
    finally { setCompleting(null) }
  }
  if (error) return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{error}<p className="mt-2">DB 업데이트 전이라면 02_p1_phase_a.sql을 적용해 주세요.</p><button className="btn-secondary mt-4" onClick={load}>다시 불러오기</button></div>
  if (!data) return <p className="p-8 text-slate-500">오늘의 업무를 불러오고 있습니다…</p>
  const { myTasks, today, week, identity } = data
  const groups = [
    ['지연', myTasks.filter(t => classifyDueDate(t.due_date, today) === 'overdue'), 'text-rose-600'],
    ['오늘 마감', myTasks.filter(t => classifyDueDate(t.due_date, today) === 'today'), 'text-indigo-600'],
    ['이번 주 남은 일', myTasks.filter(t => t.due_date > today && t.due_date <= week.end), 'text-slate-700 dark:text-slate-200'],
  ]
  const requests = myTasks.filter(t => t.requested_by_member_id && t.requested_by_member_id !== identity.member.id && !t.accepted_at)
  return <div className="mx-auto max-w-7xl space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-indigo-600">{today} · 나의 업무</p><h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{identity.member.name}님, 오늘 할 일을 확인하세요.</h1><p className="mt-2 text-sm text-slate-500">마감과 요청을 챙기고, 한 주의 기록을 보고로 연결합니다.</p></div><Link href="/weekly" className="btn-primary">주간보고 작성 <ArrowUpRight size={16} /></Link></header>
    <div className="grid gap-4 md:grid-cols-3">{groups.map(([label, tasks, color]) => <section key={label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-800 dark:text-white">{label}</h2><span className={`text-3xl font-bold ${color}`}>{tasks.length}</span></div><div className="mt-4 space-y-1">{tasks.length ? tasks.slice(0, 6).map(t => <div key={t.id} className="group flex items-start justify-between gap-3 rounded-lg px-1 py-2 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"><Link href={entityUrl('task', t.id)} className="min-w-0 flex-1 py-1 text-slate-700 dark:text-slate-200">{t.title}</Link><span className="flex shrink-0 items-center gap-2 py-1"><span className="text-xs text-slate-400">{t.due_date?.slice(5)}</span><button disabled={completing !== null} onClick={() => complete(t)} title="AI 친구 점검에 답하고 완료" className="rounded-md border border-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40">완료</button></span></div>) : <p className="py-6 text-sm text-slate-400">해당하는 업무가 없습니다.</p>}{tasks.length > 6 && <Link className="text-sm text-indigo-600" href="/work">전체 {tasks.length}건 보기 →</Link>}</div></section>)}</div>
    {data.truncated && <p className="text-sm text-amber-700">마감일 순으로 최대 100건을 표시합니다. 전체 업무는 업무 보드에서 확인하세요.</p>}
    <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="flex items-center gap-2 text-lg font-bold dark:text-white"><ClipboardList size={20} className="text-indigo-500" /> 요청받은 일 <span className="text-slate-400">{requests.length}</span></h2><div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{requests.length ? requests.map(t => <div key={t.id} className="flex items-center justify-between gap-4 py-3"><Link href={entityUrl('task', t.id)} className="text-sm dark:text-slate-200">{t.title}</Link><button disabled={accepting !== null} onClick={() => accept(t)} className="btn-secondary shrink-0 text-xs">요청 확인</button></div>) : <p className="py-5 text-sm text-slate-400">새로 확인할 요청이 없습니다.</p>}</div></section><div className="space-y-4"><Link href="/weekly" className="block rounded-2xl bg-indigo-600 p-6 text-white transition hover:bg-indigo-700"><div className="flex items-center gap-2"><CheckCircle2 size={20} /><h2 className="font-bold">이번 주 보고</h2></div><p className="mt-4 text-2xl font-bold">{data.report?.status === 'submitted' ? '제출 완료' : data.report ? '초안 작성 중' : '아직 제출 전'}</p><p className="mt-2 text-sm text-indigo-100">{week.start} ~ {week.end} · 업무 기록으로 초안 만들기 →</p></Link><Link href="/ai" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><Bot className="text-indigo-500" /><div><h2 className="font-bold dark:text-white">{data.checkReviewCount !== null ? `검토할 완료 점검 ${data.checkReviewCount}건` : 'AI 친구'}</h2><p className="mt-1 text-sm text-slate-500">{data.checkReviewCount !== null ? `팀원이 답한 완료 점검을 확인하세요.${data.aiCount ? ` · 정리할 보고·지연 기록 ${data.aiCount}건` : ''}` : `완료할 때 AI 친구가 점검을 도와요.${data.aiCount ? ` · 정리할 보고·지연 기록 ${data.aiCount}건` : ''}`}</p></div></Link></div></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between"><h2 className="flex items-center gap-2 text-lg font-bold dark:text-white"><Bell size={20} className="text-indigo-500" /> 최근 알림</h2><Link href="/work?tab=notifications" className="text-sm text-indigo-600">전체 알림 →</Link></div><div className="mt-4 grid gap-2 md:grid-cols-2">{data.notifications.length ? data.notifications.map(n => <Link key={n.id} href={n.action_url?.startsWith('/') && !n.action_url.startsWith('//') ? n.action_url : entityUrl(n.entity_type, n.entity_id)} onClick={() => { markNotificationRead(n.id).then(load).catch(e => toast.error(e.message)) }} className={`rounded-xl p-4 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${n.read_at ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-indigo-50 dark:bg-indigo-950/40'}`}><p className="text-sm font-medium dark:text-slate-200">{n.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.body}</p></Link>) : <p className="py-5 text-sm text-slate-400">받은 알림이 없습니다.</p>}</div></section>
  </div>
}
