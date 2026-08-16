'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import WorkHub from '@/components/WorkHub'
import Skeleton from '@/components/Skeleton'

function WorkHubRoute() {
  const searchParams = useSearchParams()
  return (
    <WorkHub
      initialTab={searchParams.get('tab') || 'my'}
      initialQuery={searchParams.get('q') || ''}
    />
  )
}

export default function WorkPage() {
  return <Suspense fallback={<Skeleton />}><WorkHubRoute /></Suspense>
}

