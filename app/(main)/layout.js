'use client'

import { Suspense, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function MainLayout({ children }) {
  const [isSidebarHidden, setIsSidebarHidden] = useState(false)

  useEffect(() => {
    setIsSidebarHidden(localStorage.getItem('nexus_sidebar_hidden') === 'true')
  }, [])

  const toggleSidebar = () => {
    setIsSidebarHidden(prev => {
      const next = !prev
      localStorage.setItem('nexus_sidebar_hidden', String(next))
      return next
    })
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <Sidebar isHidden={isSidebarHidden} onToggleHidden={toggleSidebar} />
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarHidden ? 'lg:ml-0' : 'lg:ml-[240px]'}`}>
        <Suspense fallback={<div className="h-16 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700" />}>
          <Header isSidebarHidden={isSidebarHidden} onToggleSidebar={toggleSidebar} />
        </Suspense>
        <div className="flex-1 p-4 lg:p-8 max-w-[1920px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
