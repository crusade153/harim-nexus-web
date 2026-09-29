'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { findSection } from '@/lib/nav'

// 현재 화면이 속한 묶음의 탭. 탭이 하나뿐인 묶음은 표시하지 않는다.
export default function SectionTabs() {
  const pathname = usePathname()
  const section = findSection(pathname)
  if (!section || section.tabs.length < 2) return null

  return (
    <nav aria-label={`${section.name} 화면`} className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-800">
      {section.tabs.map(tab => {
        const active = pathname === tab.path || pathname.startsWith(`${tab.path}/`)
        return (
          <Link
            key={tab.path}
            href={tab.path}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${active
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            {tab.name}
          </Link>
        )
      })}
    </nav>
  )
}
