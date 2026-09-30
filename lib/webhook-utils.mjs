// 웹훅 전송 형식·안내 문구. 서버(automation-server)와 화면(관리자 설정)이 함께 쓴다.

// 받는 쪽이 { text } 한 줄만 받는 메신저 수신 웹훅(Google Chat·Slack·Teams)인지 주소로 판별한다.
// Google Chat 은 모르는 필드가 있으면 400 으로 거부하므로 이런 주소에는 text 만 보낸다.
const TEXT_ONLY_HOSTS = [
  { test: host => host === 'chat.googleapis.com', label: 'Google Chat' },
  { test: host => host === 'hooks.slack.com', label: 'Slack' },
  { test: host => host.endsWith('.webhook.office.com') || host === 'outlook.office.com', label: 'Microsoft Teams' }
]

export function webhookTarget(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    const found = TEXT_ONLY_HOSTS.find(item => item.test(host))
    return found ? { textOnly: true, label: found.label } : { textOnly: false, label: '일반 JSON 수신' }
  } catch {
    return { textOnly: false, label: '일반 JSON 수신' }
  }
}

// 목록에 주소 전체를 보이면 주소 안의 비밀 토큰이 노출되므로 도메인만 보여 준다.
export function maskWebhookUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    return `${url.protocol}//${url.hostname}/…`
  } catch {
    return '주소 확인 필요'
  }
}

const EVENT_LABELS = {
  'task.created': '새 업무',
  'task.status_changed': '업무 상태 변경',
  'task.due': '오늘 마감 업무',
  'automation.manual': '수동 실행'
}

// 사람이 읽는 한 줄 메시지. Chat·Slack 에는 이것만 보내고, 일반 JSON 수신에는 text 필드로 함께 넣는다.
export function buildWebhookMessage(eventPayload = {}, ruleName = '') {
  const event = eventPayload.event || ''
  if (event === 'webhook.test') return '✅ Nexus 웹훅 연결 테스트입니다. 이 메시지가 보이면 연결이 정상입니다.'
  const title = eventPayload.title ? `「${eventPayload.title}」` : ''
  const parts = []
  if (event === 'task.status_changed' && eventPayload.status) parts.push(`상태: ${eventPayload.status}`)
  else if (eventPayload.priority) parts.push(`우선순위: ${eventPayload.priority}`)
  const detail = parts.length ? ` (${parts.join(', ')})` : ''
  const label = EVENT_LABELS[event] || ruleName || '자동화 알림'
  return `[Nexus] ${label}${title ? ` ${title}` : ''}${detail}${ruleName && EVENT_LABELS[event] ? ` · 규칙: ${ruleName}` : ''}`.slice(0, 1000)
}

// 실제로 POST 할 본문
export function buildWebhookBody({ event, ruleId = null, runId = null, occurredAt, data = {}, ruleName = '', url = '' }) {
  const text = buildWebhookMessage({ ...data, event }, ruleName)
  if (webhookTarget(url).textOnly) return { text }
  return { text, event, ruleId, runId, occurredAt, data }
}

export const WEBHOOK_SAMPLE_PAYLOAD = {
  text: '[Nexus] 업무 상태 변경 「월 결산 자료 작성」 (상태: 완료) · 규칙: 완료되면 웹훅 전송',
  event: 'task.status_changed',
  ruleId: 3,
  runId: 41,
  occurredAt: '2026-10-01T00:40:12.000Z',
  data: { taskId: 118, title: '월 결산 자료 작성', status: '완료', source: 'application' }
}
