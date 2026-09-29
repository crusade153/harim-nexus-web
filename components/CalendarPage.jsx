'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, isSaturday, isSunday, startOfMonth, startOfWeek, subMonths,
} from 'date-fns'
import { CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Clock, Plus, Trash2, UserRound, X } from 'lucide-react'
import { createAttendanceEvent, createSchedule, deleteAttendanceEvent } from '@/lib/sheets'

const ATTENDANCE_TYPES = [
  { value: 'annual_leave', label: '연차', days: 1, time: '' },
  { value: 'am_half', label: '오전 반차', days: 0.5, time: '09:00' },
  { value: 'pm_half', label: '오후 반차', days: 0.5, time: '14:00' },
  { value: 'quarter_day', label: '반반차', days: 0.25, time: '09:00' },
  { value: 'vacation', label: '휴가', days: 1, time: '' },
  { value: 'business_trip', label: '출장', days: 1, time: '09:00' },
  { value: 'outside_work', label: '외근', days: 1, time: '09:00' },
  { value: 'holiday_work', label: '휴일근로', days: 1, time: '09:00' },
]
const attendanceMap = Object.fromEntries(ATTENDANCE_TYPES.map(type => [type.value, type]))
const legacyTypeMap = { 연차: 'annual_leave', 오전반차: 'am_half', 오후반차: 'pm_half', 반반차: 'quarter_day', 휴가: 'vacation', 출장: 'business_trip', 외근: 'outside_work', 휴일근로: 'holiday_work' }
const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white'

export default function CalendarPage({ schedules = [], tasks = [], attendance = [], attendanceAvailable = true, members = [], currentUser, onRefresh, currentDate, onMonthChange }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [modalType, setModalType] = useState(null)
  const [onlyMine, setOnlyMine] = useState(false)
  const [visible, setVisible] = useState({ task: true, schedule: true, attendance: true })
  const [saving, setSaving] = useState(false)
  const currentMemberId = String(currentUser?.ID || '')
  const isAdmin = currentUser?.역할 === 'admin'
  const [scheduleForm, setScheduleForm] = useState({ 유형: '회의', 내용: '', 시간: '09:00', 대상자: [] })
  const [attendanceForm, setAttendanceForm] = useState({ memberId: currentMemberId, eventType: 'annual_leave', startDate: '', endDate: '', startTime: '', endTime: '', unitDays: 1, note: '' })

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })
  const holidays = [{ date: '2026-01-01', name: '신정' }, { date: '2026-02-16', name: '설날 연휴' }]

  const memberMap = useMemo(() => Object.fromEntries(members.map(member => [String(member.ID), member])), [members])
  const events = useMemo(() => {
    const taskEvents = visible.task ? tasks.filter(task => task.마감일).map(task => ({
      id: `task-${task.ID}`, category: 'task', startDate: task.마감일, endDate: task.마감일,
      memberName: task.담당자명 || '미지정', title: task.제목,
    })) : []
    const regularSchedules = visible.schedule ? schedules.filter(schedule => !legacyTypeMap[schedule.유형]).map(schedule => ({
      id: `schedule-${schedule.ID}`, category: 'schedule', startDate: schedule.날짜, endDate: schedule.날짜,
      memberName: schedule.대상자 || '전체', title: schedule.내용, time: schedule.시간, scheduleType: schedule.유형,
    })) : []
    const attendanceEvents = visible.attendance ? attendance.map(item => ({
      id: item.id, category: 'attendance', startDate: item.startDate, endDate: item.endDate,
      memberId: item.memberId, memberName: memberMap[item.memberId]?.이름 || '팀원',
      title: attendanceMap[item.eventType]?.label || item.eventType, eventType: item.eventType,
      note: item.note, unitDays: item.unitDays,
    })) : []
    const legacyAttendance = visible.attendance && !attendanceAvailable ? schedules.filter(schedule => legacyTypeMap[schedule.유형]).map(schedule => ({
      id: `legacy-${schedule.ID}`, category: 'attendance', startDate: schedule.날짜, endDate: schedule.날짜,
      memberName: schedule.대상자, title: schedule.유형, eventType: legacyTypeMap[schedule.유형], legacy: true,
    })) : []
    const combined = [...taskEvents, ...regularSchedules, ...attendanceEvents, ...legacyAttendance]
    if (!onlyMine) return combined
    return combined.filter(event => event.memberId === currentMemberId || event.memberName?.includes(currentUser?.이름) || event.memberName === '전체')
  }, [attendance, attendanceAvailable, currentMemberId, currentUser?.이름, memberMap, onlyMine, schedules, tasks, visible])

  const openModal = (date, type) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    setSelectedDate(date)
    setModalType(type)
    if (type === 'attendance') setAttendanceForm({ memberId: currentMemberId, eventType: 'annual_leave', startDate: dateKey, endDate: dateKey, startTime: '', endTime: '', unitDays: 1, note: '' })
    else setScheduleForm({ 유형: '회의', 내용: '', 시간: '09:00', 대상자: [] })
  }

  const selectView = mode => {
    if (mode === 'work') setVisible({ task: true, schedule: true, attendance: false })
    else if (mode === 'attendance') setVisible({ task: false, schedule: false, attendance: true })
    else setVisible({ task: true, schedule: true, attendance: true })
  }

  const currentView = visible.task && visible.schedule && visible.attendance ? 'all' : visible.attendance && !visible.task && !visible.schedule ? 'attendance' : visible.task && visible.schedule && !visible.attendance ? 'work' : 'custom'

  const saveSchedule = async () => {
    if (!scheduleForm.내용.trim()) return toast.error('일정 내용을 입력해주세요.')
    setSaving(true)
    try {
      await createSchedule({ ...scheduleForm, 세부유형: '팀일정', 날짜: format(selectedDate, 'yyyy-MM-dd'), 대상자: scheduleForm.대상자.length ? scheduleForm.대상자.join(', ') : '전체' })
      toast.success('팀 일정을 등록했습니다.'); setModalType(null); await onRefresh()
    } catch (error) { toast.error(error.message || '일정을 등록하지 못했습니다.') }
    finally { setSaving(false) }
  }

  const saveAttendance = async () => {
    if (!attendanceForm.memberId) return toast.error('대상 팀원을 선택해주세요.')
    setSaving(true)
    try {
      await createAttendanceEvent(attendanceForm)
      toast.success('근태 일정을 등록했습니다.'); setModalType(null); await onRefresh()
    } catch (error) { toast.error(error.message || '근태 일정을 등록하지 못했습니다.') }
    finally { setSaving(false) }
  }

  const chooseAttendanceType = value => {
    const type = attendanceMap[value]
    setAttendanceForm(form => ({ ...form, eventType: value, unitDays: type.days, startTime: type.time }))
  }

  const removeAttendance = async event => {
    if (event.legacy || (!isAdmin && event.memberId !== currentMemberId)) return
    if (!window.confirm(`${event.memberName}님의 ${event.title} 일정을 삭제할까요?`)) return
    try { await deleteAttendanceEvent(event.id); toast.success('삭제했습니다.'); await onRefresh() }
    catch (error) { toast.error(error.message || '삭제하지 못했습니다.') }
  }

  const display = event => {
    if (event.category === 'task') return { text: `[WBS] ${event.title}`, cls: 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' }
    if (event.category === 'schedule') return { text: `${event.time || ''} [${event.scheduleType}] ${event.title}`, cls: ['출장', '파견'].includes(event.scheduleType) ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' }
    const leave = ['annual_leave', 'am_half', 'pm_half', 'quarter_day', 'vacation'].includes(event.eventType)
    return { text: `[${event.title}] ${event.memberName}`, cls: leave ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-end">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">통합 캘린더</h1><p className="mt-1 text-sm text-slate-500">WBS 업무·팀 일정·근태를 함께 보고, 출장과 파견도 업무 일정으로 남길 수 있어요.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {[['all', '통합'], ['work', '업무만'], ['attendance', '근태만']].map(([id, label]) => <button key={id} onClick={() => selectView(id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${currentView === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{label}</button>)}
          </div>
          <button onClick={() => setOnlyMine(value => !value)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${onlyMine ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800'}`}><UserRound size={14} className="mr-1 inline" />{onlyMine ? '내 일정 표시 중' : '내 일정만'}</button>
          <button onClick={() => openModal(new Date(), 'schedule')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Plus size={14} className="mr-1 inline" />팀 일정</button>
          <button onClick={() => openModal(new Date(), 'attendance')} className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm"><Plus size={14} className="mr-1 inline" />근태 등록</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{[
          ['task', 'WBS 업무', 'bg-violet-500'], ['schedule', '팀 일정', 'bg-blue-500'], ['attendance', '근태·휴가', 'bg-rose-500'],
        ].map(([key, label, color]) => <button key={key} onClick={() => setVisible(value => ({ ...value, [key]: !value[key] }))} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${visible[key] ? 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-800 dark:bg-slate-900'}`}><span className={`h-2 w-2 rounded-full ${visible[key] ? color : 'bg-slate-300'}`} />{label}</button>)}</div>
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"><button onClick={() => onMonthChange(subMonths(currentDate, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronLeft size={16} /></button><button onClick={() => onMonthChange(new Date())} className="w-32 px-3 text-center font-bold text-slate-800 dark:text-white">{format(currentDate, 'yyyy. MM')}</button><button onClick={() => onMonthChange(addMonths(currentDate, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><ChevronRight size={16} /></button></div>
      </div>

      {!attendanceAvailable && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">근태 전용 데이터베이스 적용 전입니다. 기존 개인 일정은 읽기 전용으로 표시됩니다.</div>}

      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">{['일', '월', '화', '수', '목', '금', '토'].map((day, index) => <div key={day} className={`py-3 text-center text-xs font-bold ${index === 0 ? 'text-rose-500' : index === 6 ? 'text-blue-500' : 'text-slate-500'}`}>{day}</div>)}</div>
        <div className="grid flex-1 auto-rows-fr grid-cols-7 divide-x divide-slate-100 dark:divide-slate-700/60">
          {calendarDays.map((day, index) => {
            const key = format(day, 'yyyy-MM-dd')
            const holiday = holidays.find(item => item.date === key)
            const dayEvents = events.filter(event => event.startDate <= key && event.endDate >= key)
            const dateClass = holiday || isSunday(day) ? 'text-rose-500' : isSaturday(day) ? 'text-blue-500' : 'text-slate-700 dark:text-slate-300'
            return <div key={key} onClick={() => openModal(day, currentView === 'attendance' ? 'attendance' : 'schedule')} className={`group relative min-h-[108px] cursor-pointer border-b border-slate-100 p-2 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-700/20 ${!isSameMonth(day, currentDate) ? 'bg-slate-50/50 opacity-55 dark:bg-slate-900/30' : ''}`}>
              <div className="mb-1 flex items-center justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white' : dateClass}`}>{format(day, 'd')}</span>{holiday && <span className="truncate text-[9px] font-bold text-rose-500">{holiday.name}</span>}</div>
              <div className="max-h-[84px] space-y-1 overflow-y-auto">{dayEvents.map(event => { const info = display(event); return <div key={`${event.id}-${key}`} title={event.note || event.title} onClick={e => { e.stopPropagation(); if (event.category === 'attendance') removeAttendance(event) }} className={`group/event flex items-center gap-1 truncate rounded border-l-2 px-2 py-1 text-[10px] font-medium ${info.cls}`}>{event.category === 'task' && <CheckSquare size={10} />}<span className="truncate">{info.text}</span>{event.category === 'attendance' && !event.legacy && (isAdmin || event.memberId === currentMemberId) && <Trash2 size={10} className="ml-auto hidden shrink-0 group-hover/event:block" />}</div> })}</div>
              <Plus size={14} className="absolute bottom-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100" />
            </div>
          })}
        </div>
      </div>

      {modalType && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700"><h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><CalendarDays size={18} className="text-indigo-500" />{selectedDate && format(selectedDate, 'M월 d일')} {modalType === 'attendance' ? '근태 등록' : '팀 일정 등록'}</h3><button onClick={() => setModalType(null)} className="p-2 text-slate-400"><X size={18} /></button></div>
        {modalType === 'attendance' ? <div className="space-y-4 p-6"><div><label className="mb-2 block text-xs font-bold text-slate-500">근태 유형</label><div className="grid grid-cols-4 gap-2">{ATTENDANCE_TYPES.map(type => <button key={type.value} onClick={() => chooseAttendanceType(type.value)} className={`rounded-lg border px-2 py-2.5 text-xs font-bold ${attendanceForm.eventType === type.value ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-500 dark:border-slate-600'}`}>{type.label}</button>)}</div></div>{isAdmin && <div><label className="mb-1 block text-xs font-bold text-slate-500">대상 팀원</label><select value={attendanceForm.memberId} onChange={e => setAttendanceForm({ ...attendanceForm, memberId: e.target.value })} className={inputClass}>{members.map(member => <option key={member.ID} value={member.ID}>{member.이름} · {member.직위}</option>)}</select></div>}<div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-bold text-slate-500">시작일</label><input type="date" value={attendanceForm.startDate} onChange={e => setAttendanceForm({ ...attendanceForm, startDate: e.target.value })} className={inputClass} /></div><div><label className="mb-1 block text-xs font-bold text-slate-500">종료일</label><input type="date" value={attendanceForm.endDate} onChange={e => setAttendanceForm({ ...attendanceForm, endDate: e.target.value })} className={inputClass} /></div></div><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-bold text-slate-500">차감 일수</label><input type="number" min="0.25" step="0.25" value={attendanceForm.unitDays} onChange={e => setAttendanceForm({ ...attendanceForm, unitDays: e.target.value })} className={inputClass} /></div><div><label className="mb-1 block text-xs font-bold text-slate-500">시작 시간</label><input type="time" value={attendanceForm.startTime} onChange={e => setAttendanceForm({ ...attendanceForm, startTime: e.target.value })} className={inputClass} /></div></div><div><label className="mb-1 block text-xs font-bold text-slate-500">메모(선택)</label><input value={attendanceForm.note} onChange={e => setAttendanceForm({ ...attendanceForm, note: e.target.value })} className={inputClass} /></div><button disabled={saving || !attendanceAvailable} onClick={saveAttendance} className="btn-primary w-full disabled:opacity-50">{saving ? '등록 중...' : '근태 등록'}</button></div> : <div className="space-y-4 p-6"><div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-xs font-bold text-slate-500">유형</label><select value={scheduleForm.유형} onChange={e => setScheduleForm({ ...scheduleForm, 유형: e.target.value })} className={inputClass}><option>회의</option><option>교육</option><option>출장</option><option>파견</option><option>행사</option><option>마감</option></select></div><div><label className="mb-1 block text-xs font-bold text-slate-500">시간</label><div className="relative"><Clock size={15} className="absolute left-3 top-3 text-slate-400" /><input type="time" value={scheduleForm.시간} onChange={e => setScheduleForm({ ...scheduleForm, 시간: e.target.value })} className={`${inputClass} pl-9`} /></div></div></div><div><label className="mb-1 block text-xs font-bold text-slate-500">일정 내용</label><input value={scheduleForm.내용} onChange={e => setScheduleForm({ ...scheduleForm, 내용: e.target.value })} className={inputClass} /></div><div><label className="mb-2 block text-xs font-bold text-slate-500">참석자(미선택 시 전체)</label><div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{members.map(member => <label key={member.ID} className="flex items-center gap-2 rounded p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"><input type="checkbox" checked={scheduleForm.대상자.includes(member.이름)} onChange={() => setScheduleForm(form => ({ ...form, 대상자: form.대상자.includes(member.이름) ? form.대상자.filter(name => name !== member.이름) : [...form.대상자, member.이름] }))} />{member.이름}</label>)}</div></div><button disabled={saving} onClick={saveSchedule} className="btn-primary w-full">{saving ? '등록 중...' : '일정 등록'}</button></div>}
      </div></div>}
    </div>
  )
}
