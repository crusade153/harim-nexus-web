import test from 'node:test'
import assert from 'node:assert/strict'
import { datesSinceLastBusinessDay, describeRecurrence, parseRecurrence, recurrenceMatches } from '../lib/recurrence.mjs'

test('반복 규칙: 지원 형식만 통과, 빈 값은 수동 템플릿', () => {
  assert.equal(parseRecurrence('').empty, true)
  assert.equal(parseRecurrence('FREQ=DAILY').ok, true)
  assert.equal(parseRecurrence('RRULE:FREQ=WEEKLY;BYDAY=MO,WE').ok, true)
  assert.equal(parseRecurrence('FREQ=MONTHLY;BYMONTHDAY=25').ok, true)
  for (const bad of ['FREQ=WEEKLY', 'FREQ=YEARLY', 'FREQ=MONTHLY;BYMONTHDAY=32', 'FREQ=WEEKLY;BYDAY=XX', 'FREQ=DAILY;INTERVAL=2', '매주 월요일', 'FREQ=DAILY;BYDAY=MO']) {
    assert.equal(parseRecurrence(bad).ok, false, bad)
  }
})

test('반복 규칙: 요일·월일 판정과 말일 보정', () => {
  assert.equal(recurrenceMatches('FREQ=WEEKLY;BYDAY=MO', '2026-09-28'), true)
  assert.equal(recurrenceMatches('FREQ=WEEKLY;BYDAY=MO', '2026-09-29'), false)
  assert.equal(recurrenceMatches('FREQ=MONTHLY;BYMONTHDAY=25', '2026-09-25'), true)
  assert.equal(recurrenceMatches('FREQ=MONTHLY;BYMONTHDAY=31', '2026-09-30'), true)
  assert.equal(recurrenceMatches('FREQ=MONTHLY;BYMONTHDAY=31', '2026-09-29'), false)
  assert.equal(recurrenceMatches('nonsense', '2026-09-28'), false)
  assert.equal(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,FR'), '매주 월·금요일')
})

test('휴일에 걸린 날짜는 다음 영업일 실행 범위에 포함', () => {
  // 2026-09-28(월)은 영업일, 29·30일은 평일. 토·일 다음 월요일이면 토·일 포함
  assert.deepEqual(datesSinceLastBusinessDay('2026-09-29', []), ['2026-09-29'])
  assert.deepEqual(datesSinceLastBusinessDay('2026-09-28', []), ['2026-09-26', '2026-09-27', '2026-09-28'])
  assert.deepEqual(datesSinceLastBusinessDay('2026-10-05', ['2026-10-03', '2026-10-05'].filter(d => d !== '2026-10-05')),
    ['2026-10-03', '2026-10-04', '2026-10-05'])
})
