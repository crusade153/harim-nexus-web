'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import BoardPage from '@/components/BoardPage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets' // ✅ 여기 수정됨! (getSampleData -> getRealData)

function BoardContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    // ✅ 여기 수정됨! (가짜 데이터 대신 진짜 DB 데이터 가져오기)
    const dbData = await getRealData() 
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredPosts = useMemo(() => {
    if (!data) return []
    // data.posts가 이제 DB에서 온 진짜 데이터입니다
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

export default function BoardRoutePage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <BoardContent />
    </Suspense>
  )
}