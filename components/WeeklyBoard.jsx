'use client'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Circle, Users, User } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, isSameDay, differenceInCalendarDays } from 'date-fns'
import { ko } from 'date-fns/locale'

// 프로젝트별 색상 팔레트 (라벨 / 막대 배경 / 막대 텍스트)
const PALETTE = [
  { bar: '#C7D2FE', text: '#3730A3', dot: '#4F46E5' }, // 인디고
  { bar: '#A7F3D0', text: '#065F46', dot: '#059669' }, // 에메랄드
  { bar: '#FBCFE8', text: '#9D174D', dot: '#DB2777' }, // 핑크
  { bar: '#FED7AA', text: '#9A3412', dot: '#EA580C' }, // 오렌지
  { bar: '#BFDBFE', text: '#1E40AF', dot: '#2563EB' }, // 블루
  { bar: '#DDD6FE', text: '#5B21B6', dot: '#7C3AED' }, // 바이올렛
  { bar: '#99F6E4', text: '#115E59', dot: '#0D9488' }, // 틸
  { bar: '#FDE68A', text: '#92400E', dot: '#D97706' }, // 앰버
]

// 'YYYY-MM-DD' / ISO 문자열을 날짜(시각 0시)로 안전 파싱
function parseDate(v) {
  if (!v) return null
  const s = String(v).split('T')[0]
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export default function WeeklyBoard({ tasks = [], members = [], projects = [], currentUser, onTaskClick, onToggleComplete }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [onlyMine, setOnlyMine] = useState(false)
  // 로그인 사용자 → 팀원 매칭(ID 우선, 없으면 이름). 표기 차이 흡수
  const myName = useMemo(() => {
    const byId = members.find(m => String(m.ID) === String(currentUser?.ID))
    return (byId?.이름 || currentUser?.이름 || '').trim()
  }, [members, currentUser])

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const weekStart = useMemo(() => addWeeks(startOfWeek(today, { weekStartsOn: 1 }), weekOffset), [today, weekOffset])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // 프로젝트ID -> 색상 매핑
  const colorOf = useMemo(() => {
    const map = {}
    projects.forEach((p, i) => { map[String(p.ID)] = PALETTE[i % PALETTE.length] })
    return (id) => map[String(id)] || PALETTE[(Number(id) || 0) % PALETTE.length]
  }, [projects])
  const projectName = useMemo(() => {
    const map = {}
    projects.forEach(p => { map[String(p.ID)] = p.제목 })
    return (id) => map[String(id)] || '기타'
  }, [projects])

  // 이번 주에 걸치는 업무만 가공
  const weekTasks = useMemo(() => {
    return tasks
      .map(t => {
        const s = parseDate(t.시작일 || t.마감일)
        const e = parseDate(t.마감일 || t.시작일)
        if (!s || !e) return null
        const start = s <= e ? s : e
        const end = s <= e ? e : s
        if (end < weekStart || start > weekEnd) return null // 이번 주와 무관
        const barStart = start < weekStart ? weekStart : start
        const barEnd = end > weekEnd ? weekEnd : end
        const startCol = differenceInCalendarDays(barStart, weekStart) // 0~6
        const span = Math.min(7 - startCol, differenceInCalendarDays(barEnd, barStart) + 1)
        const done = t.상태 === '완료' || t.완료
        const overdue = !done && end < today
        const isToday = start <= today && today <= end
        return {
          ...t,
          assignee: (t.담당자명 || t.assignee || '').trim(),
          startCol, span, done, overdue, isToday,
          color: colorOf(t.프로젝트ID),
        }
      })
      .filter(Boolean)
  }, [tasks, weekStart, weekEnd, today, colorOf])

  // 담당자(멤버) -> 업무 그룹핑. 멤버에 없는 담당자는 '미지정'으로
  const rows = useMemo(() => {
    const memberNames = new Set(members.map(m => m.이름))
    const buckets = new Map()
    members.forEach(m => buckets.set(m.이름, []))
    let unassigned = []
    weekTasks.forEach(t => {
      if (t.assignee && memberNames.has(t.assignee)) buckets.get(t.assignee).push(t)
      else unassigned.push(t)
    })
    let result = members.map(m => ({ name: m.이름, position: m.직위, tasks: buckets.get(m.이름) }))
    if (unassigned.length) result.push({ name: '미지정', position: '담당자 없음', tasks: unassigned })
    if (onlyMine && myName) result = result.filter(r => (r.name || '').trim() === myName)
    return result
  }, [weekTasks, members, onlyMine, myName])

  // 상단 요약
  const summary = useMemo(() => {
    const visible = onlyMine && myName ? weekTasks.filter(t => (t.assignee || '').trim() === myName) : weekTasks
    return {
      total: visible.length,
      today: visible.filter(t => t.isToday && !t.done).length,
      done: visible.filter(t => t.done).length,
      overdue: visible.filter(t => t.overdue).length,
    }
  }, [weekTasks, onlyMine, myName])

  const todayIndex = days.findIndex(d => isSameDay(d, today))

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더: 주차 네비게이션 + 필터 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"><ChevronLeft size={18} /></button>
            <button onClick={() => setWeekOffset(0)} className={`px-3 py-2 text-xs font-bold border-x border-slate-200 dark:border-slate-700 ${weekOffset === 0 ? 'text-indigo-600' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>이번 주</button>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500"><ChevronRight size={18} /></button>
          </div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {format(weekStart, 'M.d', { locale: ko })} ~ {format(weekEnd, 'M.d', { locale: ko })}
            {weekOffset === 0 && <span className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">현재</span>}
          </div>
        </div>
        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs font-bold">
          <button onClick={() => setOnlyMine(false)} className={`px-3 py-2 flex items-center gap-1.5 ${!onlyMine ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users size={14} /> 팀 전체</button>
          <button onClick={() => setOnlyMine(true)} className={`px-3 py-2 flex items-center gap-1.5 ${onlyMine ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><User size={14} /> 내 업무만</button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="이번주 업무" value={summary.total} />
        <SummaryCard label="오늘 할 일" value={summary.today} accent="text-indigo-600" />
        <SummaryCard label="완료" value={summary.done} accent="text-green-600" />
        <SummaryCard label="지연" value={summary.overdue} accent="text-red-500" />
      </div>

      {/* 스윔레인 보드 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {/* 요일 헤더 */}
        <div className="grid border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30" style={{ gridTemplateColumns: '150px repeat(7, 1fr)' }}>
          <div className="px-3 py-2.5 text-xs font-bold text-slate-400 uppercase">담당자</div>
          {days.map((d, i) => {
            const isToday = i === todayIndex
            const weekend = i >= 5
            return (
              <div key={i} className={`px-1 py-2.5 text-center text-xs font-bold border-l border-slate-100 dark:border-slate-700/50 ${isToday ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600' : weekend ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                {format(d, 'EEE', { locale: ko })} <span className="ml-0.5">{format(d, 'd')}</span>
              </div>
            )
          })}
        </div>

        {/* 멤버 행 */}
        {rows.map((row, ri) => {
          const isMe = currentUser && row.name === currentUser.이름
          const todayCnt = row.tasks.filter(t => t.isToday && !t.done).length
          return (
            <div key={ri} className="grid border-b border-slate-100 dark:border-slate-700/50 last:border-b-0" style={{ gridTemplateColumns: '150px 1fr' }}>
              {/* 멤버 정보 */}
              <div className={`px-3 py-2.5 flex items-center gap-2.5 ${isMe ? 'bg-indigo-50/40 dark:bg-indigo-500/5' : ''}`}>
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isMe ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                  {row.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{row.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {todayCnt > 0 ? <span className="text-indigo-500 font-bold">오늘 {todayCnt}</span> : '오늘 0'} · 주 {row.tasks.length}
                  </div>
                </div>
              </div>

              {/* 주간 그리드 영역 */}
              <div className="relative py-2 min-h-[44px]">
                {/* 배경: 요일 구분선 + 오늘 강조 */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {days.map((d, i) => (
                    <div key={i} className={`border-l border-slate-100 dark:border-slate-700/40 ${i === todayIndex ? 'bg-indigo-50/50 dark:bg-indigo-500/5' : ''}`} />
                  ))}
                </div>
                {/* 업무 막대 */}
                <div className="relative space-y-1 px-1">
                  {row.tasks.length === 0 && (
                    <div className="text-[11px] text-slate-300 dark:text-slate-600 px-2 py-1">— 이번 주 일정 없음</div>
                  )}
                  {row.tasks.map(t => {
                    const tx = t.done ? '#166534' : t.overdue ? '#B91C1C' : t.color.text
                    return (
                      <div key={t.ID} className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        <div
                          title={`[${projectName(t.프로젝트ID)}] ${t.제목}`}
                          className="relative h-7 flex items-center gap-1.5 px-2 rounded-md overflow-hidden ring-1 ring-black/5"
                          style={{
                            gridColumn: `${t.startCol + 1} / span ${t.span}`,
                            background: t.done ? '#DCFCE7' : t.overdue ? '#FEE2E2' : t.color.bar,
                          }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleComplete && onToggleComplete(t.ID, t.done) }}
                            title={t.done ? '완료 취소' : '완료 처리'}
                            className="shrink-0 flex items-center hover:scale-110 transition-transform"
                            style={{ color: tx }}
                          >
                            {t.done ? <CheckCircle2 size={14} /> : <Circle size={14} className="opacity-40 hover:opacity-100" />}
                          </button>
                          <span
                            onClick={() => onTaskClick && onTaskClick(t)}
                            className={`text-xs font-bold truncate cursor-pointer flex items-center gap-1 ${t.done ? 'line-through' : ''}`}
                            style={{ color: tx }}
                          >
                            {t.overdue && <AlertTriangle size={11} className="shrink-0" />}
                            {!t.done && !t.overdue && t.isToday && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color.dot }} />}
                            {t.제목}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="px-3 py-10 text-center text-sm text-slate-400">
            {onlyMine ? '내게 배정된 이번 주 업무가 없습니다.' : '표시할 팀원이 없습니다.'}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> 색 = 프로젝트</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> 오늘 진행중</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-600" /> 완료</span>
        <span className="flex items-center gap-1"><AlertTriangle size={12} className="text-red-500" /> 마감 지난 미완료</span>
        <span>막대 클릭 = 상세·수정</span>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, accent = 'text-slate-800 dark:text-white' }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 border border-slate-100 dark:border-slate-700/50">
      <div className="text-[11px] font-bold text-slate-400 uppercase">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${accent}`}>{value}</div>
    </div>
  )
}
