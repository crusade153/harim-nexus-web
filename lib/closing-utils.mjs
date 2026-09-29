// 월마감 일정 계산. 날짜는 'YYYY-MM-DD' 문자열로만 다룬다(시간대 변환 회피).
import { addDays } from './weekly-utils.mjs'

// 관리자가 /closing 에서 고칠 수 있는 기본 공휴일 목록(대체공휴일 포함).
// ⚠️ 음력 공휴일·대체공휴일·임시공휴일은 정부 발표로 확인할 것.
export const DEFAULT_HOLIDAYS = [
  '2026-10-05', '2026-10-09', '2026-12-25',
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13',
  '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11', '2027-12-27',
]

const DATE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidDate(value) {
  if (!DATE.test(value || '')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function isValidPeriod(value) {
  return PERIOD.test(value || '')
}

export function normalizeHolidays(values) {
  return [...new Set((values || []).map(v => String(v).trim()).filter(isValidDate))].sort()
}

export function isBusinessDay(date, holidays = []) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  if (day === 0 || day === 6) return false
  return !(holidays instanceof Set ? holidays : new Set(holidays)).has(date)
}

// 기준일이 휴일이면 다음 영업일로 옮긴 뒤 n 영업일을 더한다. (n=0 → 기준일 당일 또는 그다음 영업일)
export function addBusinessDays(date, n, holidays = []) {
  const set = holidays instanceof Set ? holidays : new Set(holidays)
  let current = date
  while (!isBusinessDay(current, set)) current = addDays(current, 1)
  for (let left = Math.max(0, Math.floor(n)); left > 0;) {
    current = addDays(current, 1)
    if (isBusinessDay(current, set)) left--
  }
  return current
}

// 두 날짜 사이 영업일 차이 (start 포함 안 함, end 포함). end < start 면 음수가 아니라 0.
export function businessDaysBetween(start, end, holidays = []) {
  const set = holidays instanceof Set ? holidays : new Set(holidays)
  let count = 0
  for (let current = start; current < end;) {
    current = addDays(current, 1)
    if (isBusinessDay(current, set)) count++
  }
  return count
}

export function nextPeriod(period) {
  const [y, m] = period.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function previousPeriod(period) {
  const [y, m] = period.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// 마감 대상월(period)의 다음 달 첫 영업일 = 마감 시작일 기본값. (9월 마감 → 10월 첫 영업일)
export function defaultRunStart(period, holidays = []) {
  return addBusinessDays(`${nextPeriod(period)}-01`, 0, holidays)
}

// 오늘 기준 기본 마감 대상월 = 지난달
export function defaultPeriod(today) {
  return previousPeriod(today.slice(0, 7))
}

// 템플릿 항목 → 생성할 업무. offset = 시작일로부터 몇 영업일째(0 = 시작일)
export function buildClosingTasks(items, { period, startDate, holidays = [], members = [] }) {
  const byId = new Map(members.map(m => [Number(m.id), m]))
  return [...items]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.offset_days ?? 0) - (b.offset_days ?? 0) || a.id - b.id)
    .map(item => {
      const assignee = byId.get(Number(item.default_assignee_member_id)) || null
      const reference = item.reference_url ? `\n참고: ${item.reference_url}` : ''
      return {
        item_id: item.id,
        title: `[${period} 마감] ${item.title}`,
        content: `${item.description || ''}${reference}`.trim(),
        due_date: addBusinessDays(startDate, item.offset_days || 0, holidays),
        assignee_member_id: assignee ? assignee.id : null,
        assignee: assignee ? assignee.name : null,
      }
    })
}

export function closingProgress(tasks, today) {
  const total = tasks.length
  const done = tasks.filter(t => t.status === '완료').length
  const overdue = tasks.filter(t => t.status !== '완료' && t.due_date && t.due_date < today).length
  return { total, done, overdue, rate: total ? Math.round((done / total) * 100) : 0 }
}
