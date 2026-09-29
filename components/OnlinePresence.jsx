'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'
import { usePresence } from '@/components/PresenceProvider'

export default function OnlinePresence() {
  const [open, setOpen] = useState(false)
  const { people, connected } = usePresence()

  return <div className="relative">
    <button type="button" aria-expanded={open} aria-label={connected ? `현재 접속자 ${people.length}명, 목록 ${open ? '닫기' : '열기'}` : '접속 상태 확인 중'} onClick={() => setOpen(value => !value)} className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} /><Users size={13} /><span className="hidden sm:inline">현재 접속자</span> {connected ? `${people.length}명` : '확인 중'}
    </button>
    {open && <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <p className="px-2 py-1 text-[11px] font-bold text-slate-500">{connected ? `현재 접속자 ${people.length}명` : '접속 상태 확인 중'}</p>
      <ul className="max-h-56 overflow-y-auto">{people.map(person => <li key={person.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /><span className="truncate">{person.name}</span>{person.position && <span className="ml-auto shrink-0 text-[10px] text-slate-400">{person.position}</span>}</li>)}</ul>
      {!people.length && <p className="px-2 py-3 text-xs text-slate-400">접속 상태를 확인하는 중이에요.</p>}
    </div>}
  </div>
}
