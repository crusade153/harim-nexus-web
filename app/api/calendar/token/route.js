import { NextResponse } from 'next/server'
import { requireNexusMember, checked, apiError } from '@/lib/nexus-server'
import { appUrl } from '@/lib/google-chat'

// 내 구글 캘린더 구독 주소 조회(GET) · 새로 만들기/재발급(POST). 토큰은 서버 전용 표에만 있다.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const feedUrl = (request, token) => `${appUrl() || new URL(request.url).origin}/api/calendar/${token}`

export async function GET(request) {
  try {
    const { admin, member } = await requireNexusMember(request)
    const row = checked(await admin.from('member_calendar_tokens').select('token').eq('member_id', member.id).maybeSingle())
    return NextResponse.json({ url: row ? feedUrl(request, row.token) : null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}

export async function POST(request) {
  try {
    const { admin, member } = await requireNexusMember(request)
    // 재발급하면 예전 주소는 즉시 무효가 된다
    const row = checked(await admin.from('member_calendar_tokens')
      .upsert({ member_id: member.id, token: crypto.randomUUID(), created_at: new Date().toISOString() }, { onConflict: 'member_id' })
      .select('token').single())
    return NextResponse.json({ url: feedUrl(request, row.token) })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
