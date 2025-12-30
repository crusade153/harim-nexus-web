'use client'
import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isSaturday, isSunday, parseISO } from 'date-fns'
import { getSampleData } from '@/lib/sheets' // 공휴일 데이터 로드용

export default function CalendarPage({ schedules, onRefresh }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newSchedule, setNewSchedule] = useState({ 유형: '회의', 내용: '', 시간: '09:00' })

  // 공휴일 데이터 가져오기
  const { holidays } = getSampleData()

  // 달력 날짜 생성
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart) // 기본적으로 일요일 시작
  const endDate = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  // 월 이동 함수
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToday = () => setCurrentDate(new Date())

  // 공휴일 체크 함수
  const getHoliday = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidays.find(h => h.date === dateStr)
  }

  // 날짜 클릭 시
  const onDateClick = (date) => {
    setSelectedDate(date)
    setNewSchedule({ 유형: '회의', 내용: '', 시간: '09:00' })
    setIsModalOpen(true)
  }

  // 일정 저장 (임시)
  const handleSave = () => {
    if (!newSchedule.내용) return alert('내용을 입력해주세요!')
    alert('일정이 등록되었습니다! (시트 연동 필요)')
    setIsModalOpen(false)
    onRefresh()
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      {/* 1. 헤더 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일정 관리 📅</h1>
          <p className="text-gray-500 text-sm mt-1">팀원들의 주요 일정을 확인하세요.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">◀</button>
          <span className="px-4 font-bold text-lg w-32 text-center tabular-nums">
            {format(currentDate, 'yyyy. MM')}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">▶</button>
          <div className="w-px h-6 bg-gray-200 mx-1"></div>
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">
            오늘
          </button>
        </div>
      </div>

      {/* 2. 달력 그리드 */}
      <div className="bento-card p-6 min-h-[700px] flex flex-col">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-2 text-center border-b border-gray-100 pb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-sm font-bold py-2 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}>
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const holiday = getHoliday(day)
            const daySchedules = schedules?.filter(s => s.날짜 === dateKey) || []
            
            // 날짜 색상 결정 (공휴일/일요일: 빨강, 토요일: 파랑, 평일: 검정)
            let dateColor = 'text-gray-700'
            if (holiday || isSunday(day)) dateColor = 'text-red-500'
            else if (isSaturday(day)) dateColor = 'text-blue-500'

            // 이번 달이 아닌 날짜 흐리게
            const isCurrentMonth = isSameMonth(day, currentDate)
            if (!isCurrentMonth) dateColor = 'text-gray-300'

            return (
              <div 
                key={dateKey} 
                onClick={() => onDateClick(day)}
                className={`bg-white min-h-[100px] p-2 hover:bg-gray-50 transition-colors cursor-pointer flex flex-col gap-1 relative group ${
                  !isCurrentMonth ? 'bg-gray-50/50' : ''
                }`}
              >
                {/* 날짜 숫자 & 공휴일 이름 */}
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-bold ${dateColor} ${
                    isSameDay(day, new Date()) ? 'bg-black text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1 -mt-1 shadow-md' : ''
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {holiday && (
                    <span className="text-[10px] font-bold text-red-500 truncate max-w-[60px]">
                      {holiday.name}
                    </span>
                  )}
                </div>

                {/* 일정 리스트 */}
                <div className="flex-1 space-y-1 mt-1 overflow-hidden">
                  {daySchedules.map((sch, i) => (
                    <div 
                      key={i}
                      className={`text-[11px] px-1.5 py-0.5 rounded truncate border-l-2 ${
                        sch.유형 === '회의' ? 'bg-blue-50 text-blue-700 border-blue-500' :
                        sch.유형 === '연차' ? 'bg-red-50 text-red-700 border-red-500' :
                        sch.유형 === '외근' ? 'bg-green-50 text-green-700 border-green-500' :
                        'bg-gray-100 text-gray-700 border-gray-500'
                      }`}
                    >
                      {sch.시간 && <span className="text-gray-400 mr-1">{sch.시간}</span>}
                      {sch.이름 ? `${sch.이름} ` : ''}{sch.내용}
                    </div>
                  ))}
                </div>

                {/* Hover 시 + 버튼 */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold border border-gray-200">
                    +
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 일정 추가 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] p-8 w-full max-w-md shadow-2xl animate-fadeIn">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">📅</span>
              {selectedDate && format(selectedDate, 'M월 d일')} 일정 추가
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">시간</label>
                <input
                  type="time"
                  value={newSchedule.시간}
                  onChange={(e) => setNewSchedule({...newSchedule, 시간: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">유형</label>
                <div className="grid grid-cols-4 gap-2">
                  {['회의', '외근', '연차', '기타'].map(type => (
                    <button
                      key={type}
                      onClick={() => setNewSchedule({...newSchedule, 유형: type})}
                      className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                        newSchedule.유형 === type 
                          ? 'bg-[#1e1e24] text-white border-[#1e1e24]' 
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">내용</label>
                <input
                  type="text"
                  value={newSchedule.내용}
                  onChange={(e) => setNewSchedule({...newSchedule, 내용: e.target.value})}
                  placeholder="예: 원가팀 주간회의"
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-[#d9f99d] text-[#1e1e24] rounded-xl font-bold hover:bg-[#bef264] shadow-lg transition-colors"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}