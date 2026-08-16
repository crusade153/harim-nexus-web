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

