export function sanitizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function classifyDueDate(dueDate, today) {
  if (!dueDate) return 'upcoming'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'upcoming'
}

export function safeStorageFileName(value) {
  const normalized = String(value || '').normalize('NFKC')
  const safe = normalized.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').slice(-120)
  return safe || 'file'
}


// ------------------------------------------------------------------
// 빠른 업무 추가: "원가표 검토 @홍길동 ~금 !높음"
//   @이름  담당자      ~날짜  마감일(오늘·내일·모레·월~일·9/30·2026-09-30)
//   !우선순위  낮음·보통·높음·긴급      나머지 글자  업무 제목
// 날짜 계산은 'YYYY-MM-DD' 문자열끼리 해서 시간대 변환 문제를 피한다.
// ------------------------------------------------------------------
const PRIORITIES = ['낮음', '보통', '높음', '긴급']
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function resolveQuickDate(token, today) {
  const value = String(token || '').trim().replace(/요일$/, '')
  if (!value) return null
  if (value === '오늘') return today
  if (value === '내일') return addDays(today, 1)
  if (value === '모레') return addDays(today, 2)
  const weekday = WEEKDAYS.indexOf(value)
  if (weekday >= 0) {
    const [y, m, d] = today.split('-').map(Number)
    const current = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    return addDays(today, (weekday - current + 7) % 7)
  }
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`
  match = value.match(/^(\d{1,2})[/.](\d{1,2})$/)
  if (match) {
    const year = Number(today.slice(0, 4))
    const candidate = `${year}-${pad(match[1])}-${pad(match[2])}`
    return candidate < today ? `${year + 1}-${pad(match[1])}-${pad(match[2])}` : candidate
  }
  return null
}

export function parseQuickTask(text, today) {
  const result = { title: '', assigneeName: null, dueDate: null, priority: '보통' }
  const words = []
  for (const token of String(text || '').trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith('@') && token.length > 1 && !result.assigneeName) {
      result.assigneeName = token.slice(1)
    } else if (token.startsWith('~') && token.length > 1 && !result.dueDate && resolveQuickDate(token.slice(1), today)) {
      result.dueDate = resolveQuickDate(token.slice(1), today)
    } else if (token.startsWith('!') && PRIORITIES.includes(token.slice(1))) {
      result.priority = token.slice(1)
    } else {
      words.push(token)
    }
  }
  result.title = words.join(' ')
  return result
}
