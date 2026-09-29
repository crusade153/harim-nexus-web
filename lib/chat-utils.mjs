// Google Chat 수신 웹훅용 메시지 문구. 네트워크 호출은 lib/google-chat.js 에서만 한다.

// 곧바로 Chat 으로 보내는 알림 종류 (나머지는 앱 알림함 + 아침 브리핑으로 충분)
export const CHAT_IMMEDIATE_KINDS = ['assignment', 'mention', 'system']

// 웹훅 주소는 구글 Chat 공식 도메인만 허용한다(다른 곳으로 업무 내용이 새지 않도록).
export function isAllowedChatWebhook(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'chat.googleapis.com' && url.pathname.startsWith('/v1/spaces/')
  } catch {
    return false
  }
}

const EMAIL = /^[^\s@<>|]+@[^\s@<>|]+\.[^\s@<>|]+$/
// mentionByEmail 이 켜져 있고 회사 이메일이 있으면 Chat 멘션, 아니면 굵은 이름
export function chatMention(member, { mentionByEmail = false } = {}) {
  if (!member) return ''
  if (mentionByEmail && EMAIL.test(member.email || '') && !/@harim-nexus\.com$/i.test(member.email)) return `<users/${member.email}>`
  return `*${String(member.name || '').replace(/[*_~`]/g, '')}*`
}

const clean = value => String(value ?? '').replace(/[<>|]/g, ' ').replace(/\s+/g, ' ').trim()
const link = (appUrl, path, label) => (appUrl ? `<${appUrl.replace(/\/$/, '')}${path || '/work'}|${label}>` : '')

const KIND_LABEL = { assignment: '📌 업무 배정', mention: '💬 멘션', system: '⚠️ 확인 필요', comment: '💬 댓글', status: '✅ 완료' }

export function notificationChatText(notification, { appUrl, recipient, mentionByEmail = false } = {}) {
  const head = `${KIND_LABEL[notification.kind] || '🔔 알림'} ${chatMention(recipient, { mentionByEmail })}`.trim()
  const body = clean(notification.body).slice(0, 200)
  return [head, clean(notification.title), body, link(appUrl, notification.action_url, 'Nexus에서 열기')].filter(Boolean).join('\n')
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

// 평일 아침 팀 브리핑. 금요일에는 주간보고 미제출자를 함께 알린다.
export function buildDailyBrief({ date, dueToday = [], overdue = [], closing = null, weeklyMissing = null, aiPending = 0, appUrl, mentionByEmail = false, members = [] }) {
  const weekday = WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]
  const byMember = new Map(members.map(m => [Number(m.id), m]))
  const who = task => {
    const member = byMember.get(Number(task.assignee_member_id))
    return member ? chatMention(member, { mentionByEmail }) : clean(task.assignee) || '담당 미정'
  }
  const list = tasks => tasks.slice(0, 8).map(t => `• ${clean(t.title)} — ${who(t)}${t.due_date && t.due_date < date ? ` (마감 ${t.due_date})` : ''}`)
  const more = tasks => (tasks.length > 8 ? [`  외 ${tasks.length - 8}건`] : [])
  const lines = [`☀️ *Nexus 아침 브리핑* · ${date} (${weekday})`]
  lines.push('', `*오늘 마감 ${dueToday.length}건*`, ...(dueToday.length ? [...list(dueToday), ...more(dueToday)] : ['• 없음']))
  if (overdue.length) lines.push('', `*지연 ${overdue.length}건*`, ...list(overdue), ...more(overdue))
  if (closing) {
    lines.push('', `*${closing.period} 월마감* 진행 ${closing.done}/${closing.total} (${closing.rate}%)${closing.overdue ? ` · 지연 ${closing.overdue}건` : ''}`)
  }
  if (weeklyMissing) {
    lines.push('', weeklyMissing.length
      ? `*주간보고 미제출* ${weeklyMissing.map(m => chatMention(m, { mentionByEmail })).join(', ')} — 오늘 중 제출해 주세요.`
      : '*주간보고* 모두 제출했습니다 👏')
  }
  if (aiPending) lines.push('', `팀장 검토 대기 완료 점검 ${aiPending}건`)
  const open = link(appUrl, '/dashboard', 'Nexus 열기')
  if (open) lines.push('', open)
  return lines.join('\n')
}
