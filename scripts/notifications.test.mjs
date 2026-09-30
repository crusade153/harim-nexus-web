import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDueSummaries, countByFilter, kindMeta, matchesFilter, relativeTime, safeInternalUrl } from '../lib/notification-utils.mjs'

test('알림함: 종류 묶음·미확인 필터·건수', () => {
  const list = [
    { id: 1, kind: 'assignment', read_at: null },
    { id: 2, kind: 'comment', read_at: '2026-10-01' },
    { id: 3, kind: 'mention', read_at: null },
    { id: 4, kind: 'due', read_at: null },
    { id: 5, kind: 'status', read_at: '2026-10-01' },
    { id: 6, kind: 'automation', read_at: null },
    { id: 7, kind: 'system', read_at: null },
    { id: 8, kind: 'unknown-kind', read_at: null }
  ]
  const counts = countByFilter(list)
  assert.deepEqual(counts, { all: 8, unread: 6, assignment: 1, talk: 2, due: 1, status: 1, system: 3 })
  assert.equal(matchesFilter(list[2], 'talk'), true)
  assert.equal(matchesFilter(list[1], 'unread'), false)
  assert.equal(kindMeta('unknown-kind').label, '알림')
})

test('알림 이동 주소: 내부 경로만 허용', () => {
  assert.equal(safeInternalUrl('/kanban?task=3'), '/kanban?task=3')
  assert.equal(safeInternalUrl('//evil.com'), null)
  assert.equal(safeInternalUrl('https://evil.com'), null)
  assert.equal(safeInternalUrl(null), null)
})

test('상대 시간 표기', () => {
  const now = Date.parse('2026-10-01T12:00:00Z')
  assert.equal(relativeTime('2026-10-01T11:59:40Z', now), '방금')
  assert.equal(relativeTime('2026-10-01T11:30:00Z', now), '30분 전')
  assert.equal(relativeTime('2026-10-01T09:00:00Z', now), '3시간 전')
  assert.equal(relativeTime('2026-09-29T12:00:00Z', now), '2일 전')
})

test('마감 요약: 담당자마다 1건, 오늘 마감·지연만, 완료·미배정 제외', () => {
  const tasks = [
    { id: 1, title: 'A', status: '대기', due_date: '2026-10-06', assignee_member_id: 1 },
    { id: 2, title: 'B', status: '진행중', due_date: '2026-10-06', assignee_member_id: 1 },
    { id: 3, title: 'C', status: '대기', due_date: '2026-10-01', assignee_member_id: 1 },
    { id: 4, title: 'D', status: '완료', due_date: '2026-10-06', assignee_member_id: 1 },
    { id: 5, title: 'E', status: '대기', due_date: '2026-10-06', assignee_member_id: null },
    { id: 6, title: 'F', status: '대기', due_date: '2026-10-08', assignee_member_id: 2 },
    { id: 7, title: 'G', status: '대기', due_date: '2026-10-03', assignee_member_id: 3 },
    { id: 8, title: 'H', status: '대기', due_date: '2026-10-04', assignee_member_id: 3 },
    { id: 9, title: 'I', status: '대기', due_date: '2026-10-05', assignee_member_id: 3 }
  ]
  // 10/5 는 공휴일이라 10/6 아침에 10/5 마감분도 "오늘 마감"으로 함께 본다
  const summaries = buildDueSummaries(tasks, ['2026-10-05', '2026-10-06'], '2026-10-06')
  assert.deepEqual(summaries.map(s => s.memberId), [1, 3], '오늘 마감·지연이 없는 담당자 2 는 제외')
  assert.equal(summaries[0].title, '오늘 마감 2건 · 지연 1건')
  assert.match(summaries[0].body, /오늘 마감: A, B/)
  assert.match(summaries[0].body, /지연: C \(5일 지연\)/)
  assert.equal(summaries[1].title, '오늘 마감 1건 · 지연 2건')
  const many = Array.from({ length: 5 }, (_, i) => ({ id: i, title: `T${i}`, status: '대기', due_date: '2026-10-06', assignee_member_id: 9 }))
  assert.match(buildDueSummaries(many, ['2026-10-06'], '2026-10-06')[0].body, /T0, T1, T2 외 2건/)
})
