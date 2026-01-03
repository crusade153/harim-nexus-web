'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, CheckCircle2, Circle, Calendar } from 'lucide-react'
import { createProject, createTodo, toggleTodo } from '@/lib/sheets' // ✅ DB 함수 가져오기

export default function TodoListPage({ projects = [], onRefresh }) {
  const [activeProjectID, setActiveProjectID] = useState(projects[0]?.ID || null)
  
  // 현재 선택된 프로젝트 찾기 (없으면 첫 번째)
  const activeProject = projects.find(p => p.ID === activeProjectID) || projects[0]
  
  // 프로젝트 변경 시 ID 업데이트
  if (!activeProjectID && projects.length > 0) {
    setActiveProjectID(projects[0].ID)
  }

  const calculateProgress = (todos) => {
    if (!todos || todos.length === 0) return 0
    const completed = todos.filter(t => t.완료).length
    return Math.round((completed / todos.length) * 100)
  }

  // ✅ [New] 할 일 완료 토글
  const handleCheck = async (todoId, currentStatus) => {
    try {
      await toggleTodo(todoId, currentStatus)
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('상태 변경 실패')
    }
  }

  // ✅ [New] 새 프로젝트 추가 (입력창 사용)
  const handleAddProject = async () => {
    const title = window.prompt('새 프로젝트 제목을 입력하세요:')
    if (!title) return
    
    const period = window.prompt('기간을 입력하세요 (예: 2026.01.01 ~ 01.31):', '2026.01.01 ~ ')
    
    try {
      await createProject({ 제목: title, 기간: period })
      toast.success('프로젝트가 생성되었습니다!')
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('프로젝트 생성 실패')
      console.error(error)
    }
  }

  // ✅ [New] 새 할 일 추가 (입력창 사용)
  const handleAddTodo = async () => {
    if (!activeProject) return toast.error('프로젝트를 먼저 선택하세요.')

    const content = window.prompt('할 일 내용을 입력하세요:')
    if (!content) return

    const assignee = window.prompt('담당자 이름을 입력하세요:', '유경덕')

    try {
      await createTodo({ 
        projectID: activeProject.ID, 
        항목: content, 
        담당자: assignee 
      })
      toast.success('할 일이 추가되었습니다!')
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('할 일 추가 실패')
      console.error(error)
    }
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      
      {/* 1. 좌측: 프로젝트 목록 */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">프로젝트</h2>
          <button 
            onClick={handleAddProject} // ✅ 연결됨
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)]">
          {projects.map(project => {
            const progress = calculateProgress(project.todos)
            const isActive = activeProject?.ID === project.ID
            return (
              <div 
                key={project.ID}
                onClick={() => setActiveProjectID(project.ID)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isActive 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-bold ${isActive ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {project.제목}
                  </h3>
                  {isActive && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <Calendar size={12} /> {project.기간}
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{width: `${progress}%`}} />
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
                </div>
              </div>
            )
          })}
          {projects.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              생성된 프로젝트가 없습니다.<br/>+ 버튼을 눌러 추가해보세요.
            </div>
          )}
        </div>
      </div>

      {/* 2. 우측: 투두 리스트 상세 */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col h-[calc(100vh-140px)] shadow-sm">
        {activeProject ? (
          <>
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{activeProject.제목}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">작성자: {activeProject.작성자} · 총 {activeProject.todos?.length || 0}개의 할 일</p>
              </div>
              <div className="text-right">
                 <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{calculateProgress(activeProject.todos)}%</span>
                 <p className="text-xs text-slate-400 uppercase font-bold">진행률</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {activeProject.todos?.map(todo => (
                <div key={todo.ID} className="group flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      onClick={() => handleCheck(todo.ID, todo.완료)} // ✅ 연결됨
                      className={`transition-colors ${todo.완료 ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                    >
                      {todo.완료 ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                    <div>
                      <p className={`font-medium text-sm transition-all ${
                        todo.완료 ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {todo.항목}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">담당</span> {todo.담당자}
                    </div>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={handleAddTodo} // ✅ 연결됨
                className="w-full py-3 mt-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Plus size={18} /> 새 할 일 추가
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            👈 왼쪽에서 프로젝트를 추가하거나 선택하세요.
          </div>
        )}
      </div>
    </div>
  )
}