'use client'

import { Suspense } from 'react'
import { redirect, useSearchParams } from 'next/navigation'
import WorkHub from '@/components/WorkHub'
import Skeleton from '@/components/Skeleton'

function WorkHubRoute() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  if (tab === 'automation' || tab === 'governance') redirect(`/admin/settings?tab=${tab}`)
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
