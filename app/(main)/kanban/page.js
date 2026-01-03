'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import KanbanBoard from '@/components/KanbanBoard'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' // ✅ getRealData를 import 합니다

function KanbanContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    // ✅ 여기만 바뀌었습니다! (가짜 데이터 -> 진짜 DB 데이터)
    const dbData = await getRealData() 
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredTasks = useMemo(() => {
    if (!data) return []
    // data.tasks가 DB에서 온 진짜 데이터입니다
    if (!searchTerm.trim()) return data.tasks
    return data.tasks.filter(t => 
      t.제목.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.담당자명.includes(searchTerm)
    )
  }, [data, searchTerm])

  if (loading || !data) return <Skeleton />

  return (
    <KanbanBoard 
      tasks={filteredTasks} 
      archives={data.archives} 
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