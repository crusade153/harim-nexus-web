import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRecurrenceRule, describeRecurrence, nextRecurrenceRuns, parseRecurrence, ruleToForm } from '../lib/recurrence.mjs'
import { buildClosingTasks, closingProgressByPlant, normalizePlant, parseClosingTitle } from '../lib/closing-utils.mjs'
import { buildWebhookBody, buildWebhookMessage, maskWebhookUrl, webhookTarget } from '../lib/webhook-utils.mjs'
import { buildRule, describeRule, fillPlaceholders, pickRecurringAssignees } from '../lib/automation-utils.mjs'

test('반복 규칙: 화면 선택 ↔ 저장 문자열 왕복, 저장값은 항상 유효', () => {
  assert.equal(buildRecurrenceRule({ mode: 'none' }), '')
  assert.equal(buildRecurrenceRule({ mode: 'daily' }), 'FREQ=DAILY')
  assert.equal(buildRecurrenceRule({ mode: 'weekly', weekdays: [5, 1, 3] }), 'FREQ=WEEKLY;BYDAY=MO,WE,FR')
  assert.equal(buildRecurrenceRule({ mode: 'weekly', weekdays: [0, 6, 1] }), 'FREQ=WEEKLY;BYDAY=MO,SA,SU')
  assert.equal(buildRecurrenceRule({ mode: 'weekly', weekdays: [] }), '')
  assert.equal(buildRecurrenceRule({ mode: 'monthly', monthday: 25 }), 'FREQ=MONTHLY;BYMONTHDAY=25')
  assert.equal(buildRecurrenceRule({ mode: 'monthly', monthday: 'last' }), 'FREQ=MONTHLY;BYMONTHDAY=31')
  for (const form of [{ mode: 'daily' }, { mode: 'weekly', weekdays: [1, 4] }, { mode: 'monthly', monthday: 'last' }, { mode: 'monthly', monthday: 5 }]) {
    const rule = buildRecurrenceRule(form)
    assert.equal(parseRecurrence(rule).ok, true, rule)
    assert.equal(buildRecurrenceRule(ruleToForm(rule)), rule)
  }
  assert.equal(ruleToForm('').mode, 'none')
  assert.equal(ruleToForm('nonsense').mode, 'none')
  assert.equal(describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=31'), '매월 말일')
  assert.equal(describeRecurrence('FREQ=MONTHLY;BYMONTHDAY=25'), '매월 25일')
})

test('반복 규칙: 다음 생성일 미리보기는 영업일·휴일 이월을 반영', () => {
  // 2026-09-30(수) 기준 매주 월요일 → 10/5 는 공휴일이라 다음 영업일 10/6 에 만든다
  assert.deepEqual(nextRecurrenceRuns('FREQ=WEEKLY;BYDAY=MO', '2026-09-30', ['2026-10-05'], 2), ['2026-10-06', '2026-10-12'])
  assert.deepEqual(nextRecurrenceRuns('FREQ=DAILY', '2026-10-01', [], 3), ['2026-10-02', '2026-10-05', '2026-10-06'])
  // 매월 말일: 토요일인 2026-10-31 은 주말이라 다음 영업일(11/2)에 만든다
  assert.deepEqual(nextRecurrenceRuns('FREQ=MONTHLY;BYMONTHDAY=31', '2026-10-01', [], 1), ['2026-11-02'])
  assert.deepEqual(nextRecurrenceRuns('', '2026-10-01'), [])
})

test('월마감: 플랜트 태그가 제목에 들어가고 다시 읽힌다', () => {
  const items = [
    { id: 1, title: '전사 결산', plant: '공통', offset_days: 4, sort_order: 0 },
    { id: 2, title: '재고 수불', plant: 'K1', offset_days: 1, sort_order: 1 },
    { id: 3, title: '재고 수불', plant: 'K2', offset_days: 1, sort_order: 2, default_assignee_member_id: 7 },
    { id: 4, title: '기존 항목', offset_days: 0, sort_order: 3 }
  ]
  const tasks = buildClosingTasks(items, { period: '2026-09', startDate: '2026-10-01', holidays: [], members: [{ id: 7, name: '김리아' }] })
  assert.equal(tasks[0].title, '[2026-09 마감] 전사 결산')
  assert.equal(tasks[1].title, '[2026-09 마감] [K1] 재고 수불')
  assert.equal(tasks[2].assignee, '김리아')
  assert.equal(tasks[3].plant, '공통', 'plant 컬럼이 없던 옛 항목은 공통')
  assert.deepEqual(parseClosingTitle(tasks[1].title), { plant: 'K1', label: '재고 수불' })
  assert.deepEqual(parseClosingTitle('[2026-09 마감] 전사 결산'), { plant: '공통', label: '전사 결산' })
  assert.deepEqual(parseClosingTitle('일반 업무'), { plant: '공통', label: '일반 업무' })
  assert.equal(normalizePlant('K9'), '공통')

  const withStatus = tasks.map((task, index) => ({ ...task, status: index === 1 ? '완료' : '대기' }))
  const byPlant = closingProgressByPlant(withStatus, '2026-10-02')
  assert.deepEqual(byPlant.map(entry => [entry.plant, entry.done, entry.total]), [['공통', 0, 2], ['K1', 1, 1], ['K2', 0, 1]])
})

test('웹훅: 메신저 주소는 text 만, 그 밖에는 text 포함 JSON', () => {
  assert.equal(webhookTarget('https://chat.googleapis.com/v1/spaces/A/messages?key=k&token=t').textOnly, true)
  assert.equal(webhookTarget('https://hooks.slack.com/services/T/B/X').label, 'Slack')
  assert.equal(webhookTarget('https://example.com/hook').textOnly, false)
  assert.equal(webhookTarget('not a url').textOnly, false)

  const event = { event: 'task.status_changed', ruleId: 3, runId: 9, occurredAt: '2026-10-01T00:00:00Z', data: { title: '결산', status: '완료' }, ruleName: '완료 알림' }
  const chat = buildWebhookBody({ ...event, url: 'https://chat.googleapis.com/v1/spaces/A/messages' })
  assert.deepEqual(Object.keys(chat), ['text'])
  assert.match(chat.text, /결산/)
  assert.match(chat.text, /완료/)
  const generic = buildWebhookBody({ ...event, url: 'https://example.com/hook' })
  assert.equal(generic.event, 'task.status_changed')
  assert.equal(generic.text, chat.text)
  assert.match(buildWebhookMessage({ event: 'webhook.test' }), /연결 테스트/)
  assert.equal(maskWebhookUrl('https://chat.googleapis.com/v1/spaces/A/messages?key=SECRET&token=SECRET'), 'https://chat.googleapis.com/…')
})

test('자동화 규칙: 화면 입력 → 저장값 변환과 검증', () => {
  const base = { name: '완료 알림', triggerType: 'task_status_changed', conditionValue: '완료', actionType: 'notify', recipient: 'assignee', title: '', body: '' }
  const notify = buildRule(base, { meId: 5 })
  assert.deepEqual(notify.rule.conditions, { status: '완료' })
  assert.equal(notify.rule.actionConfig.recipientMemberId, undefined, '담당자 기본값은 지정 없음(이벤트의 담당자)')
  assert.equal(notify.rule.actionConfig.title, '완료 알림')
  assert.equal(buildRule({ ...base, recipient: 'me' }, { meId: 5 }).rule.actionConfig.recipientMemberId, 5)
  assert.equal(buildRule({ ...base, recipient: '12' }, { meId: 5 }).rule.actionConfig.recipientMemberId, 12)
  // 우선순위 조건은 마감·생성 규칙에만
  assert.deepEqual(buildRule({ ...base, triggerType: 'task_created', conditionValue: '긴급' }, { meId: 5 }).rule.conditions, { priority: '긴급' })
  assert.deepEqual(buildRule({ ...base, triggerType: 'manual', conditionValue: '긴급' }, { meId: 5 }).rule.conditions, {})
  assert.ok(buildRule({ ...base, name: ' ' }, { meId: 5 }).error)
  assert.ok(buildRule({ ...base, actionType: 'webhook', endpointId: '' }, { meId: 5 }).error)
  assert.ok(buildRule({ ...base, triggerType: 'manual', actionType: 'update_task' }, { meId: 5 }).error)
  assert.equal(buildRule({ ...base, actionType: 'update_task', status: '검토' }, { meId: 5 }).rule.actionConfig.status, '검토')

  const sentence = describeRule({ trigger_type: 'task_due', conditions: { priority: '긴급' }, action_type: 'webhook', action_config: { endpointId: 'x' } }, { webhooks: [{ id: 'x', name: '원가팀 Chat' }] })
  assert.match(sentence.when, /마감일 아침/)
  assert.match(sentence.when, /긴급/)
  assert.match(sentence.what, /원가팀 Chat/)
  assert.equal(fillPlaceholders('오늘 마감: {업무} ({우선순위})', { title: '결산', priority: '높음' }), '오늘 마감: 결산 (높음)')
})

test('반복 업무 담당자: 여러 명 · 비활성 제외 · 지정 없으면 저장자', () => {
  const eligible = new Map([[1, { id: 1, name: '가' }], [2, { id: 2, name: '나' }], [3, { id: 3, name: '다' }]])
  const names = result => result.members.map(member => member?.name ?? null)
  assert.deepEqual(names(pickRecurringAssignees({ assignee_member_ids: [2, 3], created_by_member_id: 1 }, eligible)), ['나', '다'])
  assert.deepEqual(names(pickRecurringAssignees({ assignee_member_ids: [], created_by_member_id: 1 }, eligible)), ['가'], '옛 템플릿은 저장자')
  const skippedOne = pickRecurringAssignees({ assignee_member_ids: [2, 99], created_by_member_id: 1 }, eligible)
  assert.deepEqual(names(skippedOne), ['나'])
  const allGone = pickRecurringAssignees({ assignee_member_ids: [98, 99], created_by_member_id: 1 }, eligible)
  assert.deepEqual(names(allGone), ['가'])
  assert.match(allGone.note, /저장자/)
  assert.deepEqual(names(pickRecurringAssignees({ assignee_member_ids: [], created_by_member_id: 50 }, eligible)), [null])
})
