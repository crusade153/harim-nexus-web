'use client'
import { useState, useEffect } from 'react'
import CalendarPage from '@/components/CalendarPage'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

export default function CalendarRoutePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 500))
    setData(getSampleData())
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