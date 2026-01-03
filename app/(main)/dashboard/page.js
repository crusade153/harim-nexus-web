'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

export default function DashboardPage() {
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