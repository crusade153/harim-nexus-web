'use client'
import { useState, useEffect } from 'react'
import CalendarPage from '@/components/CalendarPage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' 

export default function CalendarRoutePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
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
      members={data.members}       // ✅ 추가됨: 팀원 목록 전달
      currentUser={data.currentUser} // ✅ 추가됨: 현재 로그인 유저 전달
      onRefresh={loadData} 
    />
  )
}