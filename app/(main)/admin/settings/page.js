'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import WorkHub from '@/components/WorkHub'
import Skeleton from '@/components/Skeleton'

function AdminSettingsRoute() {
  const searchParams = useSearchParams()
  return <WorkHub adminMode initialTab={searchParams.get('tab') === 'governance' ? 'governance' : 'automation'} />
}

export default function AdminSettingsPage() {
  return <Suspense fallback={<Skeleton />}><AdminSettingsRoute /></Suspense>
}
