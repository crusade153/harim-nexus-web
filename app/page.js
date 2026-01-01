'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast' // 알림 라이브러리
import { AlertTriangle, RefreshCcw } from 'lucide-react'

import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Skeleton from '@/components/Skeleton' // [NEW]

import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard'
import TodoListPage from '@/components/TodoListPage'
import ArchivePage from '@/components/ArchivePage'
import CalendarPage from '@/components/CalendarPage'
import MembersPage from '@/components/MembersPage'
import { getSampleData } from '@/lib/sheets'

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  
  // 데이터 상태
  const [data, setData] = useState({
    members: [], tasks: [], projects: [], archives: [],
    schedules: [], holidays: [], quickLinks: [], activities: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // 에러 상태 추가

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 실제 API 호출 흉내 (0.8초 지연)
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const sampleData = getSampleData()
      if (!sampleData) throw new Error("데이터를 불러올 수 없습니다.")
      
      setData(sampleData)
      // toast.success('데이터 동기화 완료') // 너무 자주 뜨면 귀찮으므로 주석 처리
    } catch (err) {
      console.error('데이터 로드 실패:', err)
      setError('데이터를 불러오는 중 문제가 발생했습니다.')
      toast.error('동기화 실패: 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const renderView = () => {
    // 1. 로딩 상태
    if (loading) return <Skeleton />

    // 2. 에러 상태
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
      case 'dashboard': return <Dashboard data={data} onRefresh={loadData} />
      case 'kanban': return <KanbanBoard tasks={data.tasks} onRefresh={loadData} />
      case 'todos': return <TodoListPage projects={data.projects} onRefresh={loadData} />
      case 'archive': return <ArchivePage archives={data.archives} onRefresh={loadData} />
      case 'calendar': return <CalendarPage schedules={data.schedules} onRefresh={loadData} />
      case 'members': return <MembersPage members={data.members} tasks={data.tasks} projects={data.projects} onRefresh={loadData} />
      default: return <Dashboard data={data} onRefresh={loadData} />
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