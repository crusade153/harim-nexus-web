'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TodoListPage from '@/components/TodoListPage'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

function TodosContent() {
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

  const filteredProjects = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.projects
    return data.projects.filter(p => 
      p.제목.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  if (loading || !data) return <Skeleton />

  return <TodoListPage projects={filteredProjects} onRefresh={loadData} />
}

export default function TodosRoutePage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TodosContent />
    </Suspense>
  )
}