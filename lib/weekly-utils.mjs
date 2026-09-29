// 날짜 경계는 한국 업무일 기준. 날짜 문자열의 덧셈만 UTC를 사용한다.
export function seoulDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function weekRange(date = seoulDate()) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  const start = addDays(date, -((day + 6) % 7))
  return { start, end: addDays(start, 6), nextStart: addDays(start, 7), nextEnd: addDays(start, 13) }
}

export const REPORT_FIELDS = [['completed', '이번 주 완료'], ['ongoing', '진행 중'], ['nextWeek', '다음 주 마감'], ['delays', '지연 사유·지원 요청']]

export function buildWeeklyDraft(tasks, weekStart, confirmedReviews = [], today = seoulDate()) {
  const { start, end, nextStart, nextEnd } = weekRange(weekStart)
  const cutoff = today < end ? today : end
  const active = tasks.filter(t => !t.deleted_at && (!t.created_at || seoulDate(t.created_at) <= end))
  const open = active.filter(t => t.status !== '완료')
  const line = t => `• ${t.title || '제목 없음'}${t.due_date ? ` (마감 ${t.due_date})` : ''}`
  const completed = active.filter(t => t.status === '완료' && t.completed_at && seoulDate(t.completed_at) >= start && seoulDate(t.completed_at) <= end)
  const summaryByTask = new Map(confirmedReviews.filter(r => r.status === 'confirmed' && r.entity_type === 'task').map(r => [String(r.entity_id), r.summary]))
  const summaryText = t => {
    const summary = summaryByTask.get(String(t.id))
    return summary ? `\n  확인한 AI 요약: ${summary.done}\n  근거: ${summary.evidence}\n  다음: ${summary.next}\n  리스크: ${summary.risks}` : ''
  }
  return {
    completed: completed.map(t => `${line(t)}${t.deliverable_url ? `\n  산출물: ${t.deliverable_url}` : ''}${summaryText(t)}`).join('\n'),
    ongoing: open.filter(t => t.status === '진행중' && (!t.start_date || t.start_date <= end)).map(line).join('\n'),
    nextWeek: open.filter(t => t.due_date >= nextStart && t.due_date <= nextEnd).map(line).join('\n'),
    delays: open.filter(t => t.due_date && t.due_date < cutoff).map(t => `${line(t)}\n  사유: ${t.delay_reason || '미입력 — 작성해 주세요.'}${summaryText(t)}`).join('\n'),
  }
}
