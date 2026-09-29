import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked, apiError } from '@/lib/nexus-server'
import { runDeepSeek } from '@/lib/ai/deepseek'
import { deskMessages } from '@/lib/ai/prompts'
import { tokenReservation, assistantMessage } from '@/lib/ai/review-utils.mjs'
import { deskRange, deskContext, cleanChat, validateDeskReply, createMasker, LOG_MAX } from '@/lib/ai/desk-utils.mjs'
import { seoulDate, addDays } from '@/lib/weekly-utils.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 240
const fail = (message, status) => Object.assign(new Error(message), { status })
const TASK_COLUMNS = 'id,title,status,priority,due_date,completed_at,deliverable_url,delay_reason'

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw fail('올바른 날짜를 선택해 주세요.', 400)
  return value
}

// 전주 월요일 ~ 금주 일요일의 본인 기록·업무. 표별 1회 조회.
async function loadDesk(admin, member, date) {
  const range = deskRange(date)
  const { prev, week } = range
  const results = await Promise.all([
    admin.from('daily_logs').select('log_date,content,updated_at').eq('workspace_id', WORKSPACE_ID).eq('member_id', member.id).gte('log_date', prev.start).lte('log_date', week.end).order('log_date'),
    admin.from('tasks').select(TASK_COLUMNS).eq('workspace_id', WORKSPACE_ID).eq('assignee_member_id', member.id).is('deleted_at', null)
      .or(`status.neq.완료,and(completed_at.gte.${prev.start}T00:00:00+09:00,completed_at.lt.${addDays(week.end, 1)}T00:00:00+09:00)`)
      .order('due_date').limit(201),
    admin.from('weekly_reports').select('week_start,content,status').eq('workspace_id', WORKSPACE_ID).eq('member_id', member.id).in('week_start', [prev.start, week.start]),
  ])
  const [logs, tasks, reports] = results.map(checked)
  const doneIds = tasks.filter(t => t.status === '완료').map(t => t.id)
  const checks = doneIds.length ? checked(await admin.from('task_completion_checks').select('task_id,questions,answers,status,created_at').eq('workspace_id', WORKSPACE_ID).in('task_id', doneIds).in('status', ['submitted', 'approved']).limit(500)) : []
  return { range, logs, tasks: tasks.slice(0, 200), reports, checks }
}

export async function GET(request) {
  try {
    const { admin, member } = await requireNexusMember(request)
    const today = seoulDate()
    const date = validDate(new URL(request.url).searchParams.get('week') || today)
    const [desk, settings] = await Promise.all([
      loadDesk(admin, member, date),
      admin.from('workspace_settings').select('ai_enabled,ai_mask_numbers').eq('workspace_id', WORKSPACE_ID).single().then(checked),
    ])
    const configured = Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL)
    return NextResponse.json({
      today, memberId: member.id, ...desk.range, logs: desk.logs, reports: desk.reports.map(r => ({ week_start: r.week_start, status: r.status })),
      tasks: desk.tasks.map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, completed_at: t.completed_at })),
      assistant: { ready: Boolean(settings.ai_enabled && configured), enabled: settings.ai_enabled, configured, masked: settings.ai_mask_numbers },
    })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}

export async function POST(request) {
  try {
    const { admin, member } = await requireNexusMember(request)
    const body = await request.json()
    if (body.action === 'save_log') {
      const date = validDate(body.date)
      if (typeof body.content !== 'string' || body.content.length > LOG_MAX) throw fail(`하루 기록은 ${LOG_MAX.toLocaleString()}자 이내로 적어 주세요.`, 400)
      const content = body.content.trim()
      if (!content) {
        checked(await admin.from('daily_logs').delete().eq('workspace_id', WORKSPACE_ID).eq('member_id', member.id).eq('log_date', date))
        return NextResponse.json({ log: null })
      }
      const log = checked(await admin.from('daily_logs').upsert({ workspace_id: WORKSPACE_ID, member_id: member.id, log_date: date, content, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,member_id,log_date' }).select('log_date,content,updated_at').single())
      return NextResponse.json({ log })
    }
    if (body.action === 'chat') {
      let chat
      try { chat = cleanChat(body.messages) } catch (error) { throw fail(error.message, 400) }
      const today = seoulDate()
      const date = validDate(body.week || today)
      const settings = checked(await admin.from('workspace_settings').select('ai_enabled,ai_mask_numbers').eq('workspace_id', WORKSPACE_ID).single())
      if (!settings.ai_enabled) throw fail('관리자가 비서몬 외부 전송을 켜야 대화할 수 있어요. 일일 기록은 그대로 저장됩니다.', 503)
      if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_MODEL) throw fail('서버의 비서몬 연결 설정이 필요합니다.', 503)
      const desk = await loadDesk(admin, member, date)
      if (!desk.logs.length && !desk.tasks.length) throw fail('정리할 기록이 아직 없어요. 왼쪽에 하루 업무를 먼저 적어 주세요.', 400)
      const masker = settings.ai_mask_numbers ? createMasker() : null
      const messages = deskMessages(deskContext({ today, ...desk }), chat, masker)
      try {
        const result = await runDeepSeek(messages, validateDeskReply, {
          maxTokens: 4096, timeoutMs: 100000,
          reserve: async input => checked(await admin.rpc('nexus_reserve_member_ai_call', { p_workspace: WORKSPACE_ID, p_member: member.id, p_tokens: tokenReservation(input, 4096) })),
          settle: async (callId, usage) => {
            if (Number.isSafeInteger(usage?.prompt_tokens) && Number.isSafeInteger(usage?.completion_tokens)) {
              checked(await admin.from('ai_call_usage').update({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens }).eq('id', callId))
            }
          },
        })
        return NextResponse.json({ reply: masker ? masker.restore(result.reply) : result.reply })
      } catch (error) {
        if (error.status) throw error
        const limit = /상한|예산|활성화/.test(error.message || '')
        throw fail(error.name === 'TimeoutError' ? '비서몬 답변이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.' : limit ? assistantMessage(error.message) : '비서몬이 지금 답하지 못했어요. 잠시 후 다시 시도해 주세요.', 503)
      }
    }
    throw fail('잘못된 요청입니다.', 400)
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
