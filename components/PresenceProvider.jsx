'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PresenceContext = createContext({ people: [], connected: false })

export function PresenceProvider({ member, children }) {
  const [people, setPeople] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let active = true
    const channel = supabase.channel('room_presence', {
      config: { presence: { key: String(member.id) } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      if (!active) return
      const byMember = new Map()
      for (const sessions of Object.values(channel.presenceState())) {
        for (const session of sessions) {
          if (session.member_id) byMember.set(String(session.member_id), {
            id: String(session.member_id), name: session.name, position: session.position || '',
          })
        }
      }
      setPeople([...byMember.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')))
      setConnected(byMember.has(String(member.id)))
    }).subscribe(async status => {
      if (!active) return
      if (status === 'SUBSCRIBED') {
        const tracked = await channel.track({ member_id: member.id, name: member.name, position: member.position || '' })
        if (active && tracked !== 'ok') setConnected(false)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnected(false)
        setPeople([])
      }
    })

    return () => { active = false; supabase.removeChannel(channel) }
  }, [member.id, member.name, member.position])

  return <PresenceContext.Provider value={{ people, connected }}>{children}</PresenceContext.Provider>
}

export function usePresence() {
  return useContext(PresenceContext)
}
