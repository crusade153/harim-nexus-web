'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function OnlinePresence() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({})

  useEffect(() => {
    const channel = supabase.channel('room_presence')
    channel.on('presence', { event: 'sync' }, () => setState(channel.presenceState())).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const people = useMemo(() => Object.entries(state).map(([key, sessions]) => ({
    id: sessions?.[0]?.user_id || key,
    name: sessions?.[0]?.name || key,
    position: sessions?.[0]?.position || '',
  })).filter((person, index, all) => all.findIndex(other => other.id === person.id) === index).sort((a, b) => a.name.localeCompare(b.name, 'ko')), [state])

  return <div className="relative">
    <button type="button" aria-expanded={open} aria-label={`현재 접속자 ${people.length}명, 목록 ${open ? '닫기' : '열기'}`} onClick={() => setOpen(value => !value)} className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><Users size={13} /><span className="hidden sm:inline">현재 접속자</span> {people.length}명
    </button>
    {open && <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <p className="px-2 py-1 text-[11px] font-bold text-slate-500">현재 접속자 {people.length}명</p>
      <ul className="max-h-56 overflow-y-auto">{people.map(person => <li key={person.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /><span className="truncate">{person.name}</span>{person.position && <span className="ml-auto shrink-0 text-[10px] text-slate-400">{person.position}</span>}</li>)}</ul>
      {!people.length && <p className="px-2 py-3 text-xs text-slate-400">접속 상태를 확인하는 중이에요.</p>}
    </div>}
  </div>
}
