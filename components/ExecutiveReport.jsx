'use client'
import { useState, useMemo } from 'react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, differenceInCalendarDays
} from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  FileBarChart2, Printer, Users, CheckCircle2, Clock, AlertTriangle,
  FolderKanban, Calendar, TrendingUp
} from 'lucide-react'

function parseDate(v) {
  if (!v) return null
  const s = String(v).split('T')[0]
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export default function ExecutiveReport({ data }) {
  const [period, setPeriod] = useState('weekly') // 'weekly' | 'monthly'

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const { start, end, label } = useMemo(() => {
    if (period === 'weekly') {
      const s = startOfWeek(today, { weekStartsOn: 1 })
      const e = endOfWeek(today, { weekStartsOn: 1 })
      return { start: s, end: e, label: `${format(s, 'M.d', { locale: ko })} ~ ${format(e, 'M.d', { locale: ko })}` }
    }
    const s = startOfMonth(today), e = endOfMonth(today)
    return { start: s, end: e, label: format(today, 'yyyy년 M월', { locale: ko }) }
  }, [period, today])

  const report = useMemo(() => {
    const tasks = data?.tasks || []
    const members = data?.members || []
    const projects = data?.projects || []

    // 기간 내 업무: [시작일, 마감일] 범위가 기간과 겹치면 포함 (기준: 마감일 포함 범위)
    const inPeriod = tasks.filter(t => {
      const s = parseDate(t.시작일 || t.마감일)
      const e = parseDate(t.마감일 || t.시작일)
      if (!s || !e) return false
      const ts = s <= e ? s : e
      const te = s <= e ? e : s
      return ts <= end && te >= start
    })

    const done = inPeriod.filter(t => t.상태 === '완료')
    const ongoing = inPeriod.filter(t => t.상태 === '진행중')
    const completionRate = inPeriod.length ? Math.round((done.length / inPeriod.length) * 100) : 0

    // 지연: 오늘 기준 마감 지난 미완료 업무 (전체 대상 — 사장님 보고용 리스크)
    const overdue = tasks
      .filter(t => {
        if (t.상태 === '완료') return false
        const due = parseDate(t.마감일)
        return due && due < today
      })
      .map(t => ({ ...t, dueDate: parseDate(t.마감일), overDays: differenceInCalendarDays(today, parseDate(t.마감일)) }))
      .sort((a, b) => b.overDays - a.overDays)

    // 인원 현황 (기간 기준 담당 업무 + 지연은 전체 기준)
    const personnel = members.map(m => {
      const mineInPeriod = inPeriod.filter(t => t.담당자명 === m.이름)
      const mDone = mineInPeriod.filter(t => t.상태 === '완료').length
      const mOngoing = mineInPeriod.filter(t => t.상태 === '진행중').length
      const mOverdue = overdue.filter(t => t.담당자명 === m.이름).length
      const rate = mineInPeriod.length ? Math.round((mDone / mineInPeriod.length) * 100) : 0
      return { name: m.이름, position: m.직위, dept: m.부서, total: mineInPeriod.length, done: mDone, ongoing: mOngoing, overdue: mOverdue, rate }
    })

    // 프로젝트 진행 현황 (전체 기준 — 업무 완료율)
    const projectRows = projects.map(p => {
      const todos = p.todos || []
      const pDone = todos.filter(t => t.완료).length
      const rate = todos.length ? Math.round((pDone / todos.length) * 100) : 0
      return { title: p.제목, period: p.기간, author: p.작성자, total: todos.length, done: pDone, rate }
    })

    // 부서 분포
    const deptMap = {}
    members.forEach(m => { const d = m.부서 || '미지정'; deptMap[d] = (deptMap[d] || 0) + 1 })
    const depts = Object.entries(deptMap).map(([name, count]) => ({ name, count }))

    return {
      totalInPeriod: inPeriod.length,
      done: done.length,
      ongoing: ongoing.length,
      overdueCount: overdue.length,
      completionRate,
      overdue,
      personnel,
      projectRows,
      totalMembers: members.length,
      depts,
    }
  }, [data, start, end, today])

  return (
    <div className="max-w-[1100px] mx-auto pb-10">
      {/* 화면 전용 컨트롤 바 (인쇄 시 숨김) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileBarChart2 className="text-indigo-600" /> 경영진 보고 리포트
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">관리자 전용 · 사장님 보고용 요약 (주간/월간)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs font-bold">
            <button onClick={() => setPeriod('weekly')} className={`px-4 py-2 ${period === 'weekly' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>주간</button>
            <button onClick={() => setPeriod('monthly')} className={`px-4 py-2 ${period === 'monthly' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>월간</button>
          </div>
          <button onClick={() => window.print()} className="btn-primary text-xs py-2 px-3"><Printer size={15} /> 인쇄 / PDF 저장</button>
        </div>
      </div>

      {/* 리포트 본문 (인쇄 대상) */}
      <div className="report-sheet bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 print:shadow-none print:border-0">
        {/* 리포트 헤더 */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 dark:border-slate-200 pb-4 mb-6">
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Harim Foods · 원가팀</p>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{period === 'weekly' ? '주간' : '월간'} 업무 · 인원 현황 보고</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Calendar size={14} /> 보고 기간: <b className="text-slate-700 dark:text-slate-200">{label}</b>
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>작성일 {format(today, 'yyyy.MM.dd', { locale: ko })}</p>
            <p className="mt-1">작성자 {data?.currentUser?.이름 || '팀장'}</p>
          </div>
        </div>

        {/* 1. 핵심 지표 */}
        <section className="mb-7">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5"><TrendingUp size={16} className="text-indigo-500" /> 1. 핵심 지표</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Clock size={18} />} tone="indigo" label="기간 내 업무" value={report.totalInPeriod} unit="건" />
            <KpiCard icon={<CheckCircle2 size={18} />} tone="green" label="완료" value={report.done} unit="건" sub={`완료율 ${report.completionRate}%`} />
            <KpiCard icon={<Clock size={18} />} tone="blue" label="진행 중" value={report.ongoing} unit="건" />
            <KpiCard icon={<AlertTriangle size={18} />} tone="red" label="지연 (누적)" value={report.overdueCount} unit="건" />
          </div>
          {/* 완료율 게이지 */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">기간 완료율</span>
            <div className="flex-1 h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all" style={{ width: `${report.completionRate}%` }} />
            </div>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 w-12 text-right">{report.completionRate}%</span>
          </div>
        </section>

        {/* 2. 프로젝트 진행 현황 */}
        <section className="mb-7">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5"><FolderKanban size={16} className="text-indigo-500" /> 2. 프로젝트 진행 현황</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="text-left font-bold px-3 py-2">프로젝트</th>
                  <th className="text-left font-bold px-3 py-2 hidden md:table-cell">기간</th>
                  <th className="text-center font-bold px-3 py-2">업무</th>
                  <th className="text-left font-bold px-3 py-2 w-[38%]">진척률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.projectRows.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{p.title}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400 hidden md:table-cell">{p.period || '-'}</td>
                    <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{p.done}/{p.total}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${p.rate === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${p.rate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-9 text-right">{p.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {report.projectRows.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400 text-xs">등록된 프로젝트가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. 인원 현황 */}
        <section className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"><Users size={16} className="text-indigo-500" /> 3. 인원 현황 <span className="text-slate-400 font-medium">(총 {report.totalMembers}명)</span></h3>
            <div className="flex flex-wrap gap-1.5">
              {report.depts.map((d, i) => (
                <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{d.name} {d.count}</span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="text-left font-bold px-3 py-2">담당자</th>
                  <th className="text-center font-bold px-3 py-2">담당</th>
                  <th className="text-center font-bold px-3 py-2">완료</th>
                  <th className="text-center font-bold px-3 py-2">진행</th>
                  <th className="text-center font-bold px-3 py-2">지연</th>
                  <th className="text-left font-bold px-3 py-2 w-[28%]">완료율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.personnel.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-700 dark:text-slate-200">{m.name}</div>
                      <div className="text-[11px] text-slate-400">{m.position} · {m.dept}</div>
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-200">{m.total}</td>
                    <td className="px-3 py-2 text-center text-green-600 font-bold">{m.done}</td>
                    <td className="px-3 py-2 text-center text-blue-600 font-bold">{m.ongoing}</td>
                    <td className={`px-3 py-2 text-center font-bold ${m.overdue > 0 ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'}`}>{m.overdue}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${m.rate >= 80 ? 'bg-green-500' : m.rate >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} style={{ width: `${m.rate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-9 text-right">{m.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {report.personnel.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400 text-xs">등록된 팀원이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">※ 담당·완료·진행 = 보고 기간(마감일 기준) / 지연 = 오늘 기준 마감 초과 미완료(누적)</p>
        </section>

        {/* 4. 지연·리스크 업무 */}
        <section>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5"><AlertTriangle size={16} className="text-red-500" /> 4. 지연 · 리스크 업무 <span className="text-slate-400 font-medium">({report.overdueCount}건)</span></h3>
          {report.overdue.length > 0 ? (
            <div className="rounded-xl border border-red-100 dark:border-red-500/20 overflow-hidden">
              {report.overdue.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-red-50 dark:border-red-500/10 last:border-b-0 bg-red-50/40 dark:bg-red-500/5">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{t.제목}</span>
                    <span className="text-xs text-slate-400 shrink-0">· {t.담당자명 || '미지정'}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <span className="text-xs text-slate-500">{t.dueDate ? format(t.dueDate, 'M.d') : '-'}</span>
                    <span className="text-xs font-bold text-red-500 whitespace-nowrap">D+{t.overDays}</span>
                  </div>
                </div>
              ))}
              {report.overdue.length > 8 && (
                <div className="px-3 py-2 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800">외 {report.overdue.length - 8}건</div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-green-100 dark:border-green-500/20 bg-green-50/40 dark:bg-green-500/5 px-3 py-4 text-center text-sm text-green-600 font-bold">
              지연된 업무가 없습니다. 👍
            </div>
          )}
        </section>

        {/* 리포트 푸터 */}
        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          본 보고서는 Harim Nexus에서 {format(new Date(), 'yyyy.MM.dd HH:mm')} 자동 생성되었습니다.
        </div>
      </div>

      {/* 인쇄 스타일: 리포트만 남기고 나머지 숨김 */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-sheet, .report-sheet * { visibility: visible !important; }
          .report-sheet {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; border: 0 !important;
            background: #fff !important;
          }
          .no-print { display: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  )
}

function KpiCard({ icon, tone, label, value, unit, sub }) {
  const tones = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  }
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}>{icon}</div>
      <p className="text-[11px] font-bold text-slate-400 uppercase">{label}</p>
      <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{value}<span className="text-sm font-medium text-slate-400 ml-0.5">{unit}</span></p>
      {sub && <p className="text-[11px] font-bold text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
