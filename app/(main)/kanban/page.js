'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import KanbanBoard from '@/components/KanbanBoard'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

function KanbanContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 500))
    setData(getSampleData())
    setLoading(false)
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