// 알림함 분류·필터와 마감 일일 요약 알림 문구. 서버(크론)와 화면이 함께 쓴다.

// 저장된 kind 를 화면 묶음으로 나눈다. (icon 은 화면 컴포넌트가 이름으로 고른다)
export const KIND_META = {
  assignment: { group: 'assignment', label: '배정', icon: 'assignment', tone: 'indigo' },
  comment: { group: 'talk', label: '댓글', icon: 'talk', tone: 'sky' },
  mention: { group: 'talk', label: '멘션', icon: 'talk', tone: 'sky' },
  due: { group: 'due', label: '마감', icon: 'due', tone: 'amber' },
  status: { group: 'status', label: '완료·상태', icon: 'status', tone: 'emerald' },
  system: { group: 'system', label: '시스템', icon: 'system', tone: 'slate' },
  automation: { group: 'system', label: '자동화', icon: 'system', tone: 'slate' }
}
const FALLBACK_META = { group: 'system', label: '알림', icon: 'system', tone: 'slate' }
export const kindMeta = kind => KIND_META[kind] || FALLBACK_META

export const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'unread', label: '미확인' },
  { id: 'assignment', label: '배정' },
  { id: 'talk', label: '댓글·멘션' },
  { id: 'due', label: '마감' },
  { id: 'status', label: '완료·상태' },
  { id: 'system', label: '시스템·자동화' }
]

export function matchesFilter(notification, filterId) {
  if (filterId === 'all') return true
  if (filterId === 'unread') return !notification.read_at
  return kindMeta(notification.kind).group === filterId
}

// 필터별 건수 (칩에 표시)
export function countByFilter(notifications) {
  return Object.fromEntries(FILTERS.map(filter => [filter.id, notifications.filter(item => matchesFilter(item, filter.id)).length]))
}

// 알림을 눌렀을 때 이동할 내부 주소. 외부·이상한 주소는 무시하고 항목 종류로 찾는다.
export function safeInternalUrl(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null
}

// "3시간 전" 같은 상대 시간. now 를 넘기면 테스트할 수 있다.
export function relativeTime(value, now = Date.now()) {
  const diff = Math.max(0, now - new Date(value).getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}일 전` : new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

// ---- 마감 일일 요약 ------------------------------------------------------
function daysLate(dueDate, today) {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86400000)
}

function listTitles(items, max = 3) {
  const shown = items.slice(0, max).map(item => item.text).join(', ')
  return items.length > max ? `${shown} 외 ${items.length - max}건` : shown
}

// tasks: 미완료·담당자 있는 업무. dates: 오늘(+직전 영업일 이후 휴일). 담당자마다 1건씩 요약을 만든다.
// 오늘 마감도 지연도 없는 담당자는 만들지 않는다.
export function buildDueSummaries(tasks, dates, today) {
  const first = dates[0]
  const byMember = new Map()
  for (const task of tasks) {
    if (!task.assignee_member_id || !task.due_date || task.status === '완료') continue
    const bucket = dates.includes(task.due_date) ? 'due' : task.due_date < first ? 'overdue' : null
    if (!bucket) continue
    const entry = byMember.get(task.assignee_member_id) || { due: [], overdue: [] }
    entry[bucket].push({ id: task.id, text: bucket === 'overdue' ? `${task.title} (${daysLate(task.due_date, today)}일 지연)` : task.title })
    byMember.set(task.assignee_member_id, entry)
  }
  const summaries = []
  for (const [memberId, entry] of byMember) {
    const parts = []
    if (entry.due.length) parts.push(`오늘 마감 ${entry.due.length}건`)
    if (entry.overdue.length) parts.push(`지연 ${entry.overdue.length}건`)
    const lines = []
    if (entry.due.length) lines.push(`오늘 마감: ${listTitles(entry.due)}`)
    if (entry.overdue.length) lines.push(`지연: ${listTitles(entry.overdue)}`)
    summaries.push({ memberId, dueCount: entry.due.length, overdueCount: entry.overdue.length, title: parts.join(' · '), body: lines.join('\n') })
  }
  return summaries.sort((a, b) => a.memberId - b.memberId)
}
