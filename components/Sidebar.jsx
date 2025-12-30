'use client'
import { useState } from 'react'

export default function Sidebar({ currentView, onViewChange }) {
  const [isOpen, setIsOpen] = useState(true)

  const menuItems = [
    { id: 'dashboard', label: '대시보드', icon: '📊', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'kanban', label: '업무 보드', icon: '📋', gradient: 'from-purple-500 to-pink-500' },
    { id: 'board', label: '게시판', icon: '💬', gradient: 'from-green-500 to-teal-500' },
    { id: 'calendar', label: '일정', icon: '📅', gradient: 'from-orange-500 to-red-500' },
    { id: 'members', label: '팀원', icon: '👥', gradient: 'from-indigo-500 to-purple-500' },
  ]

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 glass rounded-xl shadow-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen glass-dark text-white
          transition-all duration-300 z-40
          ${isOpen ? 'w-64' : 'w-0 lg:w-20'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center font-bold text-xl shadow-lg">
              H
            </div>
            {isOpen && (
              <div className="animate-fadeIn">
                <h1 className="font-bold text-lg">Team Nexus</h1>
                <p className="text-xs text-gray-400">하림 통합 워크스페이스</p>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`
                  w-full flex items-center gap-4 px-4 py-3 rounded-xl
                  transition-all duration-300 group
                  ${currentView === item.id
                    ? `bg-gradient-to-r ${item.gradient} shadow-lg scale-105`
                    : 'hover:bg-white/10'
                  }
                `}
              >
                <span className="text-2xl group-hover:scale-125 transition-transform">
                  {item.icon}
                </span>
                {isOpen && (
                  <span className="font-medium animate-fadeIn">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* User Profile */}
          <div className={`mt-auto pt-6 border-t border-white/10 ${isOpen ? '' : 'hidden lg:block'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-bold">
                유
              </div>
              {isOpen && (
                <div className="animate-fadeIn">
                  <p className="font-medium">유경덕</p>
                  <p className="text-xs text-gray-400">팀장 · 원가팀</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/50 z-30 animate-fadeIn"
        />
      )}
    </>
  )
}