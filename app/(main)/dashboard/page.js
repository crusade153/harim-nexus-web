'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' // ✅ getRealData 사용 (중요!)

function DashboardContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    // ✅ 실제 DB 데이터 가져오기
    const dbData = await getRealData()
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredData = useMemo(() => {
    if (!data) return null
    if (!searchTerm.trim()) return data

    const lowerTerm = searchTerm.toLowerCase()
    return {
      ...data,
      tasks: data.tasks.filter(t => t.제목.toLowerCase().includes(lowerTerm) || t.담당자명.includes(lowerTerm)),
      projects: data.projects.filter(p => p.제목.toLowerCase().includes(lowerTerm))
    }
  }, [data, searchTerm])

  if (loading || !filteredData) return <Skeleton />

  return <Dashboard data={filteredData} onRefresh={loadData} />
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DashboardContent />
    </Suspense>
  )
}