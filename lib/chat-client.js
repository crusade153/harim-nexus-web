'use client'
import { supabase } from '@/lib/supabase'

// 알림이 생길 수 있는 저장(업무 배정·댓글 멘션 등) 뒤에 부른다. 여러 번 불려도 1.5초에 한 번만 서버에 요청.
// 서버가 DB 에서 아직 안 보낸 알림만 골라 Google Chat 으로 보낸다(연동이 꺼져 있으면 아무것도 안 함).
let timer = null
export function requestChatFlush() {
  if (typeof window === 'undefined') return
  window.clearTimeout(timer)
  timer = window.setTimeout(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch('/api/notify/flush', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, keepalive: true })
    } catch {
      // 알림 전송 실패는 업무 저장에 영향을 주지 않는다 (아침 크론이 다시 보낸다)
    }
  }, 1500)
}
