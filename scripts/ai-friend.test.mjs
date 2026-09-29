import test from 'node:test'
import assert from 'node:assert/strict'
import { checkTaskSnapshot, defaultCheckQuestions, validateCheckQuestions, checkDigest } from '../lib/ai/check-utils.mjs'
import { buildWeeklyDraft } from '../lib/weekly-utils.mjs'

test('기본 점검 질문: 완료 기준·산출물 여부에 맞춰 최대 4개', () => {
  const plain = defaultCheckQuestions({ title: '대사' })
  assert.equal(plain.length, 3)
  assert.match(plain[0], /어디에 남겨/)
  const full = defaultCheckQuestions({ title: '대사', acceptance_criteria: '차이 0원', deliverable_url: 'https://drive' })
  assert.equal(full.length, 4)
  assert.match(full[0], /완료 기준\("차이 0원"\)/)
  assert.match(full[1], /산출물 링크/)
})

test('외부 전송 스냅샷은 필요한 칸만, 긴 본문은 잘라서', () => {
  const snap = checkTaskSnapshot({ id: 1, title: '원가', content: 'x'.repeat(5000), assignee_member_id: 9, status: '진행중' })
  assert.deepEqual(Object.keys(snap).sort(), ['acceptance_criteria', 'content', 'delay_reason', 'deliverable_url', 'due_date', 'priority', 'title'])
  assert.equal(snap.content.length, 4001)
})

test('AI 점검 질문 검증: 1~4개, 빈 문자열·과도한 길이 거부, 공백 정리', () => {
  assert.deepEqual(validateCheckQuestions({ questions: [' 대사하셨나요? ', '공유하셨나요?'] }), { questions: ['대사하셨나요?', '공유하셨나요?'] })
  assert.throws(() => validateCheckQuestions({ questions: [] }), /형식 오류/)
  assert.throws(() => validateCheckQuestions({ questions: ['a', 'b', 'c', 'd', 'e'] }), /형식 오류/)
  assert.throws(() => validateCheckQuestions({ questions: ['  '] }), /형식 오류/)
  assert.throws(() => validateCheckQuestions({ questions: ['x'.repeat(401)] }), /형식 오류/)
  assert.throws(() => validateCheckQuestions({}), /형식 오류/)
})

test('주간보고 완료 항목에 최근 완료 점검 답변을 붙인다 (보완 요청·작성 중은 제외)', () => {
  const tasks = [{ id: 1, title: '대사', status: '완료', completed_at: '2026-09-29T01:00:00Z' }, { id: 2, title: '재고', status: '완료', completed_at: '2026-09-29T01:00:00Z' }]
  const checks = [
    { task_id: 1, status: 'approved', created_at: '2026-09-28T00:00:00Z', questions: ['옛 질문'], answers: ['옛 답'] },
    { task_id: 1, status: 'submitted', created_at: '2026-09-29T00:00:00Z', questions: ['원천과 대사했나요?'], answers: ['SAP와 맞춤'] },
    { task_id: 2, status: 'returned', created_at: '2026-09-29T00:00:00Z', questions: ['q'], answers: ['a'] },
  ]
  const draft = buildWeeklyDraft(tasks, '2026-09-28', [], '2026-10-01', checks)
  assert.match(draft.completed, /• 대사\n  점검: 원천과 대사했나요\? → SAP와 맞춤/)
  assert.doesNotMatch(draft.completed, /옛 답/)
  assert.doesNotMatch(draft.completed, /→ a/)
  assert.equal(checkDigest({ questions: ['q'], answers: null }), '')
})
