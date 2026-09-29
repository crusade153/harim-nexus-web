'use client'
import { useState, useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'
import ExecutiveReport from '@/components/ExecutiveReport'
import Skeleton from '@/components/Skeleton'
import { getRealData } from '@/lib/sheets'
import { isAdmin as isAdminUser } from '@/lib/roles'


export default function ReportPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const dbData = await getRealData({ sections: ['members', 'tasks', 'projects'] })
    setData(dbData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading || !data) return <Skeleton />

  // 관리자(팀장) 전용 화면
  if (!isAdminUser(data.currentUser)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <ShieldAlert className="text-red-500" size={32} />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">접근 권한이 없습니다</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">경영진 보고 리포트는 팀장(관리자)만 열람할 수 있습니다.</p>
      </div>
    )
  }

  return <ExecutiveReport data={data} />
}
