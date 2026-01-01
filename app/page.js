'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard'
import TodoListPage from '@/components/TodoListPage' // 위의 1번 파일이 있어야 함
import ArchivePage from '@/components/ArchivePage'   // 위의 2번 파일이 있어야 함
import CalendarPage from '@/components/CalendarPage'
import MembersPage from '@/components/MembersPage'
import { getSampleData } from '@/lib/sheets'

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [data, setData] = useState({
    members: [],
    tasks: [],
    projects: [],
    archives: [],
    schedules: [],
    holidays: [],
    quickLinks: [],
    activities: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const sampleData = getSampleData()
      setData(sampleData)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderView = () => {
    if (loading) {
      return (
        <div className="h-[80vh] flex items-center justify-center">
          <div className="text-slate-400 animate-pulse font-medium">데이터를 불러오는 중...</div>
        </div>
      )
    }

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