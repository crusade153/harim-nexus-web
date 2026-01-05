'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ArchivePage from '@/components/ArchivePage'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets'

function ArchiveContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const [data, setData] = useState(null)
  
  // ✅ 로딩 상태 관리 (깜빡임 방지용)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const loadData = async () => {
    const dbData = await getRealData()
    setData(dbData)
    setIsInitialLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filteredArchives = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.archives
    return data.archives.filter(a => 
      a.제목.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  if (isInitialLoading || !data) return <Skeleton />

  return <ArchivePage archives={filteredArchives} currentUser={data.currentUser} onRefresh={loadData} />
}

export default function ArchiveRoutePage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ArchiveContent />
    </Suspense>
  )
}