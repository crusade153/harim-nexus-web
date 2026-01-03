'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Bell, Settings, Moon, Sun } from 'lucide-react'

export default function Header() {
  const [isDark, setIsDark] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState('')

  // URL에서 초기 검색어 가져오기
  useEffect(() => {
    setSearchValue(searchParams.get('search') || '')
  }, [searchParams])

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

  // ✅ [변경] URL 쿼리 업데이트
  const handleSearch = (e) => {
    const value = e.target.value
    setSearchValue(value)
    
    // URL 업데이트 (페이지 이동 없음, 쿼리만 변경)
    if (value) {
      router.push(`?search=${value}`)
    } else {
      router.push('?') // 검색어 삭제 시 쿼리 제거 (현재 페이지 유지)
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 h-16 px-6 lg:px-8 transition-colors duration-200">
      <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto">
        
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">Harim Foods</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span>원가팀</span>
        </div>

        <div className="flex-1 max-w-md mx-4 lg:mx-8">
          <div className="relative group">
            <input
              type="text"
              value={searchValue}
              onChange={handleSearch}
              placeholder="검색 (업무, 게시글, 아카이브)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm 
                         focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 
                         focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-white"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500" size={16} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </header>
  )
}