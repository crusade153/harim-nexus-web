import { NextResponse } from 'next/server'
import { requireNexusMember, apiError } from '@/lib/nexus-server'
import { flushChatNotifications } from '@/lib/google-chat'

// 업무 배정·멘션처럼 알림이 생기는 저장 직후 브라우저가 호출한다.
// 보낼 알림은 서버가 DB 에서 직접 고르므로(한 번만 전송) 호출자가 내용을 정할 수 없다.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { admin } = await requireNexusMember(request)
    return NextResponse.json(await flushChatNotifications(admin))
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
