'use client'
import { useState, useEffect } from 'react'
import GanttChart from '@/components/GanttChart'
import Skeleton from '@/components/Skeleton'
import { getRealData, getProjectTasks, createTask, updateTask, deleteProject, createProject, updateProject, deleteTask } from '@/lib/sheets'
import { Plus, Folder, Calendar, Edit2, Trash2, X, Save, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TimelinePage() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  
  const [editingTask, setEditingTask] = useState(null)
  const [editingProject, setEditingProject] = useState(null)

  const [taskForm, setTaskForm] = useState({ 제목: '', 담당자: '', 시작일: '', 마감일: '', 내용: '', 우선순위: '보통' })
  const [projectForm, setProjectForm] = useState({ 제목: '', 기간: '' })

  const loadProjects = async () => {
    const data = await getRealData()
    setProjects(data.projects || [])
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
      setProjectForm({ 제목: project.제목, 기간: project.기간 })
    } else {
      setEditingProject(null)
      setProjectForm({ 제목: '', 기간: '' })
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
        우선순위: task.priority || '보통'
      })
    } else {
      const today = new Date().toISOString().split('T')[0]
      setEditingTask(null)
      setTaskForm({ 제목: '', 담당자: currentUser?.이름, 시작일: today, 마감일: today, 내용: '', 우선순위: '보통' })
    }
    setIsTaskModalOpen(true)
  }

  const handleSaveTask = async () => {
    if (!taskForm.제목) return toast.error('업무 제목을 입력하세요.')
    if (!selectedProjectId) return toast.error('선택된 프로젝트가 없습니다.')
    
    try {
      const payload = {
        제목: taskForm.제목,
        담당자명: taskForm.담당자,
        시작일: taskForm.시작일,
        마감일: taskForm.마감일,
        내용: taskForm.내용,
        우선순위: taskForm.우선순위,
        프로젝트ID: selectedProjectId
      }

      if (editingTask) {
        await updateTask(editingTask.id || editingTask.ID, payload, currentUser?.이름)
        toast.success('일정이 수정되었습니다.')
      } else {
        await createTask(payload)
        toast.success('새 일정이 등록되었습니다.')
      }
      setIsTaskModalOpen(false)
      refreshTasks()
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
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">프로젝트별 일정을 계획하고 관리합니다.</p>
        </div>
        <button onClick={() => handleOpenProjectModal()} className="btn-secondary text-xs">
          <Plus size={16}/> 새 프로젝트 생성
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide min-h-[50px]">
        {projects.map(p => (
          <div key={p.ID} className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap border transition-all cursor-pointer ${
            selectedProjectId === p.ID
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`} onClick={() => setSelectedProjectId(p.ID)}>
            <Folder size={16} /> {p.제목}
            
            {selectedProjectId === p.ID && (
               <div className="ml-2 pl-2 border-l border-white/20 flex gap-1">
                 <button onClick={(e) => { e.stopPropagation(); handleOpenProjectModal(p); }} className="p-1 hover:bg-indigo-500 rounded"><Edit2 size={12}/></button>
                 <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.ID); }} className="p-1 hover:bg-indigo-500 rounded"><Trash2 size={12}/></button>
               </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden relative">
        {selectedProjectId ? (
          <>
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
              <div className="flex items-center gap-3">
                <button onClick={() => handleOpenTaskModal()} className="btn-primary py-2 px-4 text-xs font-bold shadow-indigo-100">
                    <Plus size={16}/> 일정 추가
                </button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-1"></div>
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-slate-400"/> 일정 관리 모드
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">
                일정을 클릭하여 수정하거나, 드래그하여 기간을 변경하세요.
              </p>
            </div>
            
            <div className="flex-1 overflow-auto p-4 min-h-[400px]">
               <GanttChart 
                 tasks={tasks} 
                 onTaskChange={refreshTasks} 
                 onTaskClick={onGanttTaskClick} 
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

      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold mb-4 dark:text-white">{editingProject ? '프로젝트 수정' : '새 프로젝트'}</h3>
            <input className="w-full input-field mb-3" placeholder="프로젝트 명" value={projectForm.제목} onChange={e => setProjectForm({...projectForm, 제목: e.target.value})} />
            <input className="w-full input-field mb-6" placeholder="기간 (예: 2026.01 ~ 2026.12)" value={projectForm.기간} onChange={e => setProjectForm({...projectForm, 기간: e.target.value})} />
            <div className="flex gap-2">
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