'use client'
import { useState, useMemo } from 'react'
import {
  format, differenceInCalendarDays, addDays,
  startOfMonth, endOfMonth, eachMonthOfInterval,
  startOfWeek, endOfWeek, eachWeekOfInterval, eachDayOfInterval,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react'

// 상태별 색상
const C = {
  done:     { bg: '#DCFCE7', br: '#16A34A', tx: '#166534' },
  overdue:  { bg: '#FEE2E2', br: '#DC2626', tx: '#B91C1C' },
  active:   { bg: '#E0E7FF', br: '#4F46E5', tx: '#3730A3' },
  upcoming: { bg: '#F1F5F9', br: '#94A3B8', tx: '#475569' },
}

const LEFT = '210px'

function parseDate(v) {
  if (!v) return null
  const s = String(v).split('T')[0]
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export default function CompactTimeline({ tasks = [], onTaskClick, onToggleComplete }) {
  const [scale, setScale] = useState('month') // 'day' | 'week' | 'month'
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const rows = useMemo(() => {
    return tasks.map(t => {
      const s = parseDate(t.start_date || t.created_at)
      const e = parseDate(t.due_date || t.start_date || t.created_at)
      if (!s || !e) return null
      const start = s <= e ? s : e
      const end = s <= e ? e : s
      const done = t.status === '완료'
      const overdue = !done && end < today
      const active = !done && start <= today && today <= end
      return { raw: t, id: t.id, name: t.title, assignee: t.assignee, start, end, done, overdue, active }
    }).filter(Boolean).sort((a, b) => a.start - b.start || a.end - b.end)
  }, [tasks, today])

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (rows.length === 0) {
      const a = startOfMonth(today), b = endOfMonth(today)
      return { rangeStart: a, rangeEnd: b, totalDays: differenceInCalendarDays(b, a) + 1 }
    }
    let min = rows[0].start, max = rows[0].end
    rows.forEach(r => { if (r.start < min) min = r.start; if (r.end > max) max = r.end })
    const rs = startOfMonth(min), re = endOfMonth(max)
    return { rangeStart: rs, rangeEnd: re, totalDays: differenceInCalendarDays(re, rs) + 1 }
  }, [rows, today])

  const dayW = (1 / totalDays) * 100
  const pct = (date) => (differenceInCalendarDays(date, rangeStart) / totalDays) * 100
  const todayLeft = today >= rangeStart && today <= rangeEnd ? pct(today) : null

  // 눈금(틱) — 항상 전체 기간을 100% 너비에 맞춤. scale 은 라벨/격자 밀도만 바꿈
  const ticks = useMemo(() => {
    const clampW = (a, b) => {
      const s = a < rangeStart ? rangeStart : a
      const e = b > rangeEnd ? rangeEnd : b
      return (differenceInCalendarDays(e, s) + 1) / totalDays * 100
    }
    let arr = []
    if (scale === 'month') {
      arr = eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map(d => ({
        key: +d, left: pct(startOfMonth(d) < rangeStart ? rangeStart : startOfMonth(d)),
        width: clampW(startOfMonth(d), endOfMonth(d)), label: format(d, 'yyyy.M', { locale: ko }), minLabel: 0,
      }))
    } else if (scale === 'week') {
      arr = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 }).map(d => {
        const ws = startOfWeek(d, { weekStartsOn: 1 }), we = endOfWeek(d, { weekStartsOn: 1 })
        return { key: +ws, left: pct(ws < rangeStart ? rangeStart : ws), width: clampW(ws, we), label: format(ws < rangeStart ? rangeStart : ws, 'M/d'), minLabel: 3 }
      })
    } else {
      arr = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map(d => ({
        key: +d, left: pct(d), width: dayW, label: format(d, 'd'), minLabel: 1.6,
      }))
    }
    return arr
  }, [scale, rangeStart, rangeEnd, totalDays])

  const ScaleSwitcher = () => (
    <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 rounded-lg p-0.5 text-xs font-bold">
      {[['day', '일간'], ['week', '주간'], ['month', '월간']].map(([v, label]) => (
        <button key={v} onClick={() => setScale(v)}
          className={`px-3 py-1 rounded-md transition-colors ${scale === v ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
          {label}
        </button>
      ))}
    </div>
  )

  if (rows.length === 0) {
    return (
      <div className="w-full">
        <div className="flex justify-end mb-3"><ScaleSwitcher /></div>
        <div className="h-44 flex flex-col items-center justify-center text-slate-400">
          <p>등록된 업무가 없습니다.</p>
          <p className="text-sm mt-1">상단 '일정 추가' 버튼으로 업무를 등록하세요.</p>
        </div>
      </div>
    )
  }

  const Gridlines = () => (
    <div className="absolute inset-0 flex pointer-events-none">
      {ticks.map(t => <div key={t.key} style={{ width: `${t.width}%` }} className="border-l border-slate-100 dark:border-slate-700/40" />)}
    </div>
  )

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400">업무 {rows.length}건</span>
        <ScaleSwitcher />
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {/* 눈금 헤더 */}
        <div className="grid bg-slate-50/70 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700" style={{ gridTemplateColumns: `${LEFT} minmax(0, 1fr)` }}>
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase">담당자 · 기간</div>
          <div className="flex overflow-hidden">
            {ticks.map(t => (
              <div key={t.key} style={{ width: `${t.width}%` }} className="text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 py-2 border-l border-slate-100 dark:border-slate-700/50 overflow-hidden whitespace-nowrap">
                {t.width >= t.minLabel ? t.label : ''}
              </div>
            ))}
          </div>
        </div>

        {/* 업무 행 */}
        <div className="max-h-[56vh] overflow-y-auto overflow-x-hidden">
          {rows.map(r => {
            const c = r.done ? C.done : r.overdue ? C.overdue : r.active ? C.active : C.upcoming
            const left = Math.max(0, pct(r.start))
            const width = Math.max(1.2, pct(r.end) + dayW - left)
            return (
              <div key={r.id} className="grid border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/60 dark:hover:bg-slate-700/20" style={{ gridTemplateColumns: `${LEFT} minmax(0, 1fr)` }}>
                {/* 좌측: 체크 + 정보 */}
                <div className="px-3 py-2 flex items-center gap-2 overflow-hidden">
                  <button onClick={() => onToggleComplete && onToggleComplete(r.id, r.done)} title={r.done ? '완료 취소' : '완료 처리'} className="shrink-0">
                    {r.done ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} className="text-slate-300 dark:text-slate-600 hover:text-indigo-400" />}
                  </button>
                  <div className="min-w-0 cursor-pointer" onClick={() => onTaskClick && onTaskClick(r.raw)}>
                    <div className={`text-[13px] font-bold truncate flex items-center gap-1 ${r.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {r.overdue && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                      {r.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{r.assignee || '미정'} · {format(r.start, 'M/d')}~{format(r.end, 'M/d')}</div>
                  </div>
                </div>
                {/* 우측: 타임라인 트랙 */}
                <div className="relative overflow-hidden min-h-[40px]">
                  <Gridlines />
                  {todayLeft != null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-400/70 z-10 pointer-events-none" style={{ left: `${todayLeft}%` }} />}
                  {(() => {
                    const inside = width >= 14          // 막대가 충분히 넓으면 안에 글자
                    const nearRight = (left + width) > 80 // 우측 끝이면 라벨을 왼쪽에
                    return (
                      <>
                        <button onClick={() => onTaskClick && onTaskClick(r.raw)} title={r.name}
                          className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center px-2 overflow-hidden transition-all hover:brightness-95"
                          style={{ left: `${left}%`, width: `${width}%`, background: c.bg, borderLeft: `3px solid ${c.br}` }}>
                          {inside && <span className={`text-[11px] font-bold truncate ${r.done ? 'line-through' : ''}`} style={{ color: c.tx }}>{r.name}</span>}
                        </button>
                        {!inside && (
                          <span onClick={() => onTaskClick && onTaskClick(r.raw)} title={r.name}
                            className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-bold whitespace-nowrap cursor-pointer leading-none ${r.done ? 'text-slate-400 line-through' : r.overdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}
                            style={nearRight ? { right: `calc(${100 - left}% + 6px)` } : { left: `calc(${left + width}% + 6px)` }}>
                            {r.name}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400 mt-2.5 px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm" style={{ background: C.active.bg, borderLeft: `2px solid ${C.active.br}` }} /> 진행</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm" style={{ background: C.upcoming.bg, borderLeft: `2px solid ${C.upcoming.br}` }} /> 예정</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm" style={{ background: C.done.bg, borderLeft: `2px solid ${C.done.br}` }} /> 완료</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm" style={{ background: C.overdue.bg, borderLeft: `2px solid ${C.overdue.br}` }} /> 지연</span>
        <span className="flex items-center gap-1"><span className="inline-block w-0.5 h-3 bg-red-400/70" /> 오늘</span>
        <span className="ml-auto">○ 클릭 = 완료 · 막대 클릭 = 상세</span>
      </div>
    </div>
  )
}
