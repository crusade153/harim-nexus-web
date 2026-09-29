'use client'
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import KanbanBoard from '@/components/KanbanBoard'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets'
import { TASKS_CHANGED_EVENT } from '@/lib/links' 
import { addDays, seoulDate } from '@/lib/weekly-utils.mjs'

function KanbanContent() {
  const searchParams = useSearchParams()
  const searchTerm = searchParams.get('search') || ''
  const initialTaskId = searchParams.get('task')
  const [data, setData] = useState(null)
  const [completedRange, setCompletedRange] = useState(() => ({ from: addDays(seoulDate(), -29), to: '', undated: false }))
  
  // ✅ 로딩 상태 관리
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const loadData = useCallback(async () => {
    const dbData = await getRealData({ sections: ['tasks', 'archives'], completedRange: { from: completedRange.from, to: completedRange.to ? addDays(completedRange.to, 1) : null, undated: completedRange.undated } })
    setData(dbData)
    setIsInitialLoading(false)
  }, [completedRange])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const reload = () => loadData()
    window.addEventListener(TASKS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, reload)
  }, [loadData])

  const filteredTasks = useMemo(() => {
    if (!data) return []
    if (!searchTerm.trim()) return data.tasks
    return data.tasks.filter(t => 
      t.제목.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.담당자명.includes(searchTerm)
    )
  }, [data, searchTerm])

  if (isInitialLoading || !data) return <Skeleton />

  return (
    <KanbanBoard 
      tasks={filteredTasks} 
      archives={data.archives} 
      currentUser={data.currentUser} // ✅ 유저 정보 전달
      onRefresh={loadData} 
      completedRange={completedRange}
      onCompletedRangeChange={setCompletedRange}
      completedLimitReached={data.completedLimitReached}
      initialTaskId={initialTaskId}
    />
  )
}

export default function KanbanPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <KanbanContent />
    </Suspense>
  )
}
