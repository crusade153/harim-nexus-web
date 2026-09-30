// 자동화 규칙 화면용 정의·문장 만들기·입력 검증 (서버 실행 로직은 lib/automation-server.js)

export const TRIGGERS = [
  { value: 'task_due', label: '마감일 아침', when: '영업일 아침 8:40(한국시간)에, 마감이 오늘인 미완료 업무마다 한 번씩 (휴일 다음 날은 휴일 마감분 포함)', example: '“오늘 마감입니다” 알림', condition: 'priority' },
  { value: 'task_created', label: '업무가 만들어질 때', when: '화면에서 업무를 만들거나 반복 템플릿이 업무를 만들 때 즉시', example: '긴급 업무가 생기면 Chat 알림', condition: 'priority' },
  { value: 'task_status_changed', label: '업무 상태가 바뀔 때', when: '업무 상태(대기·진행중·검토·완료)를 바꿀 때 즉시', example: '완료되면 Chat 으로 알림', condition: 'status' },
  { value: 'manual', label: '내가 직접 실행할 때', when: '관리자가 규칙 카드의 실행 버튼을 눌렀을 때만', example: '월마감 안내 알림 보내기', condition: null }
]
export const TRIGGER_LABELS = Object.fromEntries(TRIGGERS.map(item => [item.value, item.label]))
export const ACTIONS = [
  { value: 'notify', label: '알림 보내기', help: 'Nexus 알림함에 알림을 남깁니다.' },
  { value: 'webhook', label: '외부로 메시지 보내기 (웹훅)', help: 'Google Chat·Slack 등 등록한 주소로 메시지를 보냅니다.' },
  { value: 'update_task', label: '업무 상태 바꾸기', help: '그 업무의 상태를 정해 둔 값으로 바꿉니다.' }
]
export const ACTION_LABELS = { notify: '알림', update_task: '업무 상태 변경', webhook: '웹훅' }
export const STATUSES = ['대기', '진행중', '검토', '완료']
export const PRIORITIES = ['낮음', '보통', '높음', '긴급']

// 처음 쓰는 사람이 빈 폼 앞에서 막히지 않도록 자주 쓰는 규칙을 한 번에 채운다.
export const RECIPES = [
  { id: 'due-notify', label: '마감일 아침, 담당자에게 알림', form: { name: '마감일 아침 알림', triggerType: 'task_due', actionType: 'notify', recipient: 'assignee', title: '오늘 마감: {업무}', body: '「{업무}」 업무의 마감일이 오늘입니다.' } },
  { id: 'done-webhook', label: '완료되면 Chat·Slack 으로 알림', form: { name: '완료되면 메신저 알림', triggerType: 'task_status_changed', conditionValue: '완료', actionType: 'webhook' } },
  { id: 'review-notify', label: '검토 상태가 되면 나에게 알림', form: { name: '검토 요청 알림', triggerType: 'task_status_changed', conditionValue: '검토', actionType: 'notify', recipient: 'me', title: '검토 요청: {업무}', body: '「{업무}」 업무가 검토 상태로 바뀌었습니다.' } },
  { id: 'urgent-webhook', label: '긴급 업무가 생기면 메신저로 알림', form: { name: '긴급 업무 알림', triggerType: 'task_created', conditionValue: '긴급', actionType: 'webhook' } }
]

export const emptyRuleForm = () => ({
  name: '', triggerType: 'task_due', conditionValue: '', actionType: 'notify',
  recipient: 'assignee', title: '', body: '', status: '검토', endpointId: ''
})

export function conditionKey(triggerType) {
  return TRIGGERS.find(item => item.value === triggerType)?.condition || null
}

// 화면 입력 → 저장할 규칙. 문제가 있으면 { error } 를 돌려준다.
export function buildRule(form, { meId }) {
  const name = String(form.name || '').trim()
  if (!name) return { error: '규칙 이름을 입력해 주세요.' }
  const key = conditionKey(form.triggerType)
  const conditions = key && form.conditionValue ? { [key]: form.conditionValue } : {}
  let actionConfig = {}
  if (form.actionType === 'notify') {
    const recipient = form.recipient === 'me' ? Number(meId) : form.recipient === 'assignee' ? null : Number(form.recipient)
    if (recipient !== null && !Number.isSafeInteger(recipient)) return { error: '알림을 받을 사람을 골라 주세요.' }
    actionConfig = {
      ...(recipient !== null ? { recipientMemberId: recipient } : {}),
      title: String(form.title || '').trim() || name,
      body: String(form.body || '').trim() || '자동화 규칙이 실행되었습니다.'
    }
  } else if (form.actionType === 'update_task') {
    if (form.triggerType === 'manual') return { error: '업무 상태 바꾸기는 업무가 만들어지거나 바뀔 때 쓰는 규칙에서만 고를 수 있습니다.' }
    if (!STATUSES.includes(form.status)) return { error: '바꿀 상태를 골라 주세요.' }
    actionConfig = { status: form.status }
  } else if (form.actionType === 'webhook') {
    if (!form.endpointId) return { error: '메시지를 보낼 웹훅을 골라 주세요. 없으면 아래에서 먼저 등록하세요.' }
    actionConfig = { endpointId: form.endpointId }
  } else {
    return { error: '동작을 골라 주세요.' }
  }
  return { rule: { name, triggerType: form.triggerType, conditions, actionType: form.actionType, actionConfig } }
}

// 카드·미리보기에 보여 줄 한 문장. "이럴 때 → 이렇게"
export function describeRule(rule, { webhooks = [], members = [] } = {}) {
  const trigger = TRIGGERS.find(item => item.value === rule.trigger_type || item.value === rule.triggerType)
  const conditions = rule.conditions || {}
  const when = [trigger?.label || rule.trigger_type]
  if (conditions.status) when.push(`상태가 「${conditions.status}」일 때만`)
  if (conditions.priority) when.push(`우선순위 「${conditions.priority}」만`)
  const type = rule.action_type || rule.actionType
  const config = rule.action_config || rule.actionConfig || {}
  let what = ACTION_LABELS[type] || type
  if (type === 'notify') {
    const target = config.recipientMemberId ? members.find(member => member.id === Number(config.recipientMemberId))?.name || '지정한 사람' : '업무 담당자'
    what = `${target}에게 알림`
  } else if (type === 'update_task') {
    what = `업무 상태를 「${config.status || '?'}」로 변경`
  } else if (type === 'webhook') {
    const endpoint = webhooks.find(item => item.id === config.endpointId)
    what = endpoint ? `웹훅 「${endpoint.name}」으로 전송` : '웹훅 전송 (연결된 웹훅을 찾을 수 없음)'
  }
  return { when: when.join(' · '), what }
}

// 마지막 실행 결과 한 줄
export function describeRun(run) {
  if (!run) return { tone: 'none', text: '아직 실행된 적이 없습니다.' }
  if (run.status === 'failed') return { tone: 'error', text: `실패 — ${run.error_message || '원인을 확인할 수 없습니다.'}` }
  if (run.status === 'running') return { tone: 'muted', text: '실행 중' }
  return { tone: 'ok', text: '성공' }
}

// 알림 제목·본문의 {업무} {상태} {우선순위} 를 실제 값으로 바꾼다.
export function fillPlaceholders(text, eventPayload = {}) {
  return String(text ?? '')
    .replaceAll('{업무}', eventPayload.title || '업무')
    .replaceAll('{상태}', eventPayload.status || '')
    .replaceAll('{우선순위}', eventPayload.priority || '')
}

// 담당자 지정이 없으면 템플릿 저장자에게 배정한다(기존 동작). 지정된 사람 중 비활성·미승인 회원은 건너뛴다.
export function pickRecurringAssignees(template, eligible) {
  const wanted = (template.assignee_member_ids || []).map(Number)
  const chosen = wanted.filter(id => eligible.has(id))
  if (chosen.length) return { members: chosen.map(id => eligible.get(id)), note: '' }
  const creator = eligible.get(Number(template.created_by_member_id))
  return {
    members: [creator || null],
    note: wanted.length ? `지정한 담당자가 모두 비활성이라 ${creator ? '저장자에게' : '담당자 없이'} 배정` : ''
  }
}
