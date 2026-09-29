import test from 'node:test'
import assert from 'node:assert/strict'
import { createMasker, deskRange, deskContext, cleanChat, validateDeskReply } from '../lib/ai/desk-utils.mjs'
import { assistantMessage } from '../lib/ai/review-utils.mjs'

test('작업공간 기간: 금주 월~일과 전주 월~일', () => {
  assert.deepEqual(deskRange('2026-09-29'), { week: { start: '2026-09-28', end: '2026-10-04' }, prev: { start: '2026-09-21', end: '2026-09-27' } })
  assert.deepEqual(deskRange('2027-01-01').prev, { start: '2026-12-21', end: '2026-12-27' })
})

test('숫자 가림: 자리표시로 보내고 답에서 되돌림, 날짜는 그대로', () => {
  const m = createMasker()
  const masked = m.mask('9월 29일 재료비 1,250,000원 절감, 수율 97.5% / 2026-09-21 기준, 재료비 1,250,000원')
  assert.equal(masked, '9월 29일 재료비 [#1]원 절감, 수율 [#2]% / 2026-09-21 기준, 재료비 [#1]원')
  assert.equal(m.restore('■ 재료비 [#1]원 절감(수율 [#2]%), [#9]'), '■ 재료비 1,250,000원 절감(수율 97.5%), [#9]')
  // 여러 메시지에 걸쳐 같은 번호를 쓴다
  assert.equal(m.mask('다시 97.5%'), '다시 [#2]%')
})

test('업무 자료: 전주/금주 구분, 기간 밖 완료 제외, 점검 답변 요약', () => {
  const range = deskRange('2026-09-29')
  const ctx = deskContext({
    today: '2026-09-29', range,
    logs: [{ log_date: '2026-09-29', content: '금주 기록' }, { log_date: '2026-09-22', content: '전주 기록' }],
    tasks: [
      { id: 1, title: '전주 완료', status: '완료', completed_at: '2026-09-22T01:00:00Z', deliverable_url: 'https://drive/x' },
      { id: 2, title: '너무 옛날', status: '완료', completed_at: '2026-09-01T01:00:00Z' },
      { id: 3, title: '진행 업무', status: '진행중', due_date: '2026-10-02', priority: '높음' },
    ],
    checks: [{ task_id: 1, questions: ['대사했나요?'], answers: ['SAP와 맞춤'], status: 'submitted', created_at: '2026-09-22' }],
  })
  assert.deepEqual(ctx.일일기록.map(l => [l.날짜, l.구분]), [['2026-09-22', '전주'], ['2026-09-29', '금주']])
  assert.equal(ctx.완료업무.length, 1)
  assert.equal(ctx.완료업무[0].구분, '전주')
  assert.match(ctx.완료업무[0].완료점검, /SAP와 맞춤/)
  assert.deepEqual(ctx.진행업무, [{ 제목: '진행 업무', 상태: '진행중', 마감일: '2026-10-02', 우선순위: '높음' }])
})

test('대화 정리: 최근 턴만, 마지막은 내 요청, 앞쪽 비서몬 답은 버림', () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }))
  const cleaned = cleanChat(many)
  assert.equal(cleaned[0].role, 'user')
  assert.equal(cleaned.at(-1).content, 'm14')
  assert.ok(cleaned.length <= 12)
  assert.throws(() => cleanChat([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]), /마지막/)
  assert.throws(() => cleanChat([{ role: 'system', content: 'x' }]), /형식/)
  assert.throws(() => cleanChat([{ role: 'user', content: 'x'.repeat(4001) }]), /이내/)
})

test('비서몬 답변 검증과 화면 이름 변환', () => {
  assert.deepEqual(validateDeskReply({ reply: ' ■ 전주 실적 ' }), { reply: '■ 전주 실적' })
  assert.throws(() => validateDeskReply({ reply: '' }))
  assert.throws(() => validateDeskReply({ text: 'x' }))
  assert.equal(assistantMessage('오늘의 AI 호출 상한에 도달했습니다.'), '오늘의 비서몬 호출 상한에 도달했습니다.')
})
