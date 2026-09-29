export function validateReview(value, round) {
  if (!value || !['low', 'medium', 'high'].includes(value.risk_level)) throw new Error('비서몬 응답 형식 오류')
  if (!Array.isArray(value.questions) || value.questions.length > 3 || value.questions.some(q => typeof q !== 'string' || !q.trim() || q.length > 500)) throw new Error('비서몬 질문 형식 오류')
  if (round >= 2 && value.questions.length) throw new Error('비서몬 질문 라운드 초과')
  for (const key of ['done', 'evidence', 'next', 'risks']) {
    if (typeof value.summary?.[key] !== 'string' || value.summary[key].length > 3000) throw new Error('비서몬 요약 형식 오류')
  }
  return { questions: value.questions, summary: Object.fromEntries(['done', 'evidence', 'next', 'risks'].map(k => [k, value.summary[k]])), risk_level: value.risk_level }
}

// 날짜·일정 표현은 남기고(마감·지연 확인에 필요) 금액·수량·비율 같은 나머지 숫자만 가린다.
export const DATE_LIKE = /\d{4}-\d{1,2}-\d{1,2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?|\d{4}년|\d{1,2}월(?:\s*\d{1,2}일)?|\d{1,2}일|\d{1,2}\/\d{1,2}(?!\d)|\d+주차|\d{1,2}시(?:\s*\d{1,2}분)?/g
export function maskNumbers(text) {
  const kept = []
  const hold = String(text).replace(DATE_LIKE, match => String.fromCharCode(0xE000 + kept.push(match) - 1))
  return hold
    .replace(/\d+(?:[,.]\d+)*/g, '[숫자]')
    .replace(/[-]/g, ch => kept[ch.charCodeAt(0) - 0xE000] ?? '')
}

// UTF-8 byte 수를 보수적인 입력 토큰 상한으로 예약한다. 실패 시에도 예약은 유지.
export function tokenReservation(messages, maxOutput = 2048) {
  return new TextEncoder().encode(JSON.stringify(messages)).length + maxOutput + 512
}

// DB 함수가 올리는 한도·설정 메시지("오늘의 AI 호출 상한…")를 화면 이름(비서몬)으로 바꾼다.
export function assistantMessage(text) {
  return String(text ?? '').replace(/AI /g, '비서몬 ')
}
