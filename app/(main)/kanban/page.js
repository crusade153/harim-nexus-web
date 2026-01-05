'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import KanbanBoard from '@/components/KanbanBoard'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' 

function KanbanContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  
  // ✅ 로딩 상태 관리
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const loadData = async () => {
    const dbData = await getRealData() 
    setData(dbData)
    setIsInitialLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredTasks = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.tasks
    return data.tasks.filter(t => 
      t.제목.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.담당자명.includes(searchTerm)
    )
  }, [data, searchTerm])

  if (isInitialLoading || !data) return <Skeleton />

  return (
    <KanbanBoard 
      tasks={filteredTasks} 
      archives={data.archives} 
      currentUser={data.currentUser} // ✅ 유저 정보 전달
      onRefresh={loadData} 
    />
  )
}

export default function KanbanPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <KanbanContent />
    </Suspense>
  )
}