'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Skeleton from '@/components/Skeleton'

import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard'
// 🔥 아래 두 줄의 파일명(대소문자)이 실제 파일과 일치해야 합니다!
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
      // 로딩 흉내 (0.5초)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const sampleData = getSampleData()
      setData(sampleData)
    } catch (err) {
      console.error(err)
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const renderView = () => {
    if (loading) return <Skeleton />
    if (error) return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-slate-400">
        <AlertTriangle size={48} className="mb-4 text-red-400"/>
        <p>{error}</p>
        <button onClick={loadData} className="btn-primary mt-4"><RefreshCcw size={16}/> 재시도</button>
      </div>
    )

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