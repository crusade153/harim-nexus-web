'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TodoListPage from '@/components/TodoListPage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' // ✅ 수정됨: 진짜 데이터 함수 가져오기

function TodosContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    // ✅ 수정됨: 가짜 데이터(getSampleData) 대신 진짜 DB 데이터(getRealData) 사용
    const dbData = await getRealData()
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredProjects = useMemo(() => {
    if (!data) return []
    // data.projects가 이제 DB에서 온 진짜 데이터입니다
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