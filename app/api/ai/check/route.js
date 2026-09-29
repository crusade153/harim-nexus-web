import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked, apiError } from '@/lib/nexus-server'
import { runDeepSeek } from '@/lib/ai/deepseek'
import { completionCheckMessages } from '@/lib/ai/prompts'
import { tokenReservation } from '@/lib/ai/review-utils.mjs'
import { checkTaskSnapshot, defaultCheckQuestions, validateCheckQuestions } from '@/lib/ai/check-utils.mjs'
import { flushChatNotifications } from '@/lib/google-chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90
const COLUMNS = 'id,task_id,member_id,task_snapshot,questions,answers,question_source,model,status,lead_comment,reviewed_by_member_id,reviewed_at,submitted_at,created_at'
const TASK_COLUMNS = 'id,title,content,status,priority,due_date,acceptance_criteria,deliverable_url,delay_reason,updated_at,deleted_at'
const fail = (message, status) => Object.assign(new Error(message), { status })

async function memberNames(admin, checks) {
  const ids = [...new Set(checks.flatMap(c => [c.member_id, c.reviewed_by_member_id]).filter(Boolean))]
  if (!ids.length) return {}
  return Object.fromEntries(checked(await admin.from('members').select('id,name').in('id', ids)).map(m => [m.id, m.name]))
}

async function detail(admin, check, member, isAdmin) {
  if (!check || (check.member_id !== member.id && !isAdmin)) throw fail('점검 기록을 볼 수 없습니다.', 403)
  const task = checked(await admin.from('tasks').select('id,title,status,deleted_at').eq('id', check.task_id).maybeSingle())
  return { check, task, names: await memberNames(admin, [check]), mine: check.member_id === member.id, isAdmin }
}

export async function GET(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    const url = new URL(request.url)
    const id = Number(url.searchParams.get('id'))
    const taskId = Number(url.searchParams.get('task'))
    if (id) return NextResponse.json(await detail(admin, checked(await admin.from('task_completion_checks').select(COLUMNS).eq('workspace_id', WORKSPACE_ID).eq('id', id).maybeSingle()), member, isAdmin))
    if (taskId) {
      // 알림의 /ai?task=ID 는 그 업무의 가장 최근 제출 점검을 연다
      let query = admin.from('task_completion_checks').select(COLUMNS).eq('workspace_id', WORKSPACE_ID).eq('task_id', taskId).neq('status', 'draft').order('created_at', { ascending: false }).limit(1)
      if (!isAdmin) query = query.eq('member_id', member.id)
      const check = checked(await query)[0]
      return NextResponse.json(check ? await detail(admin, check, member, isAdmin) : { check: null, isAdmin })
    }
    const view = isAdmin ? url.searchParams.get('view') || 'pending' : 'mine'
    let query = admin.from('task_completion_checks').select(COLUMNS).eq('workspace_id', WORKSPACE_ID).limit(100)
    if (view === 'pending') query = query.eq('status', 'submitted').order('submitted_at', { ascending: true })
    else if (view === 'reviewed') query = query.in('status', ['approved', 'returned']).order('reviewed_at', { ascending: false })
    else query = query.eq('member_id', member.id).in('status', ['submitted', 'approved', 'returned']).order('created_at', { ascending: false })
    const checks = checked(await query)
    const pending = isAdmin ? (await admin.from('task_completion_checks').select('id', { count: 'exact', head: true }).eq('workspace_id', WORKSPACE_ID).eq('status', 'submitted')).count : null
    return NextResponse.json({ checks, names: await memberNames(admin, checks), view, isAdmin, pendingCount: pending ?? null })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}

async function prepare(admin, member, taskId) {
  if (!Number.isSafeInteger(taskId)) throw fail('잘못된 업무입니다.', 400)
  const task = checked(await admin.from('tasks').select(TASK_COLUMNS).eq('workspace_id', WORKSPACE_ID).eq('id', taskId).maybeSingle())
  if (!task || task.deleted_at) throw fail('삭제되었거나 찾을 수 없는 업무입니다.', 404)
  if (task.status === '완료') return { completed: true }
  const summary = { id: task.id, title: task.title }
  const draft = () => admin.from('task_completion_checks').select(COLUMNS).eq('task_id', task.id).eq('member_id', member.id).eq('task_version', task.updated_at).maybeSingle()
  // 같은 업무 버전에서 창을 다시 열면 질문을 새로 만들지 않는다 (AI 호출 절약)
  const existing = checked(await draft())
  if (existing?.status === 'draft') return { check: existing, task: summary }
  if (existing) throw fail('업무가 방금 바뀌었습니다. 새로고침한 뒤 다시 완료해 주세요.', 409)

  const snapshot = checkTaskSnapshot(task)
  const settings = checked(await admin.from('workspace_settings').select('ai_enabled,ai_guidelines,ai_mask_numbers').eq('workspace_id', WORKSPACE_ID).single())
  const configured = Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_MODEL)
  let questions = null, source = 'default', model = null, notice = ''
  const callIds = []
  if (settings.ai_enabled && configured) {
    try {
      const result = await runDeepSeek(completionCheckMessages(snapshot, settings), validateCheckQuestions, {
        reserve: async input => {
          const callId = checked(await admin.rpc('nexus_reserve_member_ai_call', { p_workspace: WORKSPACE_ID, p_member: member.id, p_tokens: tokenReservation(input) }))
          callIds.push(callId)
          return callId
        },
        settle: async (callId, usage) => {
          if (Number.isSafeInteger(usage?.prompt_tokens) && Number.isSafeInteger(usage?.completion_tokens)) {
            checked(await admin.from('ai_call_usage').update({ input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens }).eq('id', callId))
          }
        },
      })
      questions = result.questions; source = 'ai'; model = result.model
    } catch (error) {
      notice = /상한|예산/.test(error.message || '') ? `${error.message} 기본 점검 질문으로 대신할게요.` : 'AI 친구가 지금 답하지 못해 기본 점검 질문으로 대신할게요.'
    }
  } else {
    notice = settings.ai_enabled ? '서버 AI 설정이 없어 기본 점검 질문을 드려요.' : 'AI 외부 전송이 꺼져 있어 기본 점검 질문을 드려요.'
  }
  const inserted = checked(await admin.from('task_completion_checks').upsert({
    workspace_id: WORKSPACE_ID, task_id: task.id, member_id: member.id, task_version: task.updated_at,
    task_snapshot: snapshot, questions: questions || defaultCheckQuestions(snapshot), question_source: source, model,
  }, { onConflict: 'task_id,member_id,task_version', ignoreDuplicates: true }).select(COLUMNS))
  const check = inserted[0] || checked(await draft())
  if (callIds.length && check) await admin.from('ai_call_usage').update({ check_id: check.id }).in('id', callIds)
  if (check?.status !== 'draft') throw fail('업무가 방금 바뀌었습니다. 새로고침한 뒤 다시 완료해 주세요.', 409)
  return { check, task: summary, notice }
}

export async function POST(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    const body = await request.json()
    if (body.action === 'prepare') return NextResponse.json(await prepare(admin, member, Number(body.taskId)))
    if (!Number.isSafeInteger(body.id)) throw fail('잘못된 요청입니다.', 400)
    if (body.action === 'submit') {
      const result = await admin.rpc('nexus_submit_completion_check', { p_id: body.id, p_member: member.id, p_answers: body.answers })
      if (result.error?.code === 'P0001') throw fail(result.error.message, 409)
      return NextResponse.json({ check: checked(result) })
    }
    if (['approve', 'return'].includes(body.action)) {
      if (!isAdmin) throw fail('팀장(관리자)만 검토할 수 있습니다.', 403)
      if (typeof body.comment !== 'undefined' && typeof body.comment !== 'string') throw fail('의견 형식이 올바르지 않습니다.', 400)
      const result = await admin.rpc('nexus_review_completion_check', { p_id: body.id, p_reviewer: member.id, p_action: body.action, p_comment: body.comment || null })
      if (result.error?.code === 'P0001') throw fail(result.error.message, 409)
      const check = checked(result)
      // 보완 요청은 system 알림이라 Google Chat 으로도 바로 보낸다
      if (body.action === 'return') await flushChatNotifications(admin).catch(() => null)
      return NextResponse.json({ check })
    }
    throw fail('잘못된 요청입니다.', 400)
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}
