import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyDueDate, safeStorageFileName, sanitizeSearchTerm } from '../lib/work-os-utils.mjs'

test('global search strips PostgREST control characters', () => {
  assert.equal(sanitizeSearchTerm(' 원가%),title.eq.hack '), '원가 title eq hack')
  assert.equal(sanitizeSearchTerm('월간  원가-분석'), '월간 원가-분석')
})

test('my work due dates are partitioned without timezone conversion', () => {
  assert.equal(classifyDueDate('2026-08-15', '2026-08-16'), 'overdue')
  assert.equal(classifyDueDate('2026-08-16', '2026-08-16'), 'today')
  assert.equal(classifyDueDate('', '2026-08-16'), 'upcoming')
})

test('storage file names retain Korean and remove path separators', () => {
  assert.equal(safeStorageFileName('../../원가 분석.xlsx'), '..-..-원가-분석.xlsx')
  assert.equal(safeStorageFileName(''), 'file')
})


test('quick add parses assignee, due date and priority', async () => {
  const { parseQuickTask } = await import('../lib/work-os-utils.mjs')
  // 2026-09-29 는 화요일
  assert.deepEqual(parseQuickTask('월마감 원가표 검토 @홍길동 ~금 !높음', '2026-09-29'),
    { title: '월마감 원가표 검토', assigneeName: '홍길동', dueDate: '2026-10-02', priority: '높음' })
  assert.deepEqual(parseQuickTask('보고서 정리', '2026-09-29'),
    { title: '보고서 정리', assigneeName: null, dueDate: null, priority: '보통' })
})

test('quick add dates resolve relative words and wrap to next year', async () => {
  const { resolveQuickDate } = await import('../lib/work-os-utils.mjs')
  assert.equal(resolveQuickDate('오늘', '2026-09-29'), '2026-09-29')
  assert.equal(resolveQuickDate('내일', '2026-12-31'), '2027-01-01')
  assert.equal(resolveQuickDate('화', '2026-09-29'), '2026-09-29')
  assert.equal(resolveQuickDate('월요일', '2026-09-29'), '2026-10-05')
  assert.equal(resolveQuickDate('10/5', '2026-09-29'), '2026-10-05')
  assert.equal(resolveQuickDate('1/5', '2026-09-29'), '2027-01-05')
  assert.equal(resolveQuickDate('2026-11-3', '2026-09-29'), '2026-11-03')
  assert.equal(resolveQuickDate('언젠가', '2026-09-29'), null)
})
