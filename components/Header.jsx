'use client'
import { Search, Bell, Settings } from 'lucide-react'

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 px-6 lg:px-8">
      <div className="flex items-center justify-between h-full max-w-[1600px] mx-auto">
        
        {/* 📍 브레드크럼 (Breadcrumb) */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
          <span className="font-medium text-slate-800">Harim Foods</span>
          <span className="text-slate-300">/</span>
          <span>익산공장 원가팀</span>
        </div>

        {/* 🔍 검색바 */}
        <div className="flex-1 max-w-md mx-4 lg:mx-8">
          <div className="relative group">
            <input
              type="text"
              placeholder="검색어 입력 (예: 1월 결산)"
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all placeholder:text-slate-400"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={16} />
          </div>
        </div>

        {/* 🔔 우측 아이콘 */}
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </header>
  )
}