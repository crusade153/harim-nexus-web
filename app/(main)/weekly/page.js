import WeeklyReport from '@/components/WeeklyReport'
import { Suspense } from 'react'
export default function WeeklyPage() { return <Suspense fallback={<p>주간보고를 불러오는 중…</p>}><WeeklyReport /></Suspense> }
