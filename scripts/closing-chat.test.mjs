import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addBusinessDays, businessDaysBetween, buildClosingTasks, closingProgress, defaultPeriod,
  defaultRunStart, isValidPeriod, normalizeHolidays,
} from '../lib/closing-utils.mjs'
import { buildIcs } from '../lib/ics.mjs'
import { buildDailyBrief, chatMention, isAllowedChatWebhook, notificationChatText } from '../lib/chat-utils.mjs'

const HOLIDAYS = ['2026-10-05', '2026-10-09']

test('영업일: 주말·공휴일을 건너뛴다', () => {
  // 2026-10-02 금 → +1 영업일 = 10-06 화 (10-03 토, 10-04 일, 10-05 대체공휴일)
  assert.equal(addBusinessDays('2026-10-02', 1, HOLIDAYS), '2026-10-06')
  // 휴일에서 시작하면 다음 영업일이 0일째
  assert.equal(addBusinessDays('2026-10-03', 0, HOLIDAYS), '2026-10-06')
  assert.equal(addBusinessDays('2026-10-06', 3, HOLIDAYS), '2026-10-12')
  assert.equal(businessDaysBetween('2026-10-01', '2026-10-08', HOLIDAYS), 4)
})

test('마감 대상월과 시작일 기본값', () => {
  assert.equal(defaultPeriod('2026-10-02'), '2026-09')
  assert.equal(defaultPeriod('2027-01-04'), '2026-12')
  // 9월 마감 → 10월 첫 영업일 (10-01 목)
  assert.equal(defaultRunStart('2026-09', HOLIDAYS), '2026-10-01')
  // 12월 마감 → 1월 1일 신정 휴일이면 1월 4일 월
  assert.equal(defaultRunStart('2026-12', ['2027-01-01']), '2027-01-04')
  assert.ok(isValidPeriod('2026-09'))
  assert.ok(!isValidPeriod('2026-13'))
  assert.deepEqual(normalizeHolidays(['2026-10-09', 'x', '2026-02-30', '2026-10-05', '2026-10-09']), ['2026-10-05', '2026-10-09'])
})

test('템플릿 항목 → 월마감 업무', () => {
  const items = [
    { id: 2, title: '원가 대사', offset_days: 2, default_assignee_member_id: 7, sort_order: 2, reference_url: 'https://docs/x' },
    { id: 1, title: '재고 마감', offset_days: 0, default_assignee_member_id: null, sort_order: 1, description: '창고 확인' },
  ]
  const tasks = buildClosingTasks(items, { period: '2026-09', startDate: '2026-10-01', holidays: HOLIDAYS, members: [{ id: 7, name: '홍길동' }] })
  assert.deepEqual(tasks.map(t => [t.item_id, t.title, t.due_date, t.assignee]), [
    [1, '[2026-09 마감] 재고 마감', '2026-10-01', null],
    [2, '[2026-09 마감] 원가 대사', '2026-10-06', '홍길동'],
  ])
  assert.equal(tasks[1].content, '참고: https://docs/x')
  assert.deepEqual(closingProgress([{ status: '완료' }, { status: '대기', due_date: '2026-10-01' }, { status: '대기', due_date: '2026-10-09' }], '2026-10-02'),
    { total: 3, done: 1, overdue: 1, rate: 33 })
})

test('ICS: 종일 일정, 특수문자 이스케이프, 긴 줄 접기', () => {
  const ics = buildIcs([{ uid: 'task-1@nexus', date: '2026-10-06', title: '원가, 대사; 검토', description: '줄1\n줄2' }], { now: new Date('2026-09-29T00:00:00Z') })
  assert.match(ics, /DTSTART;VALUE=DATE:20261006\r\nDTEND;VALUE=DATE:20261007/)
  assert.match(ics, /SUMMARY:원가\\, 대사\\; 검토/)
  assert.match(ics, /DESCRIPTION:줄1\\n줄2/)
  const long = buildIcs([{ uid: 'u', date: '2026-10-06', title: '가'.repeat(60) }])
  for (const line of long.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75)
})

test('Google Chat: 공식 웹훅만 허용하고 문구를 만든다', () => {
  assert.ok(isAllowedChatWebhook('https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t'))
  assert.ok(!isAllowedChatWebhook('https://evil.example.com/v1/spaces/AAA'))
  assert.ok(!isAllowedChatWebhook('http://chat.googleapis.com/v1/spaces/AAA'))
  assert.equal(chatMention({ name: '홍*길동', email: 'hong@harim.co.kr' }), '*홍길동*')
  assert.equal(chatMention({ name: '홍길동', email: 'hong@harim.co.kr' }, { mentionByEmail: true }), '<users/hong@harim.co.kr>')
  assert.equal(chatMention({ name: '홍길동', email: 'hong@harim-nexus.com' }, { mentionByEmail: true }), '*홍길동*')
  const text = notificationChatText({ kind: 'assignment', title: '업무가 배정되었습니다: <원가>', action_url: '/kanban?task=3' }, { appUrl: 'https://nexus.example.com/', recipient: { name: '홍길동' } })
  assert.equal(text, '📌 업무 배정 *홍길동*\n업무가 배정되었습니다: 원가\n<https://nexus.example.com/kanban?task=3|Nexus에서 열기>')
  const brief = buildDailyBrief({
    date: '2026-10-02', appUrl: 'https://n.example.com', members: [{ id: 1, name: '김' }, { id: 2, name: '이' }],
    dueToday: [{ title: '대사', assignee_member_id: 1, due_date: '2026-10-02' }],
    overdue: [{ title: '재고', assignee_member_id: 2, due_date: '2026-09-30' }],
    closing: { period: '2026-09', done: 3, total: 5, rate: 60, overdue: 1 }, weeklyMissing: [{ name: '이' }], aiPending: 2,
  })
  assert.match(brief, /2026-10-02 \(금\)/)
  assert.match(brief, /• 대사 — \*김\*/)
  assert.match(brief, /• 재고 — \*이\* \(마감 2026-09-30\)/)
  assert.match(brief, /2026-09 월마감\* 진행 3\/5 \(60%\) · 지연 1건/)
  assert.match(brief, /주간보고 미제출\* \*이\*/)
  assert.match(brief, /<https:\/\/n\.example\.com\/dashboard\|Nexus 열기>/)
})
