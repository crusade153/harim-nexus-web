'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isSaturday, isSunday } from 'date-fns'
import { getSampleData } from '@/lib/sheets'
import { ChevronLeft, ChevronRight, Plus, X, Clock, AlignLeft } from 'lucide-react'

export default function CalendarPage({ schedules, onRefresh }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // 새 일정 상태 관리
  const [newSchedule, setNewSchedule] = useState({
    유형: '회의',
    세부유형: '팀회의',
    내용: '',
    시간: '09:00',
    대상자: '전체'
  })

  // 공휴일 데이터 가져오기 (안전장치)
  const sampleData = getSampleData()
  const holidays = sampleData.holidays || []

  // 달력 계산
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  // 핸들러
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToday = () => setCurrentDate(new Date())

  const getHoliday = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidays?.find(h => h.date === dateStr)
  }

  // 날짜 클릭 시 모달 열기
  const handleDateClick = (date) => {
    setSelectedDate(date)
    setNewSchedule({ ...newSchedule, 날짜: format(date, 'yyyy-MM-dd') })
    setIsModalOpen(true)
  }

  // 일정 저장 로직 (Toast 적용)
  const handleSave = () => {
    if (!newSchedule.내용) {
      toast.error('내용을 입력해주세요!')
      return
    }
    
    // 실제로는 여기서 appendSheetData 등을 호출
    toast.success('일정이 등록되었습니다.')
    
    setIsModalOpen(false)
    onRefresh() // 데이터 새로고침
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 1. 헤더 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">캘린더</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">팀원들의 일정과 휴가를 관리하세요.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors">
            <ChevronLeft size={16}/>
          </button>
          <span className="px-4 font-bold text-lg w-32 text-center text-slate-800 dark:text-white tabular-nums">
            {format(currentDate, 'yyyy. MM')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors">
            <ChevronRight size={16}/>
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            오늘
          </button>
        </div>
      </div>

      {/* 2. 달력 그리드 */}
      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-sm font-bold py-3 text-center ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 셀 영역 */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-slate-100 dark:divide-slate-700/50">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const holiday = getHoliday(day)
            const daySchedules = schedules?.filter(s => s.날짜 === dateKey) || []
            const isCurrentMonth = isSameMonth(day, currentDate)
            
            // 날짜 색상
            let dateColor = 'text-slate-700 dark:text-slate-300'
            if (holiday || isSunday(day)) dateColor = 'text-red-500'
            else if (isSaturday(day)) dateColor = 'text-blue-500'
            if (!isCurrentMonth) dateColor = 'text-slate-300 dark:text-slate-600'

            return (
              <div 
                key={dateKey} 
                onClick={() => handleDateClick(day)}
                className={`relative min-h-[100px] p-2 transition-colors cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-700/30
                  ${!isCurrentMonth ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''}
                  ${idx >= 28 ? 'border-b-0' : 'border-b border-slate-100 dark:border-slate-700'} 
                `}
              >
                {/* 날짜 숫자 */}
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                    isSameDay(day, new Date()) 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : dateColor
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {holiday && (
                    <span className="text-[10px] font-bold text-red-500 truncate max-w-[60px] bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                      {holiday.name}
                    </span>
                  )}
                </div>

                {/* 일정 리스트 */}
                <div className="space-y-1">
                  {daySchedules.map((sch, i) => (
                    <div key={i} className={`text-[10px] px-2 py-1 rounded-md border-l-2 truncate font-medium ${
                      sch.유형 === '회의' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-500' :
                      sch.유형 === '연차' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500' :
                      sch.유형 === '외근' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500' :
                      sch.유형 === '반차' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-500' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-400'
                    }`}>
                      {sch.내용}
                    </div>
                  ))}
                </div>

                {/* Hover + 버튼 */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-slate-600 text-indigo-600 dark:text-white flex items-center justify-center shadow-sm">
                    <Plus size={14} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. 일정 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* 모달 헤더 */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="text-indigo-500">📅</span>
                {format(selectedDate, 'M월 d일')} 일정 등록
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* 유형 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">일정 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {['회의', '외근', '연차', '오전반차', '오후반차', '기타'].map(type => (
                    <button
                      key={type}
                      onClick={() => setNewSchedule({...newSchedule, 유형: type})}
                      className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                        newSchedule.유형 === type 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' 
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 시간 및 대상자 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1">
                    <Clock size={12}/> 시간
                  </label>
                  <input
                    type="time"
                    value={newSchedule.시간}
                    onChange={(e) => setNewSchedule({...newSchedule, 시간: e.target.value})}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">대상자</label>
                  <select
                    value={newSchedule.대상자}
                    onChange={(e) => setNewSchedule({...newSchedule, 대상자: e.target.value})}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option>전체</option>
                    <option>유경덕</option>
                    <option>전용주</option>
                    <option>김리아</option>
                    <option>박혜린</option>
                  </select>
                </div>
              </div>

              {/* 내용 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1">
                  <AlignLeft size={12}/> 내용
                </label>
                <input
                  type="text"
                  value={newSchedule.내용}
                  onChange={(e) => setNewSchedule({...newSchedule, 내용: e.target.value})}
                  placeholder="예: 원가팀 주간회의"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                >
                  등록하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}