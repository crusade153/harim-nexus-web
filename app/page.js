'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard'
import BoardPage from '@/components/BoardPage'
import CalendarPage from '@/components/CalendarPage'
import MembersPage from '@/components/MembersPage'
import { getSampleData } from '@/lib/sheets'

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [data, setData] = useState({
    members: [],
    tasks: [],
    posts: [],
    schedules: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

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
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm font-medium">로딩 중...</p>
          </div>
        </div>
      )
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard data={data} onRefresh={loadData} />
      case 'kanban':
        return <KanbanBoard tasks={data.tasks} onRefresh={loadData} />
      case 'board':
        return <BoardPage posts={data.posts} onRefresh={loadData} />
      case 'calendar':
        return <CalendarPage schedules={data.schedules} onRefresh={loadData} />
      case 'members':
        return <MembersPage members={data.members} onRefresh={loadData} />
      default:
        return <Dashboard data={data} onRefresh={loadData} />
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 lg:ml-64">
        <Header />
        <div className="p-6 lg:p-8">
          {renderView()}
        </div>
      </main>
    </div>
  )
}