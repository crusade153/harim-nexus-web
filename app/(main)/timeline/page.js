'use client'
import { useState, useEffect } from 'react'
import CompactTimeline from '@/components/CompactTimeline'
import WeeklyBoard from '@/components/WeeklyBoard'
import Skeleton from '@/components/Skeleton'
import { getRealData, getProjectTasks, createTask, updateTask, deleteProject, createProject, updateProject, deleteTask, toggleTaskStatus } from '@/lib/sheets'
import { Plus, Folder, Calendar, Edit2, Trash2, X, Save, Clock, LayoutGrid, BarChart3, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TimelinePage() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [tasks, setTasks] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [view, setView] = useState('weekly') // 'weekly' | 'gantt'

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)

  const [editingTask, setEditingTask] = useState(null)
  const [editingProject, setEditingProject] = useState(null)

  const [taskForm, setTaskForm] = useState({ 제목: '', 담당자: '', 시작일: '', 마감일: '', 내용: '', 우선순위: '보통', 프로젝트ID: '' })
  const [projectForm, setProjectForm] = useState({ 제목: '', 기간: '', 문제점: '', 개선방향: '', 개선목표: '' })

  const loadProjects = async () => {
    const data = await getRealData()
    setProjects(data.projects || [])
    setAllTasks(data.tasks || [])
    setMembers(data.members || [])
    setCurrentUser(data.currentUser)
    if (data.projects?.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data.projects[0].ID)
    }
    setLoading(false)
  }

  useEffect(() => { loadProjects() }, [])

  useEffect(() => {
    if (selectedProjectId) refreshTasks()
  }, [selectedProjectId])

  const refreshTasks = async () => {
    if (!selectedProjectId) return
    const projectTasks = await getProjectTasks(selectedProjectId)
    setTasks(projectTasks)
  }

  const handleOpenProjectModal = (project = null) => {
    if (project) {
      setEditingProject(project)
      setProjectForm({ 제목: project.제목, 기간: project.기간, 문제점: project.문제점 || '', 개선방향: project.개선방향 || '', 개선목표: project.개선목표 || '' })
    } else {
      setEditingProject(null)
      setProjectForm({ 제목: '', 기간: '', 문제점: '', 개선방향: '', 개선목표: '' })
    }
    setIsProjectModalOpen(true)
  }

  const handleSaveProject = async () => {
    if (!projectForm.제목) return toast.error('프로젝트 제목을 입력하세요.')
    try {
      if (editingProject) {
        await updateProject(editingProject.ID, { ...projectForm }, currentUser?.이름)
        toast.success('프로젝트 수정 완료')
      } else {
        await createProject({ ...projectForm, 작성자: currentUser?.이름 })
        toast.success('새 프로젝트 생성 완료')
      }
      setIsProjectModalOpen(false)
      loadProjects()
    } catch (e) { toast.error('저장 실패') }
  }

  const handleDeleteProject = async (id) => {
    if (!confirm('경고: 프로젝트를 삭제하면 포함된 모든 업무와 일정이 영구 삭제됩니다. 진행하시겠습니까?')) return
    try {
      // ✅ [수정] 삭제 시 사용자 이름 전달
      await deleteProject(id, currentUser?.이름)
      toast.success('프로젝트 및 하위 업무가 삭제되었습니다.')
      setSelectedProjectId(null)
      loadProjects()
    } catch (e) { toast.error('삭제 실패 (DB 오류)') }
  }

  const handleOpenTaskModal = (task = null) => {
    if (task) {
      setEditingTask(task)
      setTaskForm({
        제목: task.title || task.name,
        담당자: task.assignee || task.담당자명 || currentUser?.이름,
        시작일: task.start_date ? task.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
        마감일: task.due_date ? task.due_date.split('T')[0] : new Date().toISOString().split('T')[0],
        내용: task.content || '',
        우선순위: task.priority || '보통',
        프로젝트ID: String(task.project_id || selectedProjectId || projects[0]?.ID || '')
      })
    } else {
      const today = new Date().toISOString().split('T')[0]
      setEditingTask(null)
      setTaskForm({ 제목: '', 담당자: currentUser?.이름, 시작일: today, 마감일: today, 내용: '', 우선순위: '보통', 프로젝트ID: String(selectedProjectId || projects[0]?.ID || '') })
    }
    setIsTaskModalOpen(true)
  }

  // 주간 보드에서 막대 클릭 → 가공된(한글 키) 업무를 모달로
  const handleWeeklyTaskClick = (t) => {
    setEditingTask({ id: t.ID, ID: t.ID })
    setTaskForm({
      제목: t.제목 || '',
      담당자: t.담당자명 || currentUser?.이름,
      시작일: t.시작일 ? String(t.시작일).split('T')[0] : new Date().toISOString().split('T')[0],
      마감일: t.마감일 ? String(t.마감일).split('T')[0] : new Date().toISOString().split('T')[0],
      내용: t.내용 || '',
      우선순위: t.우선순위 || '보통',
      프로젝트ID: String(t.프로젝트ID || '')
    })
    setIsTaskModalOpen(true)
  }

  // 막대/체크에서 바로 완료 토글
  const handleToggleComplete = async (taskId, currentIsDone) => {
    try {
      await toggleTaskStatus(taskId, currentIsDone)
      toast.success(currentIsDone ? '진행중으로 변경' : '완료 처리되었습니다')
      loadProjects()
      refreshTasks()
    } catch (e) { toast.error('상태 변경 실패') }
  }

  const handleSaveTask = async () => {
    if (!taskForm.제목) return toast.error('업무 제목을 입력하세요.')
    const projectId = taskForm.프로젝트ID || selectedProjectId
    if (!projectId) return toast.error('프로젝트를 선택하세요.')

    try {
      const payload = {
        제목: taskForm.제목,
        담당자명: taskForm.담당자,
        시작일: taskForm.시작일,
        마감일: taskForm.마감일,
        내용: taskForm.내용,
        우선순위: taskForm.우선순위,
        프로젝트ID: projectId
      }

      if (editingTask) {
        await updateTask(editingTask.id || editingTask.ID, payload, currentUser?.이름)
        toast.success('일정이 수정되었습니다.')
      } else {
        await createTask(payload)
        toast.success('새 일정이 등록되었습니다.')
      }
      setIsTaskModalOpen(false)
      loadProjects()   // 주간 보드(전체 업무) 새로고침
      refreshTasks()   // 간트(선택 프로젝트) 새로고침
    } catch (e) { toast.error('저장 실패') }
  }

  const handleDeleteTask = async () => {
    if (!editingTask) return
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
        // ✅ [수정] 삭제 시 사용자 이름 전달
        await deleteTask(editingTask.id || editingTask.ID, currentUser?.이름)
        toast.success('삭제되었습니다.')
        setIsTaskModalOpen(false)
        loadProjects()
        refreshTasks()
    } catch (e) { toast.error('삭제 실패') }
  }

  const onGanttTaskClick = (task) => {
    const originalTask = tasks.find(t => String(t.id) === task.id)
    if (originalTask) handleOpenTaskModal(originalTask)
  }

  if (loading) return <Skeleton />

  return (
    <div className="h-full flex flex-col space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="text-indigo-600"/> 프로젝트 WBS
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {view === 'weekly' ? '팀원별로 이번 주·오늘 할 일을 한눈에 봅니다.' : '프로젝트별 전체 일정을 계획하고 관리합니다.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 전환 */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs font-bold">
            <button onClick={() => setView('weekly')} className={`px-3 py-2 flex items-center gap-1.5 ${view === 'weekly' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><LayoutGrid size={14}/> 주간 보드</button>
            <button onClick={() => setView('gantt')} className={`px-3 py-2 flex items-center gap-1.5 ${view === 'gantt' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><BarChart3 size={14}/> WBS 간트</button>
          </div>
          <button onClick={() => handleOpenTaskModal()} className="btn-primary text-xs py-2 px-3"><Plus size={16}/> 일정 추가</button>
          <button onClick={() => handleOpenProjectModal()} className="btn-secondary text-xs hidden md:flex">
            <Plus size={16}/> 새 프로젝트
          </button>
        </div>
      </div>

      {view === 'weekly' && (
        <WeeklyBoard
          tasks={allTasks}
          members={members}
          projects={projects}
          currentUser={currentUser}
          onTaskClick={handleWeeklyTaskClick}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {view === 'gantt' && (<>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex items-center">
          <Folder size={16} className="absolute left-3 text-indigo-500 pointer-events-none" />
          <select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="appearance-none pl-9 pr-9 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[260px]"
          >
            {projects.map(p => <option key={p.ID} value={p.ID}>{p.제목}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
        </div>
        {selectedProjectId && (
          <div className="flex items-center gap-1">
            <button onClick={() => handleOpenProjectModal(projects.find(p => p.ID === selectedProjectId))} title="프로젝트 수정" className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-200"><Edit2 size={15}/></button>
            <button onClick={() => handleDeleteProject(selectedProjectId)} title="프로젝트 삭제" className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200"><Trash2 size={15}/></button>
          </div>
        )}
        <span className="text-xs text-slate-400 ml-1">{projects.length}개 프로젝트</span>
      </div>

      {/* 보고 머리말: 문제점 → 개선방향 → 개선목표 */}
      {(() => {
        const cp = projects.find(p => p.ID === selectedProjectId)
        if (!cp) return null
        const has = cp.문제점 || cp.개선방향 || cp.개선목표
        if (!has) {
          return (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 flex items-center justify-between text-sm text-slate-400">
              <span>이 프로젝트의 <b>문제점 · 개선방향 · 개선목표</b>가 아직 없습니다. 보고는 문제점을 명확히 오픈하는 것에서 시작합니다.</span>
              <button onClick={() => handleOpenProjectModal(cp)} className="btn-secondary text-xs whitespace-nowrap"><Edit2 size={14}/> 작성</button>
            </div>
          )
        }
        const items = [
          { n: '1', label: '현재 문제점', val: cp.문제점, color: 'red' },
          { n: '2', label: '개선 방향', val: cp.개선방향, color: 'amber' },
          { n: '3', label: '개선 목표', val: cp.개선목표, color: 'green' },
        ]
        const tone = { red: 'bg-red-50 dark:bg-red-500/10 text-red-600 border-red-100 dark:border-red-500/20', amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-100 dark:border-amber-500/20', green: 'bg-green-50 dark:bg-green-500/10 text-green-600 border-green-100 dark:border-green-500/20' }
        return (
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3">
            {items.map((it, i) => (
              <div key={i} className={`rounded-2xl border p-3.5 ${tone[it.color]}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-5 h-5 rounded bg-white/70 dark:bg-black/20 text-[11px] font-bold flex items-center justify-center">{it.n}</span>
                  <span className="text-xs font-bold uppercase tracking-wide">{it.label}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{it.val || <span className="text-slate-400">— 미작성</span>}</p>
              </div>
            ))}
            <button onClick={() => handleOpenProjectModal(cp)} title="보고 머리말 수정" className="absolute -top-1 right-0 text-slate-400 hover:text-indigo-600 p-1"><Edit2 size={14}/></button>
          </div>
        )
      })()}

      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative">
        {selectedProjectId ? (
          <>
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-slate-400"/> 실행계획 (WBS) · 완료일자 · 담당자
              </span>
              <p className="text-xs text-slate-400 hidden md:block">
                ○ 클릭 = 완료 처리 · 막대 클릭 = 상세 수정
              </p>
            </div>

            <div className="flex-1 p-4">
               <CompactTimeline
                 tasks={tasks}
                 onTaskClick={handleOpenTaskModal}
                 onToggleComplete={handleToggleComplete}
               />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10">
            <Folder size={48} className="mb-4 opacity-20" />
            <p>프로젝트를 선택하거나 새로 생성하세요.</p>
          </div>
        )}
      </div>
      </>)}

      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-bold mb-4 dark:text-white shrink-0">{editingProject ? '프로젝트(보고) 수정' : '새 프로젝트(보고)'}</h3>
            <div className="space-y-3 overflow-y-auto flex-1 p-0.5">
              <div>
                <label className="label-text">프로젝트 명</label>
                <input className="w-full input-field" placeholder="프로젝트 명" value={projectForm.제목} onChange={e => setProjectForm({...projectForm, 제목: e.target.value})} />
              </div>
              <div>
                <label className="label-text">기간</label>
                <input className="w-full input-field" placeholder="예: 2026.01 ~ 2026.12" value={projectForm.기간} onChange={e => setProjectForm({...projectForm, 기간: e.target.value})} />
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="label-text flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-red-100 text-red-600 text-[11px] font-bold flex items-center justify-center">1</span> 현재 문제점</label>
                <textarea className="w-full input-field h-16 resize-none" placeholder="지금 무엇이 문제인가? (현상을 명확히 오픈)" value={projectForm.문제점} onChange={e => setProjectForm({...projectForm, 문제점: e.target.value})} />
              </div>
              <div>
                <label className="label-text flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-100 text-amber-600 text-[11px] font-bold flex items-center justify-center">2</span> 개선 방향</label>
                <textarea className="w-full input-field h-16 resize-none" placeholder="어떤 방향으로 개선할 것인가?" value={projectForm.개선방향} onChange={e => setProjectForm({...projectForm, 개선방향: e.target.value})} />
              </div>
              <div>
                <label className="label-text flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-green-100 text-green-600 text-[11px] font-bold flex items-center justify-center">3</span> 개선 목표</label>
                <textarea className="w-full input-field h-16 resize-none" placeholder="달성하려는 목표는? (가능하면 수치로)" value={projectForm.개선목표} onChange={e => setProjectForm({...projectForm, 개선목표: e.target.value})} />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                ※ <b>실행계획·완료일자·담당자</b>는 저장 후 아래 WBS에 '일정 추가'로 등록합니다. (실행계획=업무, 완료일자=마감일, 담당자=담당자)
              </p>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button onClick={() => setIsProjectModalOpen(false)} className="flex-1 btn-secondary">취소</button>
              <button onClick={handleSaveProject} className="flex-1 btn-primary">저장</button>
            </div>
          </div>
        </div>
      )}

      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                {editingTask ? <Edit2 size={20} className="text-indigo-500"/> : <Plus size={20} className="text-indigo-500"/>}
                {editingTask ? '일정 상세 및 수정' : '새 업무 추가'}
              </h3>
              <button onClick={() => setIsTaskModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
            </div>
            
            <div className="space-y-4 overflow-y-auto flex-1 p-1">
              <div>
                <label className="label-text">업무 제목</label>
                <input className="w-full input-field font-bold text-lg" value={taskForm.제목} onChange={e => setTaskForm({...taskForm, 제목: e.target.value})} autoFocus />
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div>
                    <label className="label-text">시작일 (From)</label>
                    <input type="date" className="w-full bg-transparent outline-none text-sm font-medium dark:text-white" value={taskForm.시작일} onChange={e => setTaskForm({...taskForm, 시작일: e.target.value})} />
                </div>
                <div>
                    <label className="label-text">마감일 (To)</label>
                    <input type="date" className="w-full bg-transparent outline-none text-sm font-medium dark:text-white" value={taskForm.마감일} onChange={e => setTaskForm({...taskForm, 마감일: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="label-text">프로젝트</label>
                <select className="w-full input-field" value={taskForm.프로젝트ID} onChange={e => setTaskForm({...taskForm, 프로젝트ID: e.target.value})}>
                  <option value="">프로젝트 선택...</option>
                  {projects.map(p => <option key={p.ID} value={p.ID}>{p.제목}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label-text">담당자</label>
                    <input className="w-full input-field" value={taskForm.담당자} onChange={e => setTaskForm({...taskForm, 담당자: e.target.value})} />
                </div>
                <div>
                    <label className="label-text">우선순위</label>
                    <select className="w-full input-field" value={taskForm.우선순위} onChange={e => setTaskForm({...taskForm, 우선순위: e.target.value})}>
                        <option>낮음</option><option>보통</option><option>높음</option>
                    </select>
                </div>
              </div>
              
              <div>
                <label className="label-text">상세 내용</label>
                <textarea className="w-full input-field h-24 resize-none" value={taskForm.내용} onChange={e => setTaskForm({...taskForm, 내용: e.target.value})} placeholder="업무 내용을 입력하세요..." />
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              {editingTask ? (
                <button onClick={handleDeleteTask} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
                    <Trash2 size={16}/> 삭제
                </button>
              ) : <div></div>}
              <div className="flex gap-2">
                 <button onClick={() => setIsTaskModalOpen(false)} className="btn-secondary">취소</button>
                 <button onClick={handleSaveTask} className="btn-primary"><Save size={16}/> 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .input-field {
            @apply px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all text-sm;
        }
        .label-text {
            @apply block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase;
        }
      `}</style>
    </div>
  )
}