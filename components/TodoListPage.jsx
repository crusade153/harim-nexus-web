'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, CheckCircle2, Circle, Calendar, X, FolderPlus, ListPlus } from 'lucide-react' // 아이콘 추가
import { createProject, createTodo, toggleTodo } from '@/lib/sheets' 

export default function TodoListPage({ projects = [], onRefresh }) {
  const [activeProjectID, setActiveProjectID] = useState(projects[0]?.ID || null)
  
  // 모달 상태 관리
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false)

  // 입력 폼 상태 관리
  const [newProject, setNewProject] = useState({ 제목: '', 기간: '' })
  const [newTodo, setNewTodo] = useState({ 항목: '', 담당자: '' })

  // 현재 선택된 프로젝트 찾기
  const activeProject = projects.find(p => p.ID === activeProjectID) || projects[0]
  
  if (!activeProjectID && projects.length > 0) {
    setActiveProjectID(projects[0].ID)
  }

  const calculateProgress = (todos) => {
    if (!todos || todos.length === 0) return 0
    const completed = todos.filter(t => t.완료).length
    return Math.round((completed / todos.length) * 100)
  }

  // ✅ 할 일 완료 토글
  const handleCheck = async (todoId, currentStatus) => {
    try {
      await toggleTodo(todoId, currentStatus)
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('상태 변경 실패')
    }
  }

  // ✅ [New] 프로젝트 저장 핸들러
  const handleSaveProject = async () => {
    if (!newProject.제목.trim()) { toast.error('프로젝트 제목을 입력하세요.'); return }
    
    try {
      await createProject({ 
        제목: newProject.제목, 
        기간: newProject.기간 || '2026.01.01 ~ 2026.12.31' // 기본값
      })
      toast.success('새 프로젝트가 생성되었습니다!')
      setNewProject({ 제목: '', 기간: '' }) // 초기화
      setIsProjectModalOpen(false) // 모달 닫기
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('프로젝트 생성 실패')
      console.error(error)
    }
  }

  // ✅ [New] 할 일 저장 핸들러
  const handleSaveTodo = async () => {
    if (!activeProject) return toast.error('프로젝트를 먼저 선택하세요.')
    if (!newTodo.항목.trim()) { toast.error('할 일을 입력하세요.'); return }

    try {
      await createTodo({ 
        projectID: activeProject.ID, 
        항목: newTodo.항목, 
        담당자: newTodo.담당자 || '유경덕' // 기본값
      })
      toast.success('할 일이 추가되었습니다!')
      setNewTodo({ 항목: '', 담당자: '' }) // 초기화
      setIsTodoModalOpen(false) // 모달 닫기
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('할 일 추가 실패')
      console.error(error)
    }
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 relative">
      
      {/* 1. 좌측: 프로젝트 목록 */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">프로젝트</h2>
          <button 
            onClick={() => setIsProjectModalOpen(true)} // 모달 열기
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
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
                  <h3 className={`font-bold truncate ${isActive ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {project.제목}
                  </h3>
                  {isActive && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
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
            <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              생성된 프로젝트가 없습니다.<br/>
              <button onClick={() => setIsProjectModalOpen(true)} className="text-indigo-500 font-bold mt-2 hover:underline">
                새 프로젝트 만들기
              </button>
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

            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
              {activeProject.todos?.map(todo => (
                <div key={todo.ID} className="group flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                  <div className="flex items-center gap-4 flex-1">
                    <button 
                      onClick={() => handleCheck(todo.ID, todo.완료)} 
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
                onClick={() => setIsTodoModalOpen(true)} // 모달 열기
                className="w-full py-3 mt-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Plus size={18} /> 새 할 일 추가
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <FolderPlus size={48} className="mb-4 opacity-20" />
            <p>좌측에서 프로젝트를 선택하거나 추가하세요.</p>
          </div>
        )}
      </div>

      {/* ================================================================================== */}
      {/* 🟢 [Modal 1] 새 프로젝트 추가 팝업 */}
      {/* ================================================================================== */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsProjectModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <FolderPlus size={20} className="text-indigo-500"/> 새 프로젝트 만들기
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">프로젝트 제목 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newProject.제목} 
                  onChange={(e) => setNewProject({...newProject, 제목: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="예: 1월 정기 결산"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">진행 기간</label>
                <input 
                  type="text" 
                  value={newProject.기간} 
                  onChange={(e) => setNewProject({...newProject, 기간: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="예: 2026.01.01 ~ 2026.01.10"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setIsProjectModalOpen(false)} className="flex-1 btn-secondary">취소</button>
              <button onClick={handleSaveProject} className="flex-1 btn-primary">생성하기</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================================== */}
      {/* 🔵 [Modal 2] 새 할 일 추가 팝업 */}
      {/* ================================================================================== */}
      {isTodoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setIsTodoModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <ListPlus size={20} className="text-indigo-500"/> 새 할 일 추가
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">할 일 내용 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newTodo.항목} 
                  onChange={(e) => setNewTodo({...newTodo, 항목: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="예: 보고서 초안 작성"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">담당자</label>
                <input 
                  type="text" 
                  value={newTodo.담당자} 
                  onChange={(e) => setNewTodo({...newTodo, 담당자: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="이름 입력 (예: 유경덕)"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setIsTodoModalOpen(false)} className="flex-1 btn-secondary">취소</button>
              <button onClick={handleSaveTodo} className="flex-1 btn-primary">추가하기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}