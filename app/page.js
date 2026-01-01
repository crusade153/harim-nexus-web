'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Dashboard from '@/components/Dashboard'
import KanbanBoard from '@/components/KanbanBoard' // 기존 유지
import BoardPage from '@/components/BoardPage' // 기존 유지
import CalendarPage from '@/components/CalendarPage' // 기존 유지
import MembersPage from '@/components/MembersPage' // 기존 유지
import WikiPage from '@/components/WikiPage' // [NEW]
import ChecklistPage from '@/components/ChecklistPage' // [NEW]
import { getSampleData } from '@/lib/sheets'

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard')
  const [data, setData] = useState({
    members: [], tasks: [], posts: [], schedules: [], 
    wiki: [], checklist: [], activities: [], quickLinks: []
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
    if (loading) return <div className="h-[80vh] flex items-center justify-center text-slate-400">Loading...</div>

    switch (currentView) {
      case 'dashboard': return <Dashboard data={data} onRefresh={loadData} />
      case 'kanban': return <KanbanBoard tasks={data.tasks} onRefresh={loadData} />
      case 'board': return <BoardPage posts={data.posts} onRefresh={loadData} />
      case 'calendar': return <CalendarPage schedules={data.schedules} onRefresh={loadData} />
      case 'members': return <MembersPage members={data.members} onRefresh={loadData} />
      case 'wiki': return <WikiPage wikiData={data.wiki} onRefresh={loadData} /> // [NEW]
      case 'checklist': return <ChecklistPage checklistData={data.checklist} onRefresh={loadData} /> // [NEW]
      default: return <Dashboard data={data} onRefresh={loadData} />
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50/50">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 lg:ml-[240px]">
        <Header />
        <div className="p-6 lg:p-8 max-w-[1920px] mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  )
}