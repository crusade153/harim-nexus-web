'use client'
import { useState, useEffect } from 'react'
import MembersPage from '@/components/MembersPage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' // ✅ 진짜 데이터 가져오기

export default function MembersRoutePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    // ✅ 실제 DB 데이터 로드
    const dbData = await getRealData()
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading || !data) return <Skeleton />

  return (
    <MembersPage 
      members={data.members} 
      tasks={data.tasks} 
      projects={data.projects} 
      onRefresh={loadData} 
    />
  )
}