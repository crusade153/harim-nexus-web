'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Drawer({ isOpen, onClose, title, children }) {
  // Drawer 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen])

  return (
    <>
      {/* 배경 오버레이 */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      
      {/* 슬라이드 패널 */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] md:w-[600px] bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-200 dark:border-slate-700 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </>
  )
}