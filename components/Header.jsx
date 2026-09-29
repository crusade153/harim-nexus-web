'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Bell, Settings, Moon, Sun, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import SettingsModal from './SettingsModal' // ✅ [추가] 모달 import
import { getUnreadNotificationCount } from '@/lib/work-os'
import QuickAdd from './QuickAdd'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { NEXUS_DB_SCHEMA } from '@/lib/db-config'
import OnlinePresence from './OnlinePresence'

export default function Header({ isSidebarHidden = false, onToggleSidebar }) {
  const [isDark, setIsDark] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  
  // ✅ [추가] 설정 모달 상태 관리
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // URL에서 초기 검색어 가져오기
  useEffect(() => {
    setSearchValue(searchParams.get('q') || searchParams.get('search') || '')
  }, [searchParams])

  // 미확인 알림 수: 처음, 1분마다, 창으로 돌아올 때 다시 센다
  useEffect(() => {
    let active = true
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      getUnreadNotificationCount().then(count => { if (active) setUnreadCount(count) })
    }
    refresh()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  // 새 알림 실시간 수신 (Supabase Realtime, RLS 적용). 연결이 끊겨도 위의 1분 갱신이 보완한다.
  useEffect(() => {
    let channel = null
    let cancelled = false
    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: member } = await supabase.from('members').select('id').eq('auth_id', user.id).maybeSingle()
      if (!member || cancelled) return
      channel = supabase.channel(`notifications-${member.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: NEXUS_DB_SCHEMA, table: 'notifications', filter: `recipient_member_id=eq.${member.id}` }, payload => {
          setUnreadCount(count => count + 1)
          if (payload.new?.title) toast(payload.new.title, { icon: '🔔' })
        })
        .subscribe()
    }
    subscribe()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || 
       (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  // 검색어는 입력 중 서버 호출하지 않고 Enter 시 통합검색으로 이동한다.
  const handleSearch = (e) => {
    setSearchValue(e.target.value)
  }

  const submitSearch = (e) => {
    e.preventDefault()
    if (!searchValue.trim()) return
    router.push(`/work?tab=search&q=${encodeURIComponent(searchValue.trim())}`)
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-[#fffdf7]/88 dark:bg-slate-900/85 backdrop-blur-xl border-b border-[#dce8dd] dark:border-slate-700 h-16 pl-16 pr-4 lg:px-8 transition-colors duration-200">
        <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto">
          
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <button
              onClick={onToggleSidebar}
              title={isSidebarHidden ? '사이드바 표시' : '사이드바 숨기기'}
              className="mr-2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              {isSidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <span className="font-medium text-slate-800 dark:text-slate-200">Harim Foods</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span>원가팀</span>
          </div>
          <div className="nexus-header-peek relative hidden h-16 w-16 shrink-0 lg:block" aria-hidden="true"><img src="/nexus-mascot-peek.webp" alt="" className="pointer-events-none absolute -bottom-2 left-0 h-[70px] w-auto max-w-none" /></div>

          <form onSubmit={submitSearch} className="flex-1 max-w-md mx-3 lg:mx-6" role="search">
            <div className="relative group">
              <input
                type="text"
                value={searchValue}
                onChange={handleSearch}
                placeholder="통합검색 후 Enter"
                aria-label="업무, 프로젝트, 게시글, 아카이브 통합검색"
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm 
                           focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 
                           focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500" size={16} />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <OnlinePresence />
            <QuickAdd />
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button onClick={() => router.push('/work?tab=notifications')} aria-label={`알림 ${unreadCount}개`} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
              <Bell size={20} />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            
            {/* ✅ [수정] 설정 버튼에 클릭 이벤트 추가 */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>
      
      {/* ✅ [추가] 설정 모달 렌더링 */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}
