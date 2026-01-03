'use client'
import { useState, useEffect } from 'react'
import MembersPage from '@/components/MembersPage'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

export default function MembersRoutePage() {
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
    <MembersPage 
      members={data.members} 
      tasks={data.tasks} 
      projects={data.projects} 
      onRefresh={loadData} 
    />
  )
}