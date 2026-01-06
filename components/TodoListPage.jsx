'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { CheckCircle2, Circle, Calendar, Folder, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { toggleTaskStatus } from '@/lib/sheets' // ✅ tasks 테이블 상태 토글 함수 사용

export default function TodoListPage({ projects = [], currentUser, onRefresh }) {
  const [activeProjectID, setActiveProjectID] = useState(null)
  const [localProjects, setLocalProjects] = useState(projects)

  useEffect(() => { setLocalProjects(projects) }, [projects])
  useEffect(() => { if (!activeProjectID && projects.length > 0) setActiveProjectID(projects[0].ID) }, [projects, activeProjectID])

  const activeProject = localProjects.find(p => p.ID === activeProjectID) || localProjects[0]

  const calculateProgress = (todos) => { 
    if (!todos || todos.length === 0) return 0; 
    const completed = todos.filter(t => t.완료).length; 
    return Math.round((completed / todos.length) * 100) 
  }

  // ✅ 체크 상태 변경 (tasks 테이블의 status 업데이트)
  const handleCheck = async (taskId, currentIsDone) => {
    // 1. 낙관적 UI 업데이트
    const updatedProjects = localProjects.map(p => { 
        if (p.ID === activeProject.ID) { 
            return { 
                ...p, 
                todos: p.todos.map(t => t.ID === taskId ? { ...t, 완료: !currentIsDone } : t) 
            } 
        } 
        return p 
    })
    setLocalProjects(updatedProjects)

    // 2. DB 업데이트
    try { 
        await toggleTaskStatus(taskId, currentIsDone); 
        if (onRefresh) onRefresh() 
    } catch (error) { 
        toast.error('상태 변경 실패')
        setLocalProjects(projects) // 롤백
    }
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 relative">
      {/* 좌측: 프로젝트 목록 */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">To-Do 체크리스트</h2>
        </div>
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          {localProjects.map(project => {
            const progress = calculateProgress(project.todos)
            const isActive = activeProject?.ID === project.ID
            return (
              <div key={project.ID} onClick={() => setActiveProjectID(project.ID)} className={`relative p-4 rounded-xl border cursor-pointer transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold truncate ${isActive ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{project.제목}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3"><Calendar size={12} /> {project.기간 || '기간 미설정'}</div>
                <div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{width: `${progress}%`}} /></div><span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span></div>
              </div>
            )
          })}
        </div>
        
        {/* 안내 메시지 */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-xs text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700">
            💡 프로젝트 생성 및 업무 추가는 <br/>
            <Link href="/timeline" className="text-indigo-600 font-bold hover:underline">프로젝트 타임라인</Link> 메뉴를 이용해주세요.
        </div>
      </div>

      {/* 우측: 할 일 목록 (체크박스) */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col h-[calc(100vh-140px)] shadow-sm">
        {activeProject ? (
          <>
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{activeProject.제목}</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">총 {activeProject.todos?.length || 0}개의 할 일</p>
              </div>
              <div className="text-right">
                  <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{calculateProgress(activeProject.todos)}%</span>
                  <p className="text-xs text-slate-400 uppercase font-bold">완료율</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
              {activeProject.todos?.length > 0 ? activeProject.todos.map(todo => (
                <div key={todo.ID} className="group flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => handleCheck(todo.ID, todo.완료)}>
                    <button className={`transition-colors ${todo.완료 ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                        {todo.완료 ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                    <div>
                        <p className={`font-medium text-sm transition-all ${todo.완료 ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800 dark:text-slate-200'}`}>{todo.항목}</p>
                        <p className="text-xs text-slate-400 mt-0.5 flex gap-2">
                            <span>{todo.담당자}</span>
                            {todo.마감일 && <span>· ~{todo.마감일}</span>}
                        </p>
                    </div>
                  </div>
                  {/* 상태 뱃지 */}
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${todo.완료 ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                    {todo.상태 || (todo.완료 ? '완료' : '대기')}
                  </span>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <p>등록된 할 일이 없습니다.</p>
                    <Link href="/timeline" className="mt-2 text-sm text-indigo-500 flex items-center gap-1 hover:underline">
                        타임라인에서 추가하기 <ArrowRight size={14}/>
                    </Link>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Folder size={48} className="mb-4 opacity-20" />
            <p>프로젝트를 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}