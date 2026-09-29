'use client'
import { useState, useEffect, useCallback } from 'react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import CalendarPage from '@/components/CalendarPage'
import Skeleton from '@/components/Skeleton'
import { getCalendarData } from '@/lib/sheets'

export default function CalendarRoutePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => new Date())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const dbData = await getCalendarData({ from: format(startOfWeek(startOfMonth(month)), 'yyyy-MM-dd'), to: format(endOfWeek(endOfMonth(month)), 'yyyy-MM-dd') })
      setData(dbData)
    } catch (err) {
      setError(err.message || '캘린더를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return <Skeleton />
  if (error) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}<button className="ml-3 underline" onClick={loadData}>다시 불러오기</button></div>
  if (!data) return <Skeleton />

  return (
    <CalendarPage 
      schedules={data.schedules} 
      tasks={data.tasks}
      attendance={data.attendance}
      attendanceAvailable={data.attendanceAvailable}
      members={data.members}
      currentUser={data.currentUser}
      onRefresh={loadData} 
      currentDate={month}
      onMonthChange={setMonth}
    />
  )
}
