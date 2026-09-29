'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Activity, ArchiveRestore, Bell, Bot, BriefcaseBusiness, CheckCircle2, Clock3,
  Download, FileText, FolderSearch2, Goal, Loader2, Plus, RefreshCw, Search,
  Settings2, ShieldCheck, Sparkles, Upload, Webhook
} from 'lucide-react'
import {
  createTaskFromTemplate, getTrash, getWorkHubData, getWorkspaceFileUrl, globalSearch,
  markAllNotificationsRead, markNotificationRead, restoreTrashItem, runAutomation,
  saveAutomation, saveGoal, saveTaskTemplate, saveWebhook, updateWorkspaceSettings,
  uploadWorkspaceFile
} from '@/lib/work-os'
import { classifyDueDate } from '@/lib/work-os-utils.mjs'
import { describeRecurrence, RECURRENCE_EXAMPLES } from '@/lib/recurrence.mjs'
import { entityUrl, TASKS_CHANGED_EVENT } from '@/lib/links'

const tabItems = [
  { id: 'my', label: 'My Work', icon: BriefcaseBusiness },
  { id: 'notifications', label: '알림', icon: Bell },
  { id: 'search', label: '통합검색', icon: FolderSearch2 },
  { id: 'files', label: '파일', icon: FileText },
  { id: 'templates', label: '템플릿', icon: Sparkles },
  { id: 'portfolio', label: '목표·포트폴리오', icon: Goal }
]
const adminTabs = [
  { id: 'automation', label: '자동화·웹훅', icon: Bot },
  { id: 'governance', label: '감사·복구·보안', icon: ShieldCheck }
]

const statusLabels = {
  on_track: '정상', at_risk: '위험', off_track: '이탈', completed: '완료', paused: '보류'
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatBytes(value) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

function SectionTitle({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
      {action}
    </div>
  )
}

export default function WorkHub({ initialTab = 'my', initialQuery = '', adminMode = false }) {
  const router = useRouter()
  const [tab, setTab] = useState(initialTab)
  const dataSurface = adminMode ? (tab === 'governance' ? 'governance' : 'automation') : 'work'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState(initialQuery)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [trash, setTrash] = useState([])
  const loadId = useRef(0)

  useEffect(() => { if (adminMode) setTab(initialTab) }, [adminMode, initialTab])

  const load = useCallback(async () => {
    const currentLoad = ++loadId.current
    setLoading(true)
    setError('')
    try {
      const nextData = await getWorkHubData({ surface: dataSurface, tab })
      if (currentLoad === loadId.current) setData(nextData)
    } catch (loadError) {
      if (currentLoad === loadId.current) setError(loadError.message || '업무 허브를 불러오지 못했습니다.')
    } finally {
      if (currentLoad === loadId.current) setLoading(false)
    }
  }, [dataSurface, tab])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (adminMode) return
    window.addEventListener(TASKS_CHANGED_EVENT, load)
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, load)
  }, [adminMode, load])
  useEffect(() => {
    if (initialQuery.trim().length >= 2) runSearch(initialQuery)
  // 최초 진입 검색어만 처리한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  const runSearch = async (term = query) => {
    if (term.trim().length < 2) return toast.error('두 글자 이상 입력해 주세요.')
    setSearching(true)
    try {
      setSearchResults(await globalSearch(term))
      setTab('search')
    } catch (searchError) {
      toast.error(searchError.message)
    } finally {
      setSearching(false)
    }
  }

  const tasks = useMemo(() => {
    const today = data?.today || ''
    const source = data?.myTasks || []
    return {
      overdue: source.filter(task => classifyDueDate(task.due_date, today) === 'overdue'),
      today: source.filter(task => classifyDueDate(task.due_date, today) === 'today'),
      upcoming: source.filter(task => classifyDueDate(task.due_date, today) === 'upcoming')
    }
  }, [data])

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={30} /></div>
  if (error) return (
    <div className="mx-auto mt-20 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/30">
      <h2 className="font-bold text-rose-700 dark:text-rose-300">업무 허브를 열 수 없습니다</h2>
      <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      <button onClick={load} className="btn-primary mt-5">다시 시도</button>
    </div>
  )

  if (adminMode) return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-8">
      <header><p className="text-sm font-semibold text-indigo-600">관리자</p><h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">관리자 설정</h1><p className="mt-2 text-sm text-slate-500">자동화·웹훅과 감사·복구·보안 정책을 관리합니다.</p></header>
      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="관리자 설정 메뉴">
        {adminTabs.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setTab(item.id); router.replace(`/admin/settings?tab=${item.id}`, { scroll: false }) }} aria-current={tab === item.id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === item.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon size={17} />{item.label}</button> })}
      </nav>
      <main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-7">
        {tab === 'governance' ? <GovernancePanel data={data} trash={trash} setTrash={setTrash} onReload={load} /> : <AutomationPanel data={data} onReload={load} saving={saving} setSaving={setSaving} />}
      </main>
    </div>
  )

  return (
    <div className="mx-auto min-h-full max-w-[1500px] space-y-6 p-4 md:p-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Nexus Work OS</p><h1 className="mt-2 text-2xl font-black md:text-3xl">{data.identity.member.name}님의 업무 허브</h1><p className="mt-2 text-sm text-slate-300">나의 업무, 알림, 파일과 목표를 한곳에서 확인합니다.</p></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="지연" value={tasks.overdue.length} danger />
            <Metric label="오늘" value={tasks.today.length} />
            <Metric label="미확인" value={(data.notifications || []).filter(item => !item.read_at).length} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {tabItems.map(item => {
          const Icon = item.icon
          return <button key={item.id} onClick={() => setTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === item.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon size={17} />{item.label}</button>
        })}
      </div>

      <main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-7">
        {tab === 'my' && <MyWork tasks={tasks} />}
        {tab === 'notifications' && <Notifications data={data} onReload={load} />}
        {tab === 'search' && <SearchPanel query={query} setQuery={setQuery} searching={searching} runSearch={runSearch} results={searchResults} />}
        {tab === 'files' && <FilesPanel files={data.files || []} onReload={load} />}
        {tab === 'templates' && <TemplatesPanel templates={data.templates || []} onReload={load} saving={saving} setSaving={setSaving} />}
        {tab === 'portfolio' && <PortfolioPanel goals={data.goals || []} links={data.goalLinks || []} onReload={load} saving={saving} setSaving={setSaving} />}
      </main>
    </div>
  )
}

function Metric({ label, value, danger = false }) {
  return <div className="min-w-20 rounded-2xl bg-white/10 px-3 py-3 backdrop-blur"><strong className={`block text-2xl ${danger && value ? 'text-rose-300' : 'text-white'}`}>{value}</strong><span className="text-[11px] text-slate-300">{label}</span></div>
}

function MyWork({ tasks }) {
  return <div><SectionTitle title="My Work" description="담당자 ID 기준으로 오늘 처리할 업무와 지연 위험을 구분했습니다." />
    <div className="grid gap-5 xl:grid-cols-3">
      <TaskGroup title="지연 업무" items={tasks.overdue} tone="rose" empty="지연 업무가 없습니다." />
      <TaskGroup title="오늘 마감" items={tasks.today} tone="amber" empty="오늘 마감 업무가 없습니다." />
      <TaskGroup title="예정 업무" items={tasks.upcoming} tone="indigo" empty="예정된 업무가 없습니다." />
    </div>
  </div>
}

function TaskGroup({ title, items, tone, empty }) {
  const tones = { rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300', indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300' }
  return <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-slate-800 dark:text-white">{title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{items.length}</span></div><div className="space-y-2">{items.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-400 dark:bg-slate-800/50">{empty}</p> : items.map(task => <Link key={task.id} href={entityUrl('task', task.id)} className="block rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/20"><div className="flex items-start justify-between gap-3"><strong className="text-sm text-slate-800 dark:text-slate-100">{task.title}</strong><span className="shrink-0 text-[11px] text-slate-400">{formatDate(task.due_date)}</span></div><p className="mt-2 line-clamp-2 text-xs text-slate-500">{task.content || '업무 설명 없음'}</p><div className="mt-3 flex items-center gap-2 text-[11px]"><span className="rounded bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{task.status}</span><span className="text-slate-400">{task.priority}</span></div></Link>)}</div></section>
}

function Notifications({ data, onReload }) {
  const readAll = async () => { try { await markAllNotificationsRead(); toast.success('모든 알림을 확인했습니다.'); onReload() } catch (error) { toast.error(error.message) } }
  const open = async item => { try { if (!item.read_at) await markNotificationRead(item.id); if (item.action_url) window.location.href = item.action_url; else onReload() } catch (error) { toast.error(error.message) } }
  return <div><SectionTitle title="알림함" description="배정, 멘션, 댓글과 자동화 결과를 한곳에서 확인합니다." action={<button onClick={readAll} className="btn-secondary text-sm">모두 읽음</button>} /><div className="space-y-2">{data.notifications.length === 0 ? <Empty text="받은 알림이 없습니다." /> : data.notifications.map(item => <button key={item.id} onClick={() => open(item)} className={`w-full rounded-2xl border p-4 text-left transition hover:border-indigo-300 ${item.read_at ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/20'}`}><div className="flex gap-3"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-slate-300' : 'bg-indigo-500'}`} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><strong className="text-sm text-slate-800 dark:text-white">{item.title}</strong><span className="shrink-0 text-xs text-slate-400">{formatDate(item.created_at)}</span></div><p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.body}</p></div></div></button>)}</div></div>
}

function SearchPanel({ query, setQuery, searching, runSearch, results }) {
  return <div><SectionTitle title="통합검색" description="업무·프로젝트·게시글·아카이브를 제한된 결과 수로 함께 검색합니다." /><form onSubmit={event => { event.preventDefault(); runSearch() }} className="mb-6 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={query} onChange={event => setQuery(event.target.value)} className="input-field w-full pl-10" placeholder="두 글자 이상 입력" /></div><button disabled={searching} className="btn-primary min-w-24">{searching ? <Loader2 className="mx-auto animate-spin" size={18} /> : '검색'}</button></form>{results.length === 0 ? <Empty text="검색어를 입력하면 관련 업무와 지식을 한 번에 찾습니다." /> : <div className="grid gap-3 md:grid-cols-2">{results.map(item => <Link key={`${item.type}-${item.id}`} href={item.url} className="rounded-2xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800"><div className="flex items-center justify-between"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-950/40">{item.typeLabel}</span><span className="text-xs text-slate-400">#{item.id}</span></div><h3 className="mt-3 font-bold text-slate-800 dark:text-white">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.content || item.problem || item.goal || '상세 내용 없음'}</p></Link>)}</div>}</div>
}

function FilesPanel({ files, onReload }) {
  const [uploading, setUploading] = useState(false)
  const upload = async event => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { await uploadWorkspaceFile(file); toast.success('파일을 안전하게 업로드했습니다.'); onReload() } catch (error) { toast.error(error.message) } finally { setUploading(false); event.target.value = '' } }
  const download = async file => { try { window.open(await getWorkspaceFileUrl(file.storage_path), '_blank', 'noopener,noreferrer') } catch (error) { toast.error(error.message) } }
  return <div><SectionTitle title="워크스페이스 파일" description="비공개 Storage와 RLS를 사용하며 다운로드 링크는 60초 동안만 유효합니다." action={<label className="btn-primary cursor-pointer text-sm"><input type="file" className="hidden" onChange={upload} disabled={uploading} /><span className="flex items-center gap-2">{uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}파일 업로드</span></label>} /><div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">{files.length === 0 ? <Empty text="업로드된 파일이 없습니다." /> : files.map(file => <div key={file.id} className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0 dark:border-slate-800"><div className="rounded-xl bg-slate-100 p-3 text-slate-500 dark:bg-slate-800"><FileText size={20} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{file.file_name}</p><p className="mt-1 text-xs text-slate-400">{formatBytes(file.size_bytes)} · v{file.version} · {formatDate(file.created_at)}</p></div><button onClick={() => download(file)} title="다운로드" className="rounded-lg p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950"><Download size={18} /></button></div>)}</div></div>
}

const TRIGGER_GUIDE = [
  { value: 'manual', label: '수동 실행', when: '관리자가 목록의 실행 버튼을 눌렀을 때만 동작합니다.', example: '월마감 안내 알림을 원할 때 실행 버튼으로 발송' },
  { value: 'task_created', label: '업무 생성', when: '화면에서 업무를 만들거나 반복 템플릿이 업무를 만들 때 즉시 동작합니다.', example: '새 업무가 생기면 담당자에게 알림' },
  { value: 'task_status_changed', label: '상태 변경', when: '업무 상태(대기·진행중·검토·완료)를 바꿀 때 즉시 동작합니다.', example: '검토로 바뀌면 알림, 완료되면 웹훅 전송' },
  { value: 'task_due', label: '마감 도래', when: '영업일 아침 8:40(한국시간)에 마감이 오늘(휴일 다음 날은 휴일분 포함)인 미완료 업무마다 한 번씩 동작합니다.', example: '마감일 아침에 담당자에게 “오늘 마감입니다” 알림' }
]
const TRIGGER_LABELS = Object.fromEntries(TRIGGER_GUIDE.map(item => [item.value, item.label]))
const ACTION_LABELS = { notify: '알림', update_task: '업무 상태 변경', webhook: '웹훅' }
const ACTION_PLACEHOLDERS = {
  notify: '알림 본문 (받는 사람: 업무 담당자, 없으면 나)',
  update_task: '{"status":"검토"} — 상태는 대기·진행중·검토·완료 (업무 이벤트에서는 그 업무에 적용)',
  webhook: '{"endpointId":"등록한 웹훅 ID"}'
}

function TemplatesPanel({ templates, onReload, saving, setSaving }) {
  const [form, setForm] = useState({ name: '', description: '', content: '', defaultPriority: '보통', recurrenceRule: '' })
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const save = async event => { event.preventDefault(); setSaving(true); try { await saveTaskTemplate(form); toast.success('템플릿을 저장했습니다.'); setForm({ name: '', description: '', content: '', defaultPriority: '보통', recurrenceRule: '' }); onReload() } catch (error) { toast.error(error.message) } finally { setSaving(false) } }
  const create = async template => { try { await createTaskFromTemplate(template, dueDate); toast.success('템플릿으로 업무를 생성했습니다.'); onReload() } catch (error) { toast.error(error.message) } }
  return <div><SectionTitle title="업무 템플릿·반복 규칙" description="자주 만드는 업무를 템플릿으로 저장해 두고 + 버튼으로 바로 만들거나, 반복 규칙을 넣어 매 영업일 아침 자동으로 만듭니다." /><div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-slate-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-slate-300"><p className="font-bold text-slate-800 dark:text-white">반복 규칙 사용법</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed"><li>칸을 비워 두면 <strong>수동 템플릿</strong>입니다. 카드의 + 버튼으로 원하는 마감일에 업무를 만듭니다.</li><li>반복 규칙을 넣으면 <strong>영업일 아침 8:40(한국시간)</strong>에 서버가 업무를 자동으로 만들고 마감일은 그날입니다. 담당자는 템플릿을 저장한 사람입니다.</li><li>주말·공휴일에 해당하면 다음 영업일에 만듭니다. 같은 이름의 업무가 그날 마감으로 이미 있으면 중복해서 만들지 않습니다.</li><li>사용할 수 있는 형식: {RECURRENCE_EXAMPLES.map(item => <span key={item.rule} className="mr-2 inline-block"><code className="rounded bg-white px-1 py-0.5 dark:bg-slate-900">{item.rule}</code> {item.label}</span>)}</li><li>예: 월요일 아침 주간회의 자료 준비 → <code className="rounded bg-white px-1 py-0.5 dark:bg-slate-900">FREQ=WEEKLY;BYDAY=MO</code></li></ul></div><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><form onSubmit={save} className="space-y-3 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/40"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field w-full" placeholder="템플릿 이름" /><textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="input-field w-full" rows={3} placeholder="업무 설명" /><div className="grid grid-cols-2 gap-2"><select value={form.defaultPriority} onChange={e => setForm({ ...form, defaultPriority: e.target.value })} className="input-field"><option>낮음</option><option>보통</option><option>높음</option><option>긴급</option></select><input value={form.recurrenceRule} onChange={e => setForm({ ...form, recurrenceRule: e.target.value })} className="input-field" placeholder="반복 규칙 (예: FREQ=WEEKLY;BYDAY=MO)" title="비워 두면 수동 템플릿, 입력하면 영업일 아침 자동 생성" /></div><button disabled={saving} className="btn-primary w-full">템플릿 저장</button></form><div><div className="mb-3 flex items-center justify-end gap-2"><label className="text-xs text-slate-500">생성 마감일</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" /></div><div className="grid gap-3 md:grid-cols-2">{templates.length === 0 ? <Empty text="등록된 템플릿이 없습니다." /> : templates.map(template => <div key={template.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-800 dark:text-white">{template.name}</h3><p className="mt-1 text-xs text-slate-500">{template.default_priority}</p><p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${template.recurrence_rule ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{template.recurrence_rule ? `자동 생성 · ${describeRecurrence(template.recurrence_rule) || template.recurrence_rule}` : '수동 템플릿'}</p></div><button onClick={() => create(template)} title="위 마감일로 업무 만들기" className="rounded-lg bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950"><Plus size={17} /></button></div><p className="mt-3 line-clamp-3 text-sm text-slate-500">{template.content || template.description || '설명 없음'}</p></div>)}</div></div></div></div>
}

function PortfolioPanel({ goals, links, onReload, saving, setSaving }) {
  const [form, setForm] = useState({ title: '', description: '', status: 'on_track', progress: 0, dueDate: '' })
  const save = async event => { event.preventDefault(); setSaving(true); try { await saveGoal(form); toast.success('목표를 저장했습니다.'); setForm({ title: '', description: '', status: 'on_track', progress: 0, dueDate: '' }); onReload() } catch (error) { toast.error(error.message) } finally { setSaving(false) } }
  return <div><SectionTitle title="목표·포트폴리오" description="회사 목표에서 프로젝트와 업무까지 진척을 연결하는 기반입니다." /><div className="grid gap-6 lg:grid-cols-[360px_1fr]"><form onSubmit={save} className="space-y-3 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/40"><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field w-full" placeholder="목표 제목" /><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field w-full" rows={3} placeholder="성공 기준" /><div className="grid grid-cols-2 gap-2"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-field">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="input-field" /></div><label className="block text-xs text-slate-500">진척도 {form.progress}%<input type="range" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: e.target.value })} className="mt-2 w-full" /></label><button disabled={saving} className="btn-primary w-full">목표 저장</button></form><div className="space-y-3">{goals.length === 0 ? <Empty text="등록된 목표가 없습니다." /> : goals.map(goal => { const linked = links.filter(item => item.goal_id === goal.id); return <div key={goal.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-bold text-indigo-600">{statusLabels[goal.status]}</span><h3 className="mt-1 font-bold text-slate-900 dark:text-white">{goal.title}</h3><p className="mt-1 text-sm text-slate-500">{goal.description || '설명 없음'}</p></div><span className="text-sm font-black text-slate-700 dark:text-slate-200">{goal.progress}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${goal.progress}%` }} /></div><div className="mt-3 flex justify-between text-xs text-slate-400"><span>연결 항목 {linked.length}개</span><span>{formatDate(goal.due_date)}</span></div></div> })}</div></div></div>
}

function AutomationPanel({ data, onReload, saving, setSaving }) {
  const [form, setForm] = useState({ name: '', triggerType: 'manual', actionType: 'notify', actionConfigText: '' })
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '' })
  const save = async event => { event.preventDefault(); setSaving(true); try { const actionConfig = form.actionType === 'notify' ? { recipientMemberId: data.identity.member.id, title: form.name, body: form.actionConfigText || '자동화 알림입니다.' } : JSON.parse(form.actionConfigText || '{}'); await saveAutomation({ ...form, actionConfig }); toast.success('자동화 규칙을 저장했습니다.'); setForm({ name: '', triggerType: 'manual', actionType: 'notify', actionConfigText: '' }); onReload() } catch (error) { toast.error(error.message) } finally { setSaving(false) } }
  const addWebhook = async event => { event.preventDefault(); try { await saveWebhook({ name: webhookForm.name, url: webhookForm.url }); toast.success('웹훅을 등록했습니다.'); setWebhookForm({ name: '', url: '' }); onReload() } catch (error) { toast.error(error.message) } }
  const run = async id => { try { await runAutomation(id); toast.success('자동화를 실행했습니다.'); onReload() } catch (error) { toast.error(error.message) } }
  return <div><SectionTitle title="자동화·연동" description="'이런 일이 생기면 → 이렇게 처리' 규칙을 만들고 실행 결과를 확인합니다. 웹훅은 HTTPS 및 사설망 차단 검사를 거칩니다." /><div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{TRIGGER_GUIDE.map(item => <div key={item.value} className="rounded-2xl border border-slate-200 p-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800"><p className="text-sm font-bold text-slate-800 dark:text-white">{item.label}</p><p className="mt-1">{item.when}</p><p className="mt-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">예) {item.example}</p></div>)}</div><div className="grid gap-6 xl:grid-cols-[380px_1fr]"><div className="space-y-4"><form onSubmit={save} className="space-y-3 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/40"><div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Bot size={18} />새 자동화</div><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field w-full" placeholder="규칙 이름" /><div className="grid grid-cols-2 gap-2"><select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })} className="input-field">{TRIGGER_GUIDE.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><select value={form.actionType} onChange={e => setForm({ ...form, actionType: e.target.value })} className="input-field"><option value="notify">알림</option><option value="update_task">업무 상태 변경</option><option value="webhook">웹훅</option></select></div><textarea value={form.actionConfigText} onChange={e => setForm({ ...form, actionConfigText: e.target.value })} className="input-field w-full" rows={3} placeholder={ACTION_PLACEHOLDERS[form.actionType]} /><button disabled={saving} className="btn-primary w-full">규칙 저장</button></form><form onSubmit={addWebhook} className="space-y-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Webhook size={18} />웹훅 등록</div><input required value={webhookForm.name} onChange={e => setWebhookForm({ ...webhookForm, name: e.target.value })} className="input-field w-full" placeholder="연동 이름" /><input required type="url" pattern="https://.*" value={webhookForm.url} onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })} className="input-field w-full" placeholder="https://example.com/webhook" /><button className="btn-secondary w-full">엔드포인트 추가</button></form></div><div className="space-y-3">{data.automations.length === 0 ? <Empty text="등록된 자동화가 없습니다." /> : data.automations.map(rule => { const lastRun = data.automationRuns.find(runItem => runItem.rule_id === rule.id); return <div key={rule.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} /><h3 className="font-bold text-slate-900 dark:text-white">{rule.name}</h3></div><p className="mt-2 text-xs text-slate-500">{TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type} → {ACTION_LABELS[rule.action_type] || rule.action_type}</p>{lastRun ? <p className={`mt-1 text-xs ${lastRun.status === 'failed' ? 'text-rose-500' : 'text-slate-400'}`}>최근 실행: {lastRun.status === 'success' ? '성공' : lastRun.status === 'failed' ? '실패' : lastRun.status} · {formatDate(lastRun.started_at)}{lastRun.error_message ? ` · ${lastRun.error_message}` : ''}</p> : <p className="mt-1 text-xs text-slate-300">아직 실행된 적이 없습니다.</p>}</div>{rule.trigger_type === 'manual' ? <button onClick={() => run(rule.id)} className="btn-primary text-sm"><Activity size={15} /> 실행</button> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">자동 실행</span>}</div></div> })}</div></div></div>
}

function GovernancePanel({ data, trash, setTrash, onReload }) {
  const settings = data.settings || {}
  const [settingsForm, setSettingsForm] = useState({ requireMfa: Boolean(settings.require_mfa), allowedEmailDomains: settings.allowed_email_domains || [], sessionTimeoutMinutes: settings.session_timeout_minutes || 480, dataRetentionDays: settings.data_retention_days || 3650, auditRetentionDays: settings.audit_retention_days || 3650 })
  const loadTrash = async () => { try { setTrash(await getTrash()) } catch (error) { toast.error(error.message) } }
  const restore = async item => { try { await restoreTrashItem(item.table, item.id); toast.success('복구했습니다.'); loadTrash(); onReload() } catch (error) { toast.error(error.message) } }
  const saveSettings = async event => { event.preventDefault(); try { await updateWorkspaceSettings(settingsForm); toast.success('보안·보존 정책을 저장했습니다.'); onReload() } catch (error) { toast.error(error.message) } }
  return <div className="space-y-8"><section><SectionTitle title="감사 이력" description="최근 생성·수정·삭제·복구 작업을 서버 감사 트리거로 기록합니다." /><div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/60"><tr><th className="p-3">시각</th><th className="p-3">대상</th><th className="p-3">작업</th><th className="p-3">변경 필드</th></tr></thead><tbody>{data.auditEvents.slice(0, 30).map(event => <tr key={event.id} className="border-t border-slate-100 dark:border-slate-800"><td className="p-3 text-slate-500">{new Date(event.created_at).toLocaleString('ko-KR')}</td><td className="p-3 font-medium text-slate-700 dark:text-slate-200">{event.entity_type} #{event.entity_id}</td><td className="p-3"><span className="rounded bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-950">{event.action}</span></td><td className="p-3 text-xs text-slate-400">{event.changed_fields?.join(', ') || '-'}</td></tr>)}</tbody></table></div></section><section><SectionTitle title="휴지통·복구" description="물리 삭제 대신 보존된 항목을 관리자가 복구합니다." action={<button onClick={loadTrash} className="btn-secondary text-sm"><RefreshCw size={15} /> 불러오기</button>} />{trash.length === 0 ? <Empty text="휴지통을 불러오거나 복구할 항목이 없습니다." /> : <div className="grid gap-2 md:grid-cols-2">{trash.map(item => <div key={`${item.table}-${item.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800"><div><strong className="text-sm text-slate-800 dark:text-white">{item.table} #{item.id}</strong><p className="text-xs text-slate-400">{new Date(item.deleted_at).toLocaleString('ko-KR')}</p></div><button onClick={() => restore(item)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950"><ArchiveRestore size={18} /></button></div>)}</div>}</section><section><SectionTitle title="엔터프라이즈 준비 설정" description="실제 SSO/MFA 강제는 Supabase Auth 공급자 설정과 함께 활성화해야 합니다." /><form onSubmit={saveSettings} className="grid gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-2 dark:bg-slate-800/40"><label className="flex items-center justify-between rounded-xl bg-white p-3 text-sm font-medium dark:bg-slate-900">MFA 요구 준비 상태<input type="checkbox" checked={settingsForm.requireMfa} onChange={e => setSettingsForm({ ...settingsForm, requireMfa: e.target.checked })} className="h-4 w-4" /></label><label className="text-xs text-slate-500">세션 시간(분)<input type="number" min="15" value={settingsForm.sessionTimeoutMinutes} onChange={e => setSettingsForm({ ...settingsForm, sessionTimeoutMinutes: e.target.value })} className="input-field mt-1 w-full" /></label><label className="text-xs text-slate-500">데이터 보존(일)<input type="number" min="30" value={settingsForm.dataRetentionDays} onChange={e => setSettingsForm({ ...settingsForm, dataRetentionDays: e.target.value })} className="input-field mt-1 w-full" /></label><label className="text-xs text-slate-500">감사 이력 보존(일)<input type="number" min="90" value={settingsForm.auditRetentionDays} onChange={e => setSettingsForm({ ...settingsForm, auditRetentionDays: e.target.value })} className="input-field mt-1 w-full" /></label><label className="text-xs text-slate-500 md:col-span-2">허용 이메일 도메인<input value={settingsForm.allowedEmailDomains.join(', ')} onChange={e => setSettingsForm({ ...settingsForm, allowedEmailDomains: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} className="input-field mt-1 w-full" placeholder="company.com, partner.com" /></label><button className="btn-primary md:col-span-2">정책 저장</button></form></section></div>
}

function Empty({ text }) {
  return <div className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-800/40"><CheckCircle2 className="mb-2 text-slate-300" size={24} />{text}</div>
}
