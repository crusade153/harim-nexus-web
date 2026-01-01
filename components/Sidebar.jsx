'use client'
import { useState } from 'react'
import { 
  LayoutDashboard, 
  KanbanSquare, 
  MessageSquareText, 
  CalendarDays, 
  Book, 
  CheckSquare, 
  Users, 
  Menu, 
  X,
  LogOut 
} from 'lucide-react'

export default function Sidebar({ currentView, onViewChange }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: LayoutDashboard },
    { id: 'kanban', name: '프로젝트', icon: KanbanSquare },
    { id: 'board', name: '게시판', icon: MessageSquareText },
    { id: 'checklist', name: '월간 마감', icon: CheckSquare, badge: 'D-5' },
    { id: 'wiki', name: '팀 지식고', icon: Book },
    { id: 'calendar', name: '캘린더', icon: CalendarDays },
    { id: 'members', name: '팀원 관리', icon: Users },
  ]

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-slate-200 rounded-lg shadow-sm"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-[240px] bg-white border-r border-slate-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* 로고 영역 */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-sm">
            N
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight">Nexus</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Workspace</p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
          {menuItems.map((item) => {
            const isActive = currentView === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id)
                  setIsMobileOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                  ${isActive 
                    ? 'bg-slate-50 text-indigo-600 ring-1 ring-slate-200/50' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                    item.badge.includes('D-') 
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* 프로필 */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              유
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">유경덕</p>
              <p className="text-xs text-slate-500 truncate">팀장 · 원가팀</p>
            </div>
            <LogOut size={16} className="text-slate-400 hover:text-slate-600" />
          </div>
        </div>
      </aside>
    </>
  )
}