import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked, apiError } from '@/lib/nexus-server'
import { runDeepSeek } from '@/lib/ai/deepseek'
import { reviewMessages } from '@/lib/ai/prompts'
import { tokenReservation } from '@/lib/ai/review-utils.mjs'
import { flushChatNotifications } from '@/lib/google-chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90
const COLUMNS = 'id,entity_type,entity_id,trigger_type,status,round,summary,risk_level,model,error_message,created_at,confirmed_at,source_snapshot,member_id,processing_at'

export async function GET(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    if (id) {
      const review = checked(await admin.from('ai_reviews').select(COLUMNS).eq('workspace_id', WORKSPACE_ID).eq('id', id).maybeSingle())
      if (!review || (review.member_id !== member.id && !(isAdmin && review.status === 'confirmed'))) return NextResponse.json({ error: '검토를 볼 수 없습니다.' }, { status: 403 })
      const messages = review.member_id === member.id ? checked(await admin.from('ai_review_messages').select('id,role,content').eq('review_id', id).order('id').limit(20)) : []
      return NextResponse.json({ review, messages, mine: review.member_id === member.id })
    }
    let query = admin.from('ai_reviews').select(COLUMNS).eq('workspace_id', WORKSPACE_ID).neq('status', 'superseded').order('created_at', { ascending: false }).limit(100)
    if (isAdmin && url.searchParams.get('risk') === '1') query = query.eq('status', 'confirmed').eq('risk_level', 'high')
    else query = query.eq('member_id', member.id)
    return NextResponse.json({ reviews: checked(await query), isAdmin, memberId: member.id })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}

export async function POST(request) {
  let admin, review
  try {
    const identity = await requireNexusMember(request)
    admin = identity.admin
    const body = await request.json()
    if (!Number.isSafeInteger(body.id) || !['run', 'answer', 'confirm'].includes(body.action)) return NextResponse.json({ error: '잘못된 AI 요청입니다.' }, { status: 400 })
    const owned = checked(await admin.from('ai_reviews').select('id').eq('id', body.id).eq('workspace_id', WORKSPACE_ID).eq('member_id', identity.member.id).maybeSingle())
    if (!owned) return NextResponse.json({ error: '본인 검토만 처리할 수 있습니다.' }, { status: 403 })
    const transition = await admin.rpc('nexus_ai_transition', { p_id: body.id, p_member: identity.member.id, p_action: body.action, p_answers: body.answers || null })
    if (transition.error?.code === 'P0001') throw Object.assign(new Error(transition.error.message), { status: 409 })
    review = checked(transition)
    if (body.action === 'confirm') {
      // 확인된 고위험 요약은 관리자 알림(system)이 생기므로 Chat 으로도 바로 보낸다
      if (review.risk_level === 'high') await flushChatNotifications(admin).catch(() => null)
      return NextResponse.json({ confirmed: true })
    }
    const settings = checked(await admin.from('workspace_settings').select('ai_enabled,ai_guidelines,ai_mask_numbers').eq('workspace_id', WORKSPACE_ID).single())
    if (!settings.ai_enabled) throw new Error('관리자가 AI 외부 전송을 활성화해야 합니다.')
    const messages = checked(await admin.from('ai_review_messages').select('role,content').eq('review_id', review.id).order('id').limit(20))
    const result = await runDeepSeek(reviewMessages(review, messages, settings), review.round, {
      reserve: async input => checked(await admin.rpc('nexus_reserve_ai_call', { p_id: review.id, p_lease: review.lease_id, p_tokens: tokenReservation(input) })),
      settle: async (id, usage) => {
        if (Number.isSafeInteger(usage?.prompt_tokens) && usage.prompt_tokens >= 0 && Number.isSafeInteger(usage?.completion_tokens) && usage.completion_tokens >= 0) {
          checked(await admin.from('ai_call_usage').update({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens }).eq('id', id))
        }
      },
    })
    const applied = checked(await admin.rpc('nexus_finish_ai_review', { p_id: review.id, p_lease: review.lease_id, p_result: result, p_error: null }))
    return NextResponse.json({ applied, ...(applied ? {} : { message: '원본이 수정되어 이전 AI 결과를 반영하지 않았습니다.' }) })
  } catch (error) {
    if (admin && review?.lease_id) {
      const message = error.name === 'TimeoutError' ? 'AI 응답 시간이 초과되었습니다. 저장된 기록에서 다시 시도해 주세요.' : error.message?.slice(0, 300) || 'AI 처리에 실패했습니다.'
      await admin.rpc('nexus_finish_ai_review', { p_id: review.id, p_lease: review.lease_id, p_result: null, p_error: message })
      return NextResponse.json({ error: message, saved: true }, { status: 503 })
    }
    return NextResponse.json(apiError(error), { status: error.status || 500 })
  }
}
