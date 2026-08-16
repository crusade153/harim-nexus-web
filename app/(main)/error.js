'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function MainError({ error, reset }) {
  useEffect(() => { console.error('Nexus 화면 오류:', error) }, [error])
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-950/40"><AlertTriangle size={28} /></div>
        <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">화면을 불러오지 못했습니다</h2>
        <p className="mt-2 text-sm text-slate-500">입력 내용은 유지한 채 다시 시도할 수 있습니다. 문제가 계속되면 관리자에게 발생 시각을 알려주세요.</p>
        <button onClick={reset} className="btn-primary mt-5"><RefreshCw size={16} /> 다시 시도</button>
      </div>
    </div>
  )
}

