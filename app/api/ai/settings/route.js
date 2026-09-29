import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked, apiError } from '@/lib/nexus-server'

export const dynamic = 'force-dynamic'
const COLUMNS = 'ai_enabled,ai_guidelines,ai_mask_numbers,ai_daily_limit,ai_monthly_token_budget'
export async function GET(request) {
  try {
    const { admin, isAdmin } = await requireNexusMember(request)
    const settings = checked(await admin.from('workspace_settings').select(isAdmin ? COLUMNS : 'ai_enabled,ai_mask_numbers').eq('workspace_id', WORKSPACE_ID).single())
    return NextResponse.json({ settings, isAdmin, model: process.env.DEEPSEEK_MODEL || null, configured: Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL) })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
export async function POST(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    if (!isAdmin) return NextResponse.json({ error: '관리자만 변경할 수 있습니다.' }, { status: 403 })
    const body = await request.json()
    if (typeof body.ai_guidelines !== 'string' || body.ai_guidelines.length > 6000 || !Number.isInteger(body.ai_daily_limit) || body.ai_daily_limit < 1 || body.ai_daily_limit > 100 || !Number.isSafeInteger(body.ai_monthly_token_budget) || body.ai_monthly_token_budget < 1000 || body.ai_monthly_token_budget > 100000000) return NextResponse.json({ error: '지침은 6,000자, 일 호출은 1~100회, 월 예산은 1천~1억 토큰으로 입력해 주세요.' }, { status: 400 })
    checked(await admin.from('workspace_settings').update({ ai_enabled: body.ai_enabled === true, ai_mask_numbers: body.ai_mask_numbers !== false, ai_guidelines: body.ai_guidelines.trim(), ai_daily_limit: body.ai_daily_limit, ai_monthly_token_budget: body.ai_monthly_token_budget, updated_by_member_id: member.id, updated_at: new Date().toISOString() }).eq('workspace_id', WORKSPACE_ID))
    return NextResponse.json({ saved: true })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
