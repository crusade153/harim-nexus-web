'use client'
import { useState, useEffect } from 'react'
import CalendarPage from '@/components/CalendarPage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' // ✅ 진짜 데이터 함수 가져오기

export default function CalendarRoutePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    // ✅ DB에서 진짜 데이터를 가져옵니다
    const dbData = await getRealData()
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading || !data) return <Skeleton />

  return (
    <CalendarPage 
      schedules={data.schedules} 
      tasks={data.tasks} 
      onRefresh={loadData} 
    />
  )
}