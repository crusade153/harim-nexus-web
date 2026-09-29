import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeklyDraft, weekRange, seoulDate } from '../lib/weekly-utils.mjs'
import { validateReview, maskNumbers, tokenReservation } from '../lib/ai/review-utils.mjs'

test('한국 월요일 자정과 연도 경계를 포함한 주차', () => {
  assert.equal(seoulDate('2026-09-27T15:00:00Z'), '2026-09-28')
  assert.deepEqual(weekRange('2027-01-01'), { start: '2026-12-28', end: '2027-01-03', nextStart: '2027-01-04', nextEnd: '2027-01-10' })
})
test('완료는 한국 완료일 기준, 미상 날짜·삭제·확인 전 요약 제외', () => {
  const tasks = [
    { id: 1, title: '주초 완료', status: '완료', completed_at: '2026-09-27T15:00:00Z' },
    { id: 2, title: '주말 완료', status: '완료', completed_at: '2026-10-04T14:59:59Z' },
    { id: 3, title: '다음 주 완료', status: '완료', completed_at: '2026-10-04T15:00:00Z' },
    { id: 4, title: '완료일 미상', status: '완료' },
    { id: 5, title: '삭제 업무', status: '완료', completed_at: '2026-09-29T00:00:00Z', deleted_at: '2026-09-30' },
  ]
  const reviews = [
    { entity_type: 'task', entity_id: 1, status: 'confirmed', summary: { done: '확인됨', evidence: '문서', next: '공유', risks: '없음' } },
    { entity_type: 'task', entity_id: 2, status: 'awaiting_confirmation', summary: { done: '검증 안 됨' } },
  ]
  const result = buildWeeklyDraft(tasks, '2026-09-28', reviews, '2026-10-04')
  assert.match(result.completed, /주초 완료/)
  assert.match(result.completed, /주말 완료/)
  assert.match(result.completed, /확인됨/)
  assert.doesNotMatch(result.completed, /다음 주 완료|완료일 미상|삭제 업무|검증 안 됨/)
})
test('오늘 마감은 지연 제외, 다음 주 기간만 포함, 지연 사유를 만들지 않음', () => {
  const result = buildWeeklyDraft([
    { title: '늦음', status: '진행중', due_date: '2026-09-28' },
    { title: '오늘', status: '진행중', due_date: '2026-09-29' },
    { title: '다음', status: '대기', due_date: '2026-10-05' },
    { title: '먼 미래', status: '대기', due_date: '2026-10-12' },
  ], '2026-09-28', [], '2026-09-29')
  assert.match(result.delays, /늦음.*\n.*미입력/)
  assert.doesNotMatch(result.delays, /오늘/)
  assert.match(result.nextWeek, /다음/)
  assert.doesNotMatch(result.nextWeek, /먼 미래/)
})
test('AI 출력 스키마·질문 수·2라운드 제한', () => {
  const value = { questions: ['근거는?'], summary: { done: '', evidence: '미확인', next: '', risks: '' }, risk_level: 'medium' }
  assert.equal(validateReview(value, 0).questions.length, 1)
  assert.throws(() => validateReview(value, 2))
  assert.throws(() => validateReview({ ...value, questions: Array(4).fill('질문') }, 0))
  assert.throws(() => validateReview({ ...value, summary: null }, 0))
  assert.throws(() => validateReview({ ...value, risk_level: 'critical' }, 0))
  assert.equal(validateReview({ ...value, questions: [] }, 2).questions.length, 0)
})
test('지연 업무도 본인 확인한 요약만 보고 초안에 반영', () => {
  const result = buildWeeklyDraft([{ id: 9, title: '지연 업무', status: '진행중', due_date: '2026-09-28' }], '2026-09-28', [
    { entity_type: 'task', entity_id: 9, status: 'confirmed', summary: { done: '취합', evidence: '검토 문서', next: '담당 부서 협의', risks: '회신 지연' } },
  ], '2026-09-29')
  assert.match(result.delays, /담당 부서 협의/)
})
test('숫자 가림과 한국어 입력 토큰 예약', () => {
  assert.equal(maskNumbers('원가 1,234.5 / 2026년'), '원가 [숫자] / 2026년')
  assert.equal(maskNumbers('10월 2일까지 12,500원, 마감 2026-10-02, 수율 97.5%, 3주차, 9/30 회의'),
    '10월 2일까지 [숫자]원, 마감 2026-10-02, 수율 [숫자]%, 3주차, 9/30 회의')
  assert.equal(maskNumbers('{"due_date":"2026-09-28T04:09:46.44+00:00","qty":300}'), '{"due_date":"2026-09-28T04:09:46.44+00:00","qty":[숫자]}')
  const input = [{ role: 'user', content: '한국어 업무기록' }]
  assert.ok(tokenReservation(input) >= JSON.stringify(input).length + 2048)
})
