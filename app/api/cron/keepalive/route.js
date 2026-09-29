import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

// Supabase 무료 프로젝트는 약 7일간 활동이 없으면 일시정지된다.
// 팀장 부재 중 긴 연휴에 멈추지 않도록 하루 한 번 가벼운 조회를 보낸다 (vercel.json crons).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 가 없습니다.' }, { status: 500 })
  const { count, error } = await admin.from('members').select('id', { count: 'exact', head: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, members: count, at: new Date().toISOString() })
}
