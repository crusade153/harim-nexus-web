'use client'
import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isSaturday, isSunday } from 'date-fns'
import { getSampleData } from '@/lib/sheets'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

export default function CalendarPage({ schedules, onRefresh }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  
  // 데이터 안전하게 가져오기
  const sampleData = getSampleData()
  const holidays = sampleData.holidays || [] // 안전 장치 추가

  // 달력 날짜 생성 로직
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToday = () => setCurrentDate(new Date())

  // 공휴일 체크 (안전 장치 포함)
  const getHoliday = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidays?.find(h => h.date === dateStr)
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">일정 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">팀 주요 일정을 확인하세요.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><ChevronLeft size={16}/></button>
          <span className="px-4 font-bold text-lg w-32 text-center text-slate-800 dark:text-white tabular-nums">
            {format(currentDate, 'yyyy. MM')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><ChevronRight size={16}/></button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            오늘
          </button>
        </div>
      </div>

      {/* 달력 그리드 */}
      <div className="card-base p-6 min-h-[700px] flex flex-col">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-2 text-center border-b border-slate-100 dark:border-slate-700 pb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-sm font-bold py-2 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-px bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const holiday = getHoliday(day)
            const daySchedules = schedules?.filter(s => s.날짜 === dateKey) || []
            
            let dateColor = 'text-slate-700 dark:text-slate-300'
            if (holiday || isSunday(day)) dateColor = 'text-red-500'
            else if (isSaturday(day)) dateColor = 'text-blue-500'

            const isCurrentMonth = isSameMonth(day, currentDate)
            if (!isCurrentMonth) dateColor = 'text-slate-300 dark:text-slate-600'

            return (
              <div 
                key={dateKey} 
                onClick={() => setSelectedDate(day)}
                className={`bg-white dark:bg-slate-800 min-h-[100px] p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer flex flex-col gap-1 relative group ${
                  !isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-bold ${dateColor} ${
                    isSameDay(day, new Date()) ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 w-6 h-6 rounded-full flex items-center justify-center shadow-md' : ''
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {holiday && (
                    <span className="text-[10px] font-bold text-red-500 truncate max-w-[60px]">
                      {holiday.name}
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1 mt-1 overflow-hidden">
                  {daySchedules.map((sch, i) => (
                    <div key={i} className={`text-[10px] px-1.5 py-0.5 rounded truncate border-l-2 ${
                      sch.유형 === '회의' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-500' :
                      sch.유형 === '연차' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-500'
                    }`}>
                      {sch.내용}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}