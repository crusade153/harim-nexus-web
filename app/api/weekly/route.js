import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked, apiError } from '@/lib/nexus-server'
import { weekRange, seoulDate, buildWeeklyDraft, REPORT_FIELDS } from '@/lib/weekly-utils.mjs'

export const dynamic = 'force-dynamic'
function validWeek(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw Object.assign(new Error('올바른 주차를 선택해 주세요.'), { status: 400 })
  return weekRange(value)
}

export async function GET(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    const week = validWeek(new URL(request.url).searchParams.get('week') || seoulDate())
    const team = isAdmin && new URL(request.url).searchParams.get('team') === '1'
    // 기간별/팀원별 반복 조회 대신 표별 1회. 상한 초과는 불완전한 보고서 대신 오류 표시.
    if (team) {
      const results = await Promise.all([
        admin.from('weekly_reports').select('id,member_id,content,status,submitted_at,week_start,updated_at').eq('workspace_id', WORKSPACE_ID).eq('week_start', week.start).eq('status', 'submitted').order('member_id').limit(501),
        admin.from('workspace_members').select('member_id,members(id,name)').eq('workspace_id', WORKSPACE_ID).eq('active', true).neq('role', 'guest').limit(501),
        admin.from('ai_reviews').select('id,entity_id,summary,risk_level,confirmed_at').eq('workspace_id', WORKSPACE_ID).eq('entity_type', 'weekly_report').eq('status', 'confirmed').gte('source_snapshot->>week_start', week.start).lte('source_snapshot->>week_start', week.start).limit(501),
      ])
      const [reports, memberships, reviews] = results.map(checked)
      if (results.some(r => r.data?.length > 500)) throw Object.assign(new Error('조회 상한(500건)을 초과했습니다.'), { status: 400 })
      return NextResponse.json({ reports, members: memberships.map(m => m.members).filter(Boolean), reviews, week, isAdmin })
    }
    const results = await Promise.all([
      admin.from('weekly_reports').select('id,content,status,submitted_at,updated_at').eq('workspace_id', WORKSPACE_ID).eq('member_id', member.id).eq('week_start', week.start).maybeSingle(),
      admin.from('tasks').select('id,title,status,due_date,start_date,created_at,completed_at,delay_reason,deliverable_url').eq('workspace_id', WORKSPACE_ID).eq('assignee_member_id', member.id).is('deleted_at', null)
        .or(`status.neq.완료,and(completed_at.gte.${week.start}T00:00:00+09:00,completed_at.lt.${week.nextStart}T00:00:00+09:00)`)
        .order('due_date').limit(501),
    ])
    const [report, tasks] = results.map(checked)
    if (tasks.length > 500) throw Object.assign(new Error('주간보고 조회 상한(500건)을 초과했습니다. 관리자에게 문의해 주세요.'), { status: 400 })
    const reviews = tasks.length ? checked(await admin.from('ai_reviews').select('id,entity_type,entity_id,status,summary').eq('workspace_id', WORKSPACE_ID).eq('member_id', member.id).eq('status', 'confirmed').eq('entity_type', 'task').in('entity_id', tasks.map(t => t.id)).limit(501)) : []
    if (reviews.length > 500) throw Object.assign(new Error('AI 요약 조회 상한을 초과했습니다.'), { status: 400 })
    return NextResponse.json({ report, draft: buildWeeklyDraft(tasks, week.start, reviews), week, isAdmin, member })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}

export async function POST(request) {
  try {
    const { admin, member } = await requireNexusMember(request)
    const body = await request.json()
    const week = validWeek(body.week)
    if (!['save', 'submit'].includes(body.action)) throw Object.assign(new Error('잘못된 저장 요청입니다.'), { status: 400 })
    const content = {}
    for (const [key] of REPORT_FIELDS) {
      if (typeof body.content?.[key] !== 'string' || body.content[key].length > 12000) throw Object.assign(new Error('각 항목은 12,000자 이내로 작성해 주세요.'), { status: 400 })
      content[key] = body.content[key].trim()
    }
    if (body.action === 'submit' && !Object.values(content).some(Boolean)) throw Object.assign(new Error('보고 내용을 입력해 주세요.'), { status: 400 })
    const result = await admin.rpc('nexus_save_weekly', { p_workspace: WORKSPACE_ID, p_member: member.id, p_week: week.start, p_content: content, p_submit: body.action === 'submit', p_version: body.version || null })
    if (result.error?.code === 'P0001') throw Object.assign(new Error(result.error.message), { status: 409 })
    return NextResponse.json({ report: checked(result) })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
