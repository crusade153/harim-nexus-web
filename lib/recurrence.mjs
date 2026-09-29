// 업무 템플릿 반복 규칙 (RRULE 의 일부만 지원). 날짜는 'YYYY-MM-DD' 문자열로만 계산한다.
//   FREQ=DAILY                     매 영업일
//   FREQ=WEEKLY;BYDAY=MO,WE        매주 해당 요일
//   FREQ=MONTHLY;BYMONTHDAY=25     매월 해당 일(짧은 달은 말일)
import { addDays } from './weekly-utils.mjs'
import { isBusinessDay } from './closing-utils.mjs'

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export const RECURRENCE_EXAMPLES = [
  { rule: 'FREQ=DAILY', label: '매 영업일' },
  { rule: 'FREQ=WEEKLY;BYDAY=MO', label: '매주 월요일' },
  { rule: 'FREQ=MONTHLY;BYMONTHDAY=25', label: '매월 25일' }
]

export function parseRecurrence(text) {
  const raw = String(text || '').trim().replace(/^RRULE:/i, '')
  if (!raw) return { ok: true, empty: true }
  const parts = {}
  for (const piece of raw.split(';')) {
    const [key, value] = piece.split('=')
    if (!key || value === undefined) return { ok: false, error: `반복 규칙 형식을 확인해 주세요. (예: ${RECURRENCE_EXAMPLES[1].rule})` }
    parts[key.trim().toUpperCase()] = value.trim().toUpperCase()
  }
  const allowed = ['FREQ', 'BYDAY', 'BYMONTHDAY']
  const extra = Object.keys(parts).find(key => !allowed.includes(key))
  if (extra) return { ok: false, error: `${extra} 는 지원하지 않습니다. FREQ, BYDAY, BYMONTHDAY 만 사용할 수 있습니다.` }

  if (parts.FREQ === 'DAILY') {
    if (parts.BYDAY || parts.BYMONTHDAY) return { ok: false, error: 'DAILY 에는 BYDAY·BYMONTHDAY 를 함께 쓸 수 없습니다.' }
    return { ok: true, freq: 'DAILY' }
  }
  if (parts.FREQ === 'WEEKLY') {
    const days = (parts.BYDAY || '').split(',').filter(Boolean)
    if (!days.length || parts.BYMONTHDAY) return { ok: false, error: 'WEEKLY 는 BYDAY 가 필요합니다. (예: FREQ=WEEKLY;BYDAY=MO)' }
    const indexes = days.map(day => DAY_CODES.indexOf(day))
    if (indexes.some(index => index < 0)) return { ok: false, error: 'BYDAY 는 MO,TU,WE,TH,FR,SA,SU 만 쓸 수 있습니다.' }
    return { ok: true, freq: 'WEEKLY', weekdays: [...new Set(indexes)].sort() }
  }
  if (parts.FREQ === 'MONTHLY') {
    const day = Number(parts.BYMONTHDAY)
    if (!Number.isInteger(day) || day < 1 || day > 31 || parts.BYDAY) return { ok: false, error: 'MONTHLY 는 BYMONTHDAY=1~31 이 필요합니다. (예: FREQ=MONTHLY;BYMONTHDAY=25)' }
    return { ok: true, freq: 'MONTHLY', monthday: day }
  }
  return { ok: false, error: '지원하는 FREQ 는 DAILY, WEEKLY, MONTHLY 입니다.' }
}

export function describeRecurrence(text) {
  const parsed = parseRecurrence(text)
  if (!parsed.ok || parsed.empty) return ''
  if (parsed.freq === 'DAILY') return '매 영업일'
  if (parsed.freq === 'WEEKLY') return `매주 ${parsed.weekdays.map(index => DAY_LABELS[index]).join('·')}요일`
  return `매월 ${parsed.monthday}일`
}

function lastDayOfMonth(date) {
  const [y, m] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function recurrenceMatches(text, date) {
  const parsed = parseRecurrence(text)
  if (!parsed.ok || parsed.empty) return false
  if (parsed.freq === 'DAILY') return true
  if (parsed.freq === 'WEEKLY') return parsed.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
  const day = Number(date.slice(8, 10))
  return day === Math.min(parsed.monthday, lastDayOfMonth(date))
}

// 오늘(영업일)과, 직전 영업일 다음 날부터 오늘 전날까지의 휴일. 휴일에 걸린 반복·마감이 오늘 처리되도록 한다.
export function datesSinceLastBusinessDay(today, holidays = []) {
  const dates = [today]
  for (let i = 1, day = addDays(today, -1); i <= 14; i++, day = addDays(day, -1)) {
    if (isBusinessDay(day, holidays)) break
    dates.unshift(day)
  }
  return dates
}
