'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TodoListPage from '@/components/TodoListPage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets'

function TodosContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const loadData = async () => {
    const dbData = await getRealData()
    setData(dbData)
    setIsInitialLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredProjects = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.projects
    return data.projects.filter(p => 
      p.제목.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  if (isInitialLoading || !data) return <Skeleton />

  // 🔥 [핵심 수정] currentUser={data.currentUser} 추가됨!
  return (
    <TodoListPage 
      projects={filteredProjects} 
      currentUser={data.currentUser} 
      onRefresh={loadData} 
    />
  )
}

export default function TodosRoutePage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TodosContent />
    </Suspense>
  )
}