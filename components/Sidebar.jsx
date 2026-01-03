'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, KanbanSquare, CheckSquare, Archive, CalendarDays, Users, Menu, X, LogOut, Megaphone } from 'lucide-react'

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname() // 현재 경로 확인

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'kanban', name: '업무 보드', icon: KanbanSquare, path: '/kanban' }, 
    { id: 'todos', name: '프로젝트 & To-Do', icon: CheckSquare, badge: 'Action', path: '/todos' }, 
    { id: 'board', name: '게시판 & 이슈', icon: Megaphone, badge: 'New', path: '/board' },
    { id: 'archive', name: '팀 아카이브', icon: Archive, path: '/archive' }, 
    { id: 'calendar', name: '캘린더', icon: CalendarDays, path: '/calendar' },
    { id: 'members', name: '팀원 관리', icon: Users, path: '/members' },
  ]

  return (
    <>
      <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-600 dark:text-slate-300">
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-[240px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-sm">N</div>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white tracking-tight">Nexus</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Workspace</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
          {menuItems.map((item) => {
            const isActive = pathname === item.path
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                  ${isActive 
                    ? 'bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 ring-1 ring-slate-200/50 dark:ring-slate-700' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
                  <span>{item.name}</span>
                </div>
                {item.badge && <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-bold">{item.badge}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">유</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">유경덕</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">관리자</p>
            </div>
            <LogOut size={16} className="text-slate-400" />
          </div>
        </div>
      </aside>
    </>
  )
}