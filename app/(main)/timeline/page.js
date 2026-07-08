'use client'
import { useState, useEffect, useMemo } from 'react'
import CompactTimeline from '@/components/CompactTimeline'
import WeeklyBoard from '@/components/WeeklyBoard'
import Skeleton from '@/components/Skeleton'
import { getRealData, getProjectTasks, createTask, updateTask, deleteProject, createProject, updateProject, deleteTask, toggleTaskStatus, createWbsOutlineTasks, bulkUpdateTasks } from '@/lib/sheets'
import { Plus, Folder, Calendar, Edit2, Trash2, X, Save, Clock, LayoutGrid, BarChart3, ChevronDown, UserRound, ClipboardList, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_WBS_DEPTH = 3
const DEFAULT_WBS_TEMPLATE = `기획 | 담당자 | 2026-07-08 | 2026-07-10 | 높음 | 주요
  요구사항 정리 | 담당자 | 2026-07-08 | 2026-07-08
  화면 설계 | 담당자 | 2026-07-09 | 2026-07-10
개발 | 담당자 | 2026-07-11 | 2026-07-20 | 보통 | 주요
  데이터 구조 정의 | 담당자 | 2026-07-11 | 2026-07-12
  WBS 화면 구현 | 담당자 | 2026-07-13 | 2026-07-18
테스트 및 안정화 | 담당자 | 2026-07-21 | 2026-07-24`

function emptyTaskForm(currentUser, selectedProjectId, projects, parentTask = null) {
  const today = new Date().toISOString().split('T')[0]
  return {
    제목: '',
    담당자: currentUser?.이름 || '',
    시작일: today,
    마감일: today,
    내용: '',
    우선순위: '보통',
    프로젝트ID: String(parentTask?.project_id || selectedProjectId || projects[0]?.ID || ''),
    상위업무ID: parentTask ? String(parentTask.id) : '',
    주요업무: false,
    완료기준: '',
    산출물링크: '',
    지연사유: '',
    선행업무ID: ''
  }
}

function parseWbsOutline(text) {
  const lines = String(text || '').split(/\r?\n/)
  const stack = []
  const items = []

  lines.forEach((line) => {
    if (!line.trim()) return
    const indent = (line.match(/^\s*/)?.[0] || '').replace(/\t/g, '  ').length
    const depth = Math.min(MAX_WBS_DEPTH, Math.floor(indent / 2))
    const parts = line.trim().split('|').map(v => v.trim())
    const title = parts[0]
    if (!title) return

    while (stack.length > depth) stack.pop()
    const parentIndex = stack.length ? stack[stack.length - 1] : null
    const index = items.length
    items.push({
      index,
      parentIndex,
      title,
      assignee: parts[1] || '',
      startDate: parts[2] || '',
      dueDate: parts[3] || parts[2] || '',
      priority: parts[4] || '보통',
      isKey: /주요|key/i.test(parts[5] || ''),
      order: index
    })
    stack[depth] = index
    stack.length = depth + 1
  })

  return items
}

function toLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseProjectPeriod(period, createdAt) {
  const matches = [...String(period || '').matchAll(/(\d{4})\s*[.\-/년]\s*(\d{1,2})(?:\s*[.\-/월]\s*(\d{1,2}))?/g)]
  if (matches.length === 0) return null

  const toDate = (match, isEnd) => {
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const hasDay = Boolean(match[3])
    const day = hasDay ? Number(match[3]) : (isEnd ? new Date(year, month + 1, 0).getDate() : 1)
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const end = toDate(matches[matches.length - 1], true)
  const start = matches.length > 1
    ? toDate(matches[0], false)
    : (createdAt ? toLocalDay(new Date(createdAt)) : null)

  if (!start || !end || Number.isNaN(start.getTime()) || end < start) return null

  const today = toLocalDay(new Date())
  const totalDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1)
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today - start) / DAY_MS) + 1))
  const progress = Math.round((elapsedDays / totalDays) * 100)
  const remainingDays = Math.max(0, Math.ceil((end - today) / DAY_MS))

  return {
    progress,
    remainingLabel: today < start ? '시작 전' : today > end ? '기간 종료' : `D-${remainingDays}`,
  }
}

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

  const [taskForm, setTaskForm] = useState(emptyTaskForm(null, null, []))
  const [projectForm, setProjectForm] = useState({ 제목: '', 기간: '', 문제점: '', 개선방향: '', 개선목표: '' })
  const [showQuickInput, setShowQuickInput] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState([])
  const [bulkForm, setBulkForm] = useState({ 담당자명: '', 시작일: '', 마감일: '', 우선순위: '', 상태: '', 주요업무: '' })

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

  // parentTask: 간트 행의 '하위 업무 추가' 버튼으로 열릴 때 상위 업무를 미리 지정
  const handleOpenTaskModal = (task = null, parentTask = null) => {
    if (!task && parentTask) {
      const parentInfo = allTasks.find(t => String(t.ID) === String(parentTask.id))
      const parentDepth = parentInfo ? wbsTree.byId.get(String(parentInfo.ID))?.depth : null
      if (parentDepth !== null && parentDepth >= MAX_WBS_DEPTH) {
        toast.error('레벨4 업무 아래에는 하위 TASK를 추가할 수 없습니다.')
        return
      }
    }

    if (task) {
      setEditingTask(task)
      setTaskForm({
        제목: task.title || task.name,
        담당자: task.assignee || task.담당자명 || currentUser?.이름,
        시작일: task.start_date ? task.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
        마감일: task.due_date ? task.due_date.split('T')[0] : new Date().toISOString().split('T')[0],
        내용: task.content || '',
        우선순위: task.priority || '보통',
        프로젝트ID: String(task.project_id || selectedProjectId || projects[0]?.ID || ''),
        상위업무ID: task.parent_id ? String(task.parent_id) : '',
        주요업무: Boolean(task.is_key_task),
        완료기준: task.acceptance_criteria || '',
        산출물링크: task.deliverable_url || '',
        지연사유: task.delay_reason || '',
        선행업무ID: task.predecessor_id ? String(task.predecessor_id) : ''
      })
    } else {
      setEditingTask(null)
      setTaskForm(emptyTaskForm(currentUser, selectedProjectId, projects, parentTask))
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
      프로젝트ID: String(t.프로젝트ID || ''),
      상위업무ID: t.상위업무ID ? String(t.상위업무ID) : '',
      주요업무: Boolean(t.주요업무),
      완료기준: t.완료기준 || '',
      산출물링크: t.산출물링크 || '',
      지연사유: t.지연사유 || '',
      선행업무ID: t.선행업무ID ? String(t.선행업무ID) : ''
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
        프로젝트ID: projectId,
        상위업무ID: taskForm.상위업무ID || null,
        주요업무: taskForm.주요업무,
        완료기준: taskForm.완료기준,
        산출물링크: taskForm.산출물링크,
        지연사유: taskForm.지연사유,
        선행업무ID: taskForm.선행업무ID || null
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

  const handleCreateOutline = async () => {
    if (!selectedProjectId) return toast.error('프로젝트를 먼저 선택하세요.')
    const items = parseWbsOutline(quickText)
    if (items.length === 0) return toast.error('등록할 WBS 업무를 입력하세요.')

    try {
      await createWbsOutlineTasks(selectedProjectId, items, currentUser?.이름)
      toast.success(`WBS 업무 ${items.length}건을 등록했습니다.`)
      setQuickText('')
      setShowQuickInput(false)
      loadProjects()
      refreshTasks()
    } catch (e) {
      toast.error('빠른 입력 저장 실패')
    }
  }

  const handleBulkApply = async () => {
    if (selectedTaskIds.length === 0) return toast.error('일괄 수정할 업무를 선택하세요.')
    const updates = {}
    if (bulkForm.담당자명) updates.담당자명 = bulkForm.담당자명
    if (bulkForm.시작일) updates.시작일 = bulkForm.시작일
    if (bulkForm.마감일) updates.마감일 = bulkForm.마감일
    if (bulkForm.우선순위) updates.우선순위 = bulkForm.우선순위
    if (bulkForm.상태) updates.상태 = bulkForm.상태
    if (bulkForm.주요업무) updates.주요업무 = bulkForm.주요업무 === 'true'

    if (Object.keys(updates).length === 0) return toast.error('변경할 값을 입력하세요.')

    try {
      await bulkUpdateTasks(selectedTaskIds, updates, currentUser?.이름)
      toast.success(`선택 업무 ${selectedTaskIds.length}건을 수정했습니다.`)
      setSelectedTaskIds([])
      setBulkForm({ 담당자명: '', 시작일: '', 마감일: '', 우선순위: '', 상태: '', 주요업무: '' })
      loadProjects()
      refreshTasks()
    } catch (e) {
      toast.error('일괄 수정 실패')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return toast.error('삭제할 업무를 선택하세요.')

    const selected = new Set(selectedTaskIds.map(String))
    const byId = new Map(tasks.map(t => [String(t.id), t]))
    const childrenByParent = new Map()

    tasks.forEach(t => {
      const parentId = t.parent_id ? String(t.parent_id) : null
      if (!parentId) return
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
      childrenByParent.get(parentId).push(t)
    })

    const hasSelectedAncestor = (task) => {
      let parentId = task.parent_id ? String(task.parent_id) : null
      while (parentId) {
        if (selected.has(parentId)) return true
        parentId = byId.get(parentId)?.parent_id ? String(byId.get(parentId).parent_id) : null
      }
      return false
    }

    const rootTargets = selectedTaskIds
      .map(id => byId.get(String(id)))
      .filter(Boolean)
      .filter(task => !hasSelectedAncestor(task))

    const collectDescendants = (taskId, acc = new Set()) => {
      const kids = childrenByParent.get(String(taskId)) || []
      kids.forEach(child => {
        const childId = String(child.id)
        if (acc.has(childId)) return
        acc.add(childId)
        collectDescendants(childId, acc)
      })
      return acc
    }

    const affected = new Set()
    rootTargets.forEach(task => {
      affected.add(String(task.id))
      collectDescendants(task.id, affected)
    })

    const rootCount = rootTargets.length
    const childCount = Math.max(0, affected.size - rootCount)
    const message = childCount > 0
      ? `선택한 업무 ${rootCount}건과 연결된 하위 업무 ${childCount}건, 총 ${affected.size}건이 삭제됩니다. 계속하시겠습니까?`
      : `선택한 업무 ${rootCount}건을 삭제합니다. 계속하시겠습니까?`

    if (!confirm(message)) return

    try {
      for (const task of rootTargets) {
        await deleteTask(task.id, currentUser?.이름)
      }
      toast.success(`WBS 업무 ${affected.size}건을 삭제했습니다.`)
      setSelectedTaskIds([])
      loadProjects()
      refreshTasks()
    } catch (e) {
      toast.error('선택 업무 삭제 실패')
    }
  }

  const toggleSelectedTask = (taskId) => {
    const id = String(taskId)
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const handleStructureChange = async (action, task) => {
    const targetId = String(task.id)
    const sorted = [...tasks].sort((a, b) => Number(a.wbs_order || 0) - Number(b.wbs_order || 0) || String(a.start_date || '').localeCompare(String(b.start_date || '')))
    const sameParent = sorted.filter(t => String(t.parent_id || '') === String(task.parent_id || ''))
    const index = sameParent.findIndex(t => String(t.id) === targetId)

    try {
      if (action === 'up' || action === 'down') {
        const swapIndex = action === 'up' ? index - 1 : index + 1
        const swapWith = sameParent[swapIndex]
        if (!swapWith) return toast.error(action === 'up' ? '이미 가장 위에 있습니다.' : '이미 가장 아래에 있습니다.')
        await updateTask(task.id, { WBS순서: swapIndex }, currentUser?.이름)
        await updateTask(swapWith.id, { WBS순서: index }, currentUser?.이름)
      }

      if (action === 'indent') {
        const newParent = sameParent[index - 1]
        if (!newParent) return toast.error('바로 위 업무가 있어야 하위로 이동할 수 있습니다.')
        const depth = wbsTree.byId.get(String(newParent.id))?.depth || 0
        if (depth >= MAX_WBS_DEPTH) return toast.error('레벨4 아래로는 이동할 수 없습니다.')
        await updateTask(task.id, { 상위업무ID: newParent.id, WBS순서: 9999 }, currentUser?.이름)
      }

      if (action === 'outdent') {
        if (!task.parent_id) return toast.error('이미 메인 TASK입니다.')
        const parent = tasks.find(t => String(t.id) === String(task.parent_id))
        await updateTask(task.id, { 상위업무ID: parent?.parent_id || null, WBS순서: Number(parent?.wbs_order || 0) + 0.1 }, currentUser?.이름)
      }

      toast.success('WBS 구조가 변경되었습니다.')
      loadProjects()
      refreshTasks()
    } catch (e) {
      toast.error('WBS 구조 변경 실패')
    }
  }

  const handleDeleteTask = async () => {
    if (!editingTask) return
    const editingId = String(editingTask.id || editingTask.ID)
    const childrenByParent = new Map()
    allTasks.forEach(t => {
      const parentId = t.상위업무ID ? String(t.상위업무ID) : null
      if (!parentId) return
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
      childrenByParent.get(parentId).push(t)
    })
    const collectChildren = (parentId) => {
      const directChildren = childrenByParent.get(parentId) || []
      return directChildren.flatMap(child => [child, ...collectChildren(String(child.ID))])
    }
    const subCount = collectChildren(editingId).length
    if (!confirm(subCount > 0 ? `연결된 하위 업무 ${subCount}건도 함께 삭제됩니다. 정말 삭제하시겠습니까?` : '정말 삭제하시겠습니까?')) return
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

  const wbsTree = useMemo(() => {
    const pid = String(taskForm.프로젝트ID || '')
    if (!pid) return { options: [], byId: new Map(), maxDepth: 0 }
    const inProject = allTasks.filter(t => String(t.프로젝트ID) === pid)
    const ids = new Set(inProject.map(t => String(t.ID)))
    const childrenOf = new Map()
    const roots = []
    inProject.forEach(t => {
      const p = t.상위업무ID && ids.has(String(t.상위업무ID)) ? String(t.상위업무ID) : null
      if (p) {
        if (!childrenOf.has(p)) childrenOf.set(p, [])
        childrenOf.get(p).push(t)
      } else roots.push(t)
    })

    const editingId = editingTask ? String(editingTask.id || editingTask.ID) : null
    const getSubtreeHeight = (taskId) => {
      const kids = childrenOf.get(taskId) || []
      if (kids.length === 0) return 0
      return 1 + Math.max(...kids.map(k => getSubtreeHeight(String(k.ID))))
    }
    const subtreeHeight = editingId ? getSubtreeHeight(editingId) : 0

    const out = []
    const byId = new Map()
    let maxDepth = 0
    const walk = (list, depth, insideEditing) => {
      list.forEach(t => {
        const isSelf = String(t.ID) === editingId
        maxDepth = Math.max(maxDepth, depth)
        byId.set(String(t.ID), { ...t, depth })
        if (!isSelf && !insideEditing && depth + 1 + subtreeHeight <= MAX_WBS_DEPTH) out.push({ ...t, depth })
        const kids = childrenOf.get(String(t.ID)) || []
        if (kids.length > 0) walk(kids, depth + 1, insideEditing || isSelf)
      })
    }
    walk(roots, 0, false)
    return { options: out, byId, maxDepth }
  }, [allTasks, taskForm.프로젝트ID, editingTask])

  const parentOptions = wbsTree.options
  const selectedParent = taskForm.상위업무ID ? wbsTree.byId.get(String(taskForm.상위업무ID)) : null
  const nextTaskLevel = selectedParent ? selectedParent.depth + 2 : 1
  const canAddMoreBelow = nextTaskLevel < MAX_WBS_DEPTH + 1

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
        {(() => {
          const project = projects.find(p => p.ID === selectedProjectId)
          if (!project) return null
          const schedule = parseProjectPeriod(project.기간, project.생성일)

          return (
            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-2 md:ml-3 md:border-l md:border-slate-200 md:pl-4 dark:md:border-slate-700">
              <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <Calendar size={14} className="text-indigo-500" />
                <b className="text-slate-500 dark:text-slate-400">기간</b>
                {project.기간 || '미입력'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <UserRound size={14} className="text-indigo-500" />
                <b className="text-slate-500 dark:text-slate-400">작성자</b>
                {project.작성자 || '미지정'}
              </span>
              {schedule ? (
                <div className="flex min-w-[190px] flex-1 items-center gap-2 md:max-w-[300px]">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" title={`기간 진척률 ${schedule.progress}%`}>
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${schedule.progress}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {schedule.progress}% · {schedule.remainingLabel}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">기간 진척률 산정 불가</span>
              )}
            </div>
          )
        })()}
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
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-400 hidden lg:block">
                  붙여넣기 입력 · WBS 번호 · 선택 일괄 변경 지원
                </p>
                <button onClick={() => { setQuickText(DEFAULT_WBS_TEMPLATE); setShowQuickInput(true) }} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Wand2 size={14}/> 템플릿
                </button>
                <button onClick={() => setShowQuickInput(v => !v)} className="btn-secondary text-xs py-1.5 px-2.5">
                  <ClipboardList size={14}/> 빠른 입력
                </button>
                <button onClick={() => handleOpenTaskModal()} className="btn-secondary text-xs py-1.5 px-2.5">
                  <Plus size={14}/> 메인 TASK 추가
                </button>
              </div>
            </div>

            <div className="flex-1 p-4">
               {showQuickInput && (
                 <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                   <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                     <div>
                       <p className="text-sm font-bold text-slate-800 dark:text-slate-100">WBS 빠른 입력</p>
                       <p className="text-xs text-slate-500 dark:text-slate-400">들여쓰기 2칸마다 하위 업무로 등록됩니다. 형식: 업무명 | 담당자 | 시작일 | 마감일 | 우선순위 | 주요</p>
                     </div>
                     <div className="flex gap-2">
                       <button onClick={() => setQuickText(DEFAULT_WBS_TEMPLATE)} className="btn-secondary text-xs py-1.5 px-2.5">예시 채우기</button>
                       <button onClick={handleCreateOutline} className="btn-primary text-xs py-1.5 px-2.5"><Save size={14}/> 등록</button>
                     </div>
                   </div>
                   <textarea
                     className="h-44 w-full resize-y rounded-lg border border-indigo-100 bg-white p-3 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-500/20 dark:bg-slate-900 dark:text-slate-100"
                     value={quickText}
                     onChange={e => setQuickText(e.target.value)}
                     placeholder="예:&#10;기획 | 김팀원 | 2026-07-08 | 2026-07-10 | 높음 | 주요&#10;  요구사항 정리 | 김팀원 | 2026-07-08 | 2026-07-08"
                   />
                 </div>
               )}

               <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
                 <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                   <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                     선택 업무 일괄 관리 <span className="text-indigo-600">{selectedTaskIds.length}</span>건
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => setSelectedTaskIds(tasks.map(t => String(t.id)))} className="btn-secondary text-xs py-1.5 px-2.5">전체 선택</button>
                     <button onClick={() => setSelectedTaskIds([])} className="btn-secondary text-xs py-1.5 px-2.5">선택 해제</button>
                     <button onClick={handleBulkApply} className="btn-primary text-xs py-1.5 px-2.5">일괄 적용</button>
                     <button onClick={handleBulkDelete} className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20">
                       <Trash2 size={14}/> 선택 삭제
                     </button>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
                   <input className="input-field" placeholder="담당자" value={bulkForm.담당자명} onChange={e => setBulkForm({...bulkForm, 담당자명: e.target.value})} />
                   <input type="date" className="input-field" value={bulkForm.시작일} onChange={e => setBulkForm({...bulkForm, 시작일: e.target.value})} />
                   <input type="date" className="input-field" value={bulkForm.마감일} onChange={e => setBulkForm({...bulkForm, 마감일: e.target.value})} />
                   <select className="input-field" value={bulkForm.우선순위} onChange={e => setBulkForm({...bulkForm, 우선순위: e.target.value})}>
                     <option value="">우선순위 유지</option><option>낮음</option><option>보통</option><option>높음</option>
                   </select>
                   <select className="input-field" value={bulkForm.상태} onChange={e => setBulkForm({...bulkForm, 상태: e.target.value})}>
                     <option value="">상태 유지</option><option>대기</option><option>진행중</option><option>검토요청</option><option>보류</option><option>완료</option>
                   </select>
                   <select className="input-field" value={bulkForm.주요업무} onChange={e => setBulkForm({...bulkForm, 주요업무: e.target.value})}>
                     <option value="">주요업무 유지</option><option value="true">주요업무 지정</option><option value="false">주요업무 해제</option>
                   </select>
                 </div>
               </div>

               <CompactTimeline
                 tasks={tasks}
                 maxDepth={MAX_WBS_DEPTH}
                 selectedIds={selectedTaskIds}
                 onToggleSelect={toggleSelectedTask}
                 onStructureChange={handleStructureChange}
                 onTaskClick={handleOpenTaskModal}
                 onToggleComplete={handleToggleComplete}
                 onAddSubtask={(parentTask) => handleOpenTaskModal(null, parentTask)}
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
                <select className="w-full input-field" value={taskForm.프로젝트ID} onChange={e => setTaskForm({...taskForm, 프로젝트ID: e.target.value, 상위업무ID: ''})}>
                  <option value="">프로젝트 선택...</option>
                  {projects.map(p => <option key={p.ID} value={p.ID}>{p.제목}</option>)}
                </select>
              </div>

              <div>
                <label className="label-text">상위 TASK (선택)</label>
                <select className="w-full input-field" value={taskForm.상위업무ID} onChange={e => setTaskForm({...taskForm, 상위업무ID: e.target.value})}>
                  <option value="">없음 — 레벨1 메인 TASK</option>
                  {parentOptions.map(t => (
                    <option key={t.ID} value={t.ID}>{'   '.repeat(t.depth)}{t.depth > 0 ? '└ ' : ''}L{t.depth + 1} · {t.제목}</option>
                  ))}
                </select>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <div className="font-bold text-slate-600 dark:text-slate-300">
                    저장 위치: 레벨{nextTaskLevel} {nextTaskLevel === 1 ? '메인 TASK' : '하위 TASK'}
                  </div>
                  <div className="mt-0.5">
                    {selectedParent
                      ? `상위: ${selectedParent.제목} · ${canAddMoreBelow ? `저장 후 그 아래로 ${MAX_WBS_DEPTH + 1 - nextTaskLevel}단계 더 확장 가능` : '레벨4라 더 이상 하위 TASK를 만들 수 없음'}`
                      : `메인 TASK로 등록됩니다. 하위 TASK는 최대 레벨${MAX_WBS_DEPTH + 1}까지 만들 수 있습니다.`}
                  </div>
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

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={taskForm.주요업무}
                    onChange={e => setTaskForm({...taskForm, 주요업무: e.target.checked})}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  이번 주/일일 모니터링 주요업무
                </label>
                <div>
                  <label className="label-text">선행 업무</label>
                  <select className="w-full input-field" value={taskForm.선행업무ID} onChange={e => setTaskForm({...taskForm, 선행업무ID: e.target.value})}>
                    <option value="">없음</option>
                    {allTasks
                      .filter(t => String(t.프로젝트ID) === String(taskForm.프로젝트ID || selectedProjectId) && String(t.ID) !== String(editingTask?.id || editingTask?.ID || ''))
                      .map(t => <option key={t.ID} value={t.ID}>{t.제목}</option>)}
                  </select>
                </div>
              </div>
               
              <div>
                <label className="label-text">상세 내용</label>
                <textarea className="w-full input-field h-24 resize-none" value={taskForm.내용} onChange={e => setTaskForm({...taskForm, 내용: e.target.value})} placeholder="업무 내용을 입력하세요..." />
              </div>

              <div>
                <label className="label-text">완료 기준</label>
                <textarea className="w-full input-field h-20 resize-none" value={taskForm.완료기준} onChange={e => setTaskForm({...taskForm, 완료기준: e.target.value})} placeholder="무엇이 확인되면 완료로 볼지 적어주세요." />
              </div>

              <div>
                <label className="label-text">산출물 링크</label>
                <input className="w-full input-field" value={taskForm.산출물링크} onChange={e => setTaskForm({...taskForm, 산출물링크: e.target.value})} placeholder="문서, 시트, PR, 결과물 URL" />
              </div>

              <div>
                <label className="label-text">지연 사유 / 도움 필요</label>
                <textarea className="w-full input-field h-20 resize-none" value={taskForm.지연사유} onChange={e => setTaskForm({...taskForm, 지연사유: e.target.value})} placeholder="지연 중이거나 의사결정/지원이 필요한 내용을 남깁니다." />
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
