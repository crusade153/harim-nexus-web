'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ArchivePage from '@/components/ArchivePage'
import Skeleton from '@/components/Skeleton'
import { getSampleData } from '@/lib/sheets'

function ArchiveContent() {
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

  const filteredArchives = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.archives
    return data.archives.filter(a => 
      a.제목.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  if (loading || !data) return <Skeleton />

  return <ArchivePage archives={filteredArchives} onRefresh={loadData} />
}

export default function ArchiveRoutePage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ArchiveContent />
    </Suspense>
  )
}