'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

// 컴포넌트 임포트 (경로/파일명 정확해야 함)
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Skeleton from '@/components/Skeleton' // 위에서 만든 파일 필수!

import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard'
import TodoListPage from '@/components/TodoListPage'
import ArchivePage from '@/components/ArchivePage'
import CalendarPage from '@/components/CalendarPage'
import MembersPage from '@/components/MembersPage'
import { getSampleData } from '@/lib/sheets'

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  
  const [data, setData] = useState({
    members: [], tasks: [], projects: [], archives: [],
    schedules: [], holidays: [], quickLinks: [], activities: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 로딩 효과를 위한 인위적 지연 (0.5초)
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

  const renderView = () => {
    // 1. 로딩 중일 때 Skeleton 표시 (여기서 Skeleton 파일이 없으면 에러남)
    if (loading) return <Skeleton />

    // 2. 에러 발생 시
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

    // 3. 정상 렌더링
    switch (currentView) {
      case 'dashboard':
        return <Dashboard data={data} onRefresh={loadData} />
      case 'kanban':
        return <KanbanBoard tasks={data.tasks} onRefresh={loadData} />
      case 'todos':
        return <TodoListPage projects={data.projects} onRefresh={loadData} />
      case 'archive':
        return <ArchivePage archives={data.archives} onRefresh={loadData} />
      case 'calendar':
        return <CalendarPage schedules={data.schedules} onRefresh={loadData} />
      case 'members':
        return <MembersPage members={data.members} tasks={data.tasks} projects={data.projects} onRefresh={loadData} />
      default:
        return <Dashboard data={data} onRefresh={loadData} />
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 lg:ml-[240px] flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {renderView()}
        </div>
      </main>
    </div>
  )
}