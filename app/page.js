'use client'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Skeleton from '@/components/Skeleton'

import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard'
import TodoListPage from '@/components/TodoListPage'
import ArchivePage from '@/components/ArchivePage'
import CalendarPage from '@/components/CalendarPage'
import MembersPage from '@/components/MembersPage'
import BoardPage from '@/components/BoardPage'

import { getSampleData } from '@/lib/sheets'

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [searchTerm, setSearchTerm] = useState('') // ✅ [추가] 검색어 상태
  
  const [data, setData] = useState({
    currentUser: null, // ✅ [추가] 사용자 정보 포함
    members: [], tasks: [], projects: [], archives: [],
    schedules: [], holidays: [], quickLinks: [], activities: [],
    posts: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      await new Promise(resolve => setTimeout(resolve, 500))
      const sampleData = getSampleData()
      setData(sampleData)
    } catch (err) {
      console.error(err)
      setError('데이터를 불러오는 중 문제가 발생했습니다.')
      toast.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  // ✅ [추가] 검색 로직 (Client-side Search)
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data

    const lowerTerm = searchTerm.toLowerCase()
    
    // 각 데이터 배열 필터링
    return {
      ...data,
      tasks: data.tasks.filter(t => t.제목.toLowerCase().includes(lowerTerm) || t.담당자명.includes(lowerTerm)),
      posts: data.posts.filter(p => p.제목.toLowerCase().includes(lowerTerm) || p.내용.toLowerCase().includes(lowerTerm)),
      archives: data.archives.filter(a => a.제목.toLowerCase().includes(lowerTerm)),
      projects: data.projects.filter(p => p.제목.toLowerCase().includes(lowerTerm))
    }
  }, [data, searchTerm])

  const renderView = () => {
    if (loading) return <Skeleton />

    if (error) {
      return (
        <div className="h-[70vh] flex flex-col items-center justify-center text-slate-400">
          <AlertTriangle size={48} className="mb-4 text-red-400" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">오류가 발생했습니다</h3>
          <p className="text-sm mb-6">{error}</p>
          <button onClick={loadData} className="btn-primary flex items-center gap-2">
            <RefreshCcw size={16} /> 다시 시도
          </button>
        </div>
      )
    }

    // ✅ [변경] 필터링된 데이터(filteredData)와 사용자 정보(currentUser) 전달
    switch (currentView) {
      case 'dashboard':
        return <Dashboard data={filteredData} onRefresh={loadData} />
      case 'kanban':
        return <KanbanBoard tasks={filteredData.tasks} onRefresh={loadData} />
      case 'todos':
        return <TodoListPage projects={filteredData.projects} onRefresh={loadData} />
      case 'board': 
        return <BoardPage posts={filteredData.posts} currentUser={data.currentUser} onRefresh={loadData} />
      case 'archive':
        return <ArchivePage archives={filteredData.archives} onRefresh={loadData} />
      case 'calendar':
        return <CalendarPage schedules={filteredData.schedules} onRefresh={loadData} />
      case 'members':
        return <MembersPage members={data.members} tasks={data.tasks} projects={data.projects} onRefresh={loadData} />
      default:
        return <Dashboard data={filteredData} onRefresh={loadData} />
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 lg:ml-[240px] flex flex-col min-h-screen">
        <Header onSearchChange={setSearchTerm} /> {/* ✅ 검색 핸들러 연결 */}
        <div className="flex-1 p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {renderView()}
        </div>
      </main>
    </div>
  )
}