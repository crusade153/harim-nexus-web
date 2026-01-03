'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import BoardPage from '@/components/BoardPage'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

export default function BoardRoutePage() {
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

  const filteredPosts = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.posts
    return data.posts.filter(p => 
      p.제목.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.내용.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  if (loading || !data) return <Skeleton />

  return (
    <BoardPage 
      posts={filteredPosts} 
      currentUser={data.currentUser} 
      onRefresh={loadData} 
    />
  )
}