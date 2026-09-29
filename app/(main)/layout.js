'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import SectionTabs from '@/components/SectionTabs'
import CompletionCheckHost from '@/components/CompletionCheck'
import { PresenceProvider } from '@/components/PresenceProvider'
import { supabase } from '@/lib/supabase'

export default function MainLayout({ children }) {
  const router = useRouter()
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [member, setMember] = useState(null)

  useEffect(() => {
    setIsSidebarHidden(localStorage.getItem('nexus_sidebar_hidden') === 'true')

    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: member } = await supabase
        .from('members')
        .select('id,name,position,login_id,role,approved,status')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (!member || member.approved !== true || member.status === 'pending') {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }
      setMember(member)
      setAuthChecked(true)
    }
    checkAccess()
  }, [router])

  const toggleSidebar = () => {
    setIsSidebarHidden(prev => {
      const next = !prev
      localStorage.setItem('nexus_sidebar_hidden', String(next))
      return next
    })
  }

  if (!authChecked || !member) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-sm text-slate-500">로그인 상태를 확인하고 있습니다...</div>
  }

  return (
    <PresenceProvider member={member}>
    <div className="nexus-app-shell min-h-screen flex transition-colors duration-200">
      <Sidebar member={member} isHidden={isSidebarHidden} onToggleHidden={toggleSidebar} />
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarHidden ? 'lg:ml-0' : 'lg:ml-[240px]'}`}>
        <Suspense fallback={<div className="h-16 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700" />}>
          <Header isSidebarHidden={isSidebarHidden} onToggleSidebar={toggleSidebar} />
        </Suspense>
        <div className="relative mx-4 mt-3 flex h-12 items-center rounded-2xl border border-[#dce8d8] bg-[#eef4e9] px-4 text-xs font-bold text-[#397969] dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-300 lg:hidden">원가팀 업무공간<img src="/nexus-mascot-peek.webp" alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-4 h-16 w-auto" /></div>
        <div className="flex-1 p-4 lg:p-8 max-w-[1920px] mx-auto w-full">
          <SectionTabs />
          {children}
        </div>
        <footer className="nexus-app-footer mx-auto w-full max-w-[1920px] px-4 pb-5 lg:px-8">Harim Nexus · 원가팀 업무공간</footer>
      </main>
      <CompletionCheckHost />
    </div>
    </PresenceProvider>
  )
}
