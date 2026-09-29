import AiManager from '@/components/AiManager'
import { Suspense } from 'react'
export default function AiPage() { return <Suspense fallback={<p>비서몬 기록을 불러오는 중…</p>}><AiManager /></Suspense> }
