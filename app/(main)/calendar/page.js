'use client'
import { useState, useEffect } from 'react'
import CalendarPage from '@/components/CalendarPage'
import Skeleton from '@/components/Skeleton'
import { getCalendarData } from '@/lib/sheets'

export default function CalendarRoutePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const dbData = await getCalendarData()
      setData(dbData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  if (loading || !data) return <Skeleton />

  return (
    <CalendarPage 
      schedules={data.schedules} 
      tasks={data.tasks}
      attendance={data.attendance}
      attendanceAvailable={data.attendanceAvailable}
      members={data.members}
      currentUser={data.currentUser}
      onRefresh={loadData} 
    />
  )
}
