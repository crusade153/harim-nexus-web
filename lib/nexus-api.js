'use client'
import { supabase } from '@/lib/supabase'

export async function nexusApi(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('다시 로그인해 주세요.')
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.')
  return data
}
