// 내 작업공간 · 비서몬 대화: 서버·테스트 공용 순수 함수
import { DATE_LIKE } from './review-utils.mjs'
import { checkDigest } from './check-utils.mjs'
import { weekRange, addDays, seoulDate } from '../weekly-utils.mjs'

const cut = (value, max) => {
  const text = String(value ?? '').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export const LOG_MAX = 8000
export const CHAT_TURNS = 12
export const CHAT_MESSAGE_MAX = 4000

// 회의 기준 주(금주)와 전주. 두 주를 합친 기간의 기록을 비서몬에게 준다.
export function deskRange(date = seoulDate()) {
  const week = weekRange(date)
  const prev = weekRange(addDays(week.start, -7))
  return { week: { start: week.start, end: week.end }, prev: { start: prev.start, end: prev.end } }
}

// 숫자 가림을 켜도 회의자료에 숫자가 살아 있도록, 숫자를 [#1] 같은 자리표시로 바꿔 보내고 답에서 되돌린다.
// 같은 숫자는 같은 자리표시를 쓴다. 날짜·주차·시각은 가리지 않는다.
export function createMasker() {
  const values = []
  const index = new Map()
  const mask = text => {
    const kept = []
    const hold = String(text ?? '').replace(DATE_LIKE, match => String.fromCharCode(0xE000 + kept.push(match) - 1))
    return hold
      .replace(/\d+(?:[,.]\d+)*/g, number => {
        if (!index.has(number)) index.set(number, values.push(number))
        return `[#${index.get(number)}]`
      })
      .replace(/[-]/g, ch => kept[ch.charCodeAt(0) - 0xE000] ?? '')
  }
  const restore = text => String(text ?? '').replace(/\[#(\d+)\]/g, (match, k) => values[Number(k) - 1] ?? match)
  return { mask, restore }
}

// 비서몬에게 보내는 업무 자료. 필요한 칸만, 길이를 잘라서.
export function deskContext({ today, range, logs = [], tasks = [], checks = [], reports = [] }) {
  const { week, prev } = range
  const part = date => (date >= week.start ? '금주' : '전주')
  const checkByTask = new Map()
  for (const c of [...checks].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) checkByTask.set(String(c.task_id), c)
  const done = tasks.filter(t => t.status === '완료' && t.completed_at)
    .map(t => ({ ...t, doneDate: seoulDate(t.completed_at) }))
    .filter(t => t.doneDate >= prev.start && t.doneDate <= week.end)
    .sort((a, b) => a.doneDate.localeCompare(b.doneDate))
  const open = tasks.filter(t => t.status !== '완료')
  return {
    오늘: today,
    전주: `${prev.start} ~ ${prev.end}`,
    금주: `${week.start} ~ ${week.end}`,
    일일기록: [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date))
      .map(l => ({ 날짜: l.log_date, 구분: part(l.log_date), 내용: cut(l.content, 3000) })),
    완료업무: done.slice(-60).map(t => {
      const digest = checkDigest(checkByTask.get(String(t.id)), 120)
      return { 제목: cut(t.title, 200), 완료일: t.doneDate, 구분: part(t.doneDate), ...(t.deliverable_url ? { 산출물: cut(t.deliverable_url, 200) } : {}), ...(digest ? { 완료점검: digest.trim() } : {}) }
    }),
    진행업무: open.slice(0, 40).map(t => ({ 제목: cut(t.title, 200), 상태: t.status, ...(t.due_date ? { 마감일: t.due_date } : {}), ...(t.priority ? { 우선순위: t.priority } : {}), ...(t.delay_reason ? { 지연사유: cut(t.delay_reason, 300) } : {}) })),
    주간보고: reports.map(r => ({ 주차: r.week_start, 상태: r.status === 'submitted' ? '제출' : '초안', 완료: cut(r.content?.completed, 2000), 진행: cut(r.content?.ongoing, 1500), 다음주: cut(r.content?.nextWeek, 1000), 지연: cut(r.content?.delays, 1000) })),
  }
}

// 화면에서 온 대화: 최근 턴만, 역할·길이 확인. 마지막은 팀원 메시지여야 한다.
export function cleanChat(messages) {
  if (!Array.isArray(messages) || !messages.length) throw new Error('비서몬에게 보낼 메시지가 없습니다.')
  const recent = messages.slice(-CHAT_TURNS).map(m => ({ role: m?.role, content: typeof m?.content === 'string' ? m.content.trim() : '' }))
  if (recent.some(m => !['user', 'assistant'].includes(m.role) || !m.content || m.content.length > 12000)) throw new Error('대화 형식이 올바르지 않습니다.')
  if (recent.some(m => m.role === 'user' && m.content.length > CHAT_MESSAGE_MAX)) throw new Error(`메시지는 ${CHAT_MESSAGE_MAX.toLocaleString()}자 이내로 적어 주세요.`)
  if (recent.at(-1).role !== 'user') throw new Error('마지막 메시지는 내 요청이어야 합니다.')
  while (recent[0]?.role === 'assistant') recent.shift()
  return recent
}

export function validateDeskReply(value) {
  const reply = typeof value?.reply === 'string' ? value.reply.trim() : ''
  if (!reply || reply.length > 12000) throw new Error('비서몬 답변 형식 오류')
  return { reply }
}
