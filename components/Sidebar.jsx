'use client'
import { useState } from 'react'

export default function Sidebar({ currentView, onViewChange }) {
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: '📊' },
    { id: 'kpi', name: 'KPI 관리', icon: '📈', isNew: true }, // ✨ 신규 메뉴
    { id: 'kanban', name: '업무보드', icon: '📋' },
    { id: 'board', name: '게시판', icon: '💬' },
    { id: 'calendar', name: '일정', icon: '📅' },
    { id: 'members', name: '팀원', icon: '👥' },
  ]

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#1e1e24] text-white rounded-xl shadow-lg"
      >
        ☰
      </button>

      {/* 🖤 GearUp 스타일 다크 사이드바 */}
      <aside className={`
        fixed top-0 left-0 h-full w-[260px] bg-[#1e1e24] text-white z-40
        flex flex-col transition-transform duration-300 shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* 로고 영역 */}
        <div className="p-8 pb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d9f99d] to-[#bef264] rounded-xl flex items-center justify-center text-[#1e1e24] font-black text-xl shadow-[0_0_15px_rgba(217,249,157,0.3)]">
              N
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Nexus</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">Workspace</p>
            </div>
          </div>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = currentView === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id)
                  setIsOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-medium transition-all group
                  ${isActive
                    ? 'bg-[#d9f99d] text-[#1e1e24] shadow-[0_4px_12px_rgba(217,249,157,0.2)]'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.name}</span>
                </div>
                {item.isNew && (
                  <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">N</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* 하단 프로필 */}
        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
              유
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">유경덕</p>
              <p className="text-xs text-gray-400 truncate">관리자</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}