import 'server-only'
import { WORKSPACE_ID, checked } from '@/lib/nexus-server'
import { CHAT_IMMEDIATE_KINDS, buildDailyBrief, isAllowedChatWebhook, notificationChatText } from '@/lib/chat-utils.mjs'
import { closingProgress } from '@/lib/closing-utils.mjs'
import { seoulDate, weekRange } from '@/lib/weekly-utils.mjs'

// 팀 스페이스 수신 웹훅 주소는 서버 환경변수에만 둔다 (DB·브라우저에 노출하지 않음).
export function chatWebhookConfigured() {
  return isAllowedChatWebhook(process.env.GOOGLE_CHAT_WEBHOOK_URL || '')
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
}

export async function sendChatMessage(text) {
  const url = process.env.GOOGLE_CHAT_WEBHOOK_URL || ''
  if (!isAllowedChatWebhook(url)) throw new Error('GOOGLE_CHAT_WEBHOOK_URL 이 없거나 Google Chat 웹훅 주소가 아닙니다.')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ text: String(text).slice(0, 4000) }),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Google Chat 전송 실패 (${response.status})`)
}

async function chatSettings(admin) {
  return checked(await admin.from('workspace_settings')
    .select('chat_enabled,chat_mention_by_email,holidays').eq('workspace_id', WORKSPACE_ID).single())
}

// 아직 Chat 으로 보내지 않은 즉시 알림(배정·멘션·고위험)을 보낸다. 실패한 건은 다음에 다시 시도한다.
export async function flushChatNotifications(admin) {
  if (!chatWebhookConfigured()) return { sent: 0, skipped: 'not_configured' }
  const settings = await chatSettings(admin)
  if (!settings.chat_enabled) return { sent: 0, skipped: 'disabled' }
  const claimed = checked(await admin.rpc('nexus_claim_chat_notifications', { p_workspace: WORKSPACE_ID, p_kinds: CHAT_IMMEDIATE_KINDS, p_limit: 20 }))
  if (!claimed.length) return { sent: 0 }
  const ids = [...new Set(claimed.map(n => n.recipient_member_id))]
  const members = checked(await admin.from('members').select('id,name,email').in('id', ids))
  const byId = new Map(members.map(m => [m.id, m]))
  const failed = []
  for (const notification of claimed) {
    try {
      await sendChatMessage(notificationChatText(notification, {
        appUrl: appUrl(), recipient: byId.get(notification.recipient_member_id), mentionByEmail: settings.chat_mention_by_email,
      }))
    } catch (error) {
      console.warn('Chat 알림 전송 실패:', error.message)
      failed.push(notification.id)
    }
  }
  if (failed.length) await admin.from('notifications').update({ chat_sent_at: null }).in('id', failed)
  return { sent: claimed.length - failed.length, failed: failed.length }
}

// 아침 브리핑 문구에 들어갈 데이터 (표별 1회 조회)
export async function buildBriefText(admin, today = seoulDate()) {
  const settings = await chatSettings(admin)
  const isFriday = new Date(`${today}T00:00:00Z`).getUTCDay() === 5
  const week = weekRange(today)
  const [tasks, members, runs, aiPending, reports] = await Promise.all([
    admin.from('tasks').select('id,title,status,due_date,assignee,assignee_member_id')
      .eq('workspace_id', WORKSPACE_ID).is('deleted_at', null).neq('status', '완료').not('due_date', 'is', null).neq('due_date', '')
      .lte('due_date', today).order('due_date').limit(300),
    admin.from('workspace_members').select('member_id,members(id,name,email)').eq('workspace_id', WORKSPACE_ID).eq('active', true).neq('role', 'guest'),
    admin.from('closing_runs').select('id,period').eq('workspace_id', WORKSPACE_ID).eq('status', 'open').order('period', { ascending: false }).limit(1),
    admin.from('ai_reviews').select('id', { count: 'exact', head: true }).eq('workspace_id', WORKSPACE_ID).in('status', ['queued', 'questions', 'awaiting_confirmation']),
    isFriday ? admin.from('weekly_reports').select('member_id').eq('workspace_id', WORKSPACE_ID).eq('week_start', week.start).eq('status', 'submitted') : Promise.resolve({ data: [] }),
  ])
  const openTasks = checked(tasks)
  const team = checked(members).map(m => m.members).filter(Boolean)
  let closing = null
  const run = checked(runs)[0]
  if (run) {
    const runTasks = checked(await admin.from('tasks').select('status,due_date').eq('closing_run_id', run.id).is('deleted_at', null))
    closing = { period: run.period, ...closingProgress(runTasks, today) }
  }
  const submitted = new Set(checked(reports).map(r => r.member_id))
  return buildDailyBrief({
    date: today,
    dueToday: openTasks.filter(t => t.due_date === today),
    overdue: openTasks.filter(t => t.due_date < today),
    closing,
    weeklyMissing: isFriday ? team.filter(m => !submitted.has(m.id)) : null,
    aiPending: aiPending.count || 0,
    appUrl: appUrl(),
    mentionByEmail: settings.chat_mention_by_email,
    members: team,
  })
}
