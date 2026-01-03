'use client'
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isSaturday, isSunday } from 'date-fns'
import { createSchedule } from '@/lib/sheets'
import { ChevronLeft, ChevronRight, Plus, X, Clock, AlignLeft, CheckSquare, User, Users, CalendarDays } from 'lucide-react'

export default function CalendarPage({ schedules, tasks = [], members = [], currentUser, onRefresh }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [onlyMySchedules, setOnlyMySchedules] = useState(false)

  const currentUserName = currentUser?.이름 || '유경덕'

  // ✅ 1. 일정 유형 정의 (휴일근로 포함)
  const SCHEDULE_TYPES = ['회의', '외근', '출장', '연차', '오전반차', '오후반차', '휴일근로']
  
  // ✅ 2. 개인 일정 판별 함수
  const isPersonalType = (type) => ['외근', '출장', '연차', '오전반차', '오후반차', '휴일근로'].includes(type)

  const [newSchedule, setNewSchedule] = useState({
    유형: '회의',
    세부유형: '팀회의',
    내용: '',
    시간: '09:00',
    대상자: [] 
  })

  // 휴일 데이터
  const holidays = [
    { date: '2026-01-01', name: '신정' },
    { date: '2026-02-16', name: '설날 연휴' }
  ]

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const calendarEvents = useMemo(() => {
    // 기존 일정 변환
    const formattedSchedules = schedules.map(s => ({
      ...s,
      type: 'schedule',
      dateKey: s.날짜,
      담당자: s.대상자 || '전체' 
    }))

    // 업무 변환
    const formattedTasks = tasks.filter(t => t.마감일).map(t => ({
      ID: `task-${t.ID}`,
      내용: t.제목, 
      날짜: t.마감일,
      dateKey: t.마감일,
      type: 'task', 
      상태: t.상태,
      담당자: t.담당자명
    }))

    const allEvents = [...formattedSchedules, ...formattedTasks]

    if (onlyMySchedules) {
      return allEvents.filter(e => e.담당자.includes(currentUserName) || e.담당자 === '전체')
    }
    return allEvents
  }, [schedules, tasks, onlyMySchedules, currentUserName])

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToday = () => setCurrentDate(new Date())
  const getHoliday = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidays?.find(h => h.date === dateStr)
  }

  const handleDateClick = (date) => {
    setSelectedDate(date)
    setNewSchedule({ 
      ...newSchedule, 
      날짜: format(date, 'yyyy-MM-dd'),
      유형: '회의', 
      시간: '09:00',
      대상자: [] 
    })
    setIsModalOpen(true)
  }

  const handleTypeChange = (type) => {
    let defaultTime = '09:00'
    let targets = []

    if (isPersonalType(type)) {
      targets = [currentUserName] 
      if (type === '오후반차') defaultTime = '14:00'
    }

    setNewSchedule({ 
      ...newSchedule, 
      유형: type, 
      시간: defaultTime,
      대상자: targets 
    })
  }

  const toggleTarget = (memberName) => {
    const currentTargets = newSchedule.대상자
    if (currentTargets.includes(memberName)) {
      setNewSchedule({ ...newSchedule, 대상자: currentTargets.filter(t => t !== memberName) })
    } else {
      setNewSchedule({ ...newSchedule, 대상자: [...currentTargets, memberName] })
    }
  }

  const toggleAllTargets = () => {
    if (newSchedule.대상자.length === members.length) {
      setNewSchedule({ ...newSchedule, 대상자: [] })
    } else {
      setNewSchedule({ ...newSchedule, 대상자: members.map(m => m.이름) })
    }
  }

  const handleSave = async () => {
    let finalContent = newSchedule.내용
    
    // 개인 일정이면 내용이 없어도 '유형'을 내용으로 사용 (예: 연차)
    if (isPersonalType(newSchedule.유형) && !finalContent) {
        finalContent = newSchedule.유형 
    }

    if (!finalContent) {
      toast.error('내용을 입력해주세요!')
      return
    }

    // ✅ [수정됨] 대상자 저장 로직 개선
    let targetString = ''
    if (isPersonalType(newSchedule.유형)) {
        // 🔴 개인 일정은 멤버 수와 상관없이 무조건 '이름'으로 저장 (전체X)
        targetString = newSchedule.대상자.join(', ')
    } else {
        // 🔵 회의는 전체 선택 시 '전체'로 저장
        targetString = newSchedule.대상자.length > 0
          ? (newSchedule.대상자.length === members.length ? '전체' : newSchedule.대상자.join(', '))
          : '전체'
    }

    try {
      await createSchedule({
        ...newSchedule,
        내용: finalContent,
        대상자: targetString,
        날짜: newSchedule.날짜 || format(selectedDate, 'yyyy-MM-dd')
      })
      
      toast.success('일정이 등록되었습니다.')
      setIsModalOpen(false)
      if (onRefresh) onRefresh() 
    } catch (error) {
      console.error(error)
      toast.error('일정 등록 실패')
    }
  }

  // ✅ 3. 표기 로직 (완벽하게 원하는 형태로 수정)
  const getEventDisplayInfo = (evt) => {
    if (evt.type === 'task') {
      return { 
        text: `[업무] ${evt.내용}`, 
        className: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-500',
        fullText: `[마감] ${evt.내용} (${evt.담당자})`
      }
    }

    let text = ''
    let fullText = ''
    let className = 'bg-slate-100 dark:bg-slate-700 text-slate-600 border-slate-400'

    if (isPersonalType(evt.유형)) {
        // --- 개인 일정 (연차, 반차, 특근, 외근, 출장) ---
        let badge = evt.유형
        
        // 뱃지명 통일
        if (evt.유형.includes('반차')) badge = '반차'
        if (evt.유형 === '휴일근로') badge = '특근'

        // ✅ [핵심] 표기 방식: [연차] 유경덕
        // DB에 '전체'로 잘못 저장된 옛날 데이터가 있어도, 개인 일정이면 강제로 담당자 이름을 보여주려 했으나
        // 이미 저장된 데이터가 '전체'라면 어쩔 수 없이 '전체'로 나옵니다.
        // 하지만 위 handleSave 수정을 통해 앞으로 등록하는 건 '유경덕'으로 저장됩니다.
        text = `[${badge}] ${evt.담당자}`
        
        fullText = `[${evt.유형}] ${evt.담당자} - ${evt.내용}`

        // 색상 지정
        if (['연차', '반차', '오전반차', '오후반차'].includes(evt.유형)) {
            className = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-500'
        } else if (evt.유형 === '휴일근로') {
            className = 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-500'
        } else {
            // 외근, 출장
            className = 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-500'
        }

    } else {
        // --- 회의 ---
        // ✅ 표기 방식: 시간 [회의] 내용
        text = `${evt.시간} [${evt.유형}] ${evt.내용}`
        fullText = `[${evt.유형}] ${evt.내용} (참석: ${evt.담당자})`
        
        className = 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-500'
    }

    return { text, className, fullText }
  }


  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 헤더 부분 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">캘린더</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">팀원들의 일정과 휴가를 관리하세요.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <button 
              onClick={() => setOnlyMySchedules(!onlyMySchedules)}
              className={`btn-secondary text-xs flex items-center gap-2 ${onlyMySchedules ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : ''}`}
            >
              <User size={14} /> {onlyMySchedules ? '전체 보기' : '내 일정만 보기'}
            </button>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"><ChevronLeft size={16}/></button>
              <span className="px-4 font-bold text-lg w-32 text-center text-slate-800 dark:text-white tabular-nums">{format(currentDate, 'yyyy. MM')}</span>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"><ChevronRight size={16}/></button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              <button onClick={goToday} className="px-3 py-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">오늘</button>
            </div>
        </div>
      </div>

      {/* 달력 그리드 */}
      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
            <div key={day} className={`text-sm font-bold py-3 text-center ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'}`}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-slate-100 dark:divide-slate-700/50">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const holiday = getHoliday(day)
            const dayEvents = calendarEvents.filter(e => e.dateKey === dateKey)
            const isCurrentMonth = isSameMonth(day, currentDate)
            let dateColor = 'text-slate-700 dark:text-slate-300'
            if (holiday || isSunday(day)) dateColor = 'text-red-500'
            else if (isSaturday(day)) dateColor = 'text-blue-500'
            if (!isCurrentMonth) dateColor = 'text-slate-300 dark:text-slate-600'

            return (
              <div key={dateKey} onClick={() => handleDateClick(day)} className={`relative min-h-[100px] p-2 transition-colors cursor-pointer group hover:bg-slate-50 dark:hover:bg-slate-700/30 ${!isCurrentMonth ? 'bg-slate-50/30 dark:bg-slate-900/20' : ''} ${idx >= 28 ? 'border-b-0' : 'border-b border-slate-100 dark:border-slate-700'}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-indigo-600 text-white shadow-md' : dateColor}`}>{format(day, 'd')}</span>
                  {holiday && (<span className="text-[10px] font-bold text-red-500 truncate max-w-[60px] bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">{holiday.name}</span>)}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                  {dayEvents.map((evt, i) => {
                    const { text, className, fullText } = getEventDisplayInfo(evt)
                    return (
                      <div key={i} className={`text-[10px] px-2 py-1 rounded-md border-l-2 truncate font-medium flex items-center gap-1 ${className}`} title={fullText}>
                        {evt.type === 'task' && <CheckSquare size={10} />}
                        {text}
                      </div>
                    )
                  })}
                </div>
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-slate-600 text-indigo-600 dark:text-white flex items-center justify-center shadow-sm"><Plus size={14} /></div></div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><CalendarDays className="text-indigo-500" size={20}/>{format(selectedDate, 'M월 d일')} 일정 등록</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {/* 일정 유형 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">일정 유형</label>
                <div className="grid grid-cols-3 gap-2">
                    {SCHEDULE_TYPES.map(type => (
                        <button 
                            key={type} 
                            onClick={() => handleTypeChange(type)} 
                            className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${newSchedule.유형 === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 시간 */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1"><Clock size={12}/> 시간</label>
                    <input type="time" value={newSchedule.시간} onChange={(e) => setNewSchedule({...newSchedule, 시간: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"/>
                </div>
                {/* 작성자 (본인) */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">작성자</label>
                    <div className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-400 font-bold">
                        {currentUserName}
                    </div>
                </div>
              </div>

              {/* 대상자 선택 (개인일정 아닐때만) */}
              {!isPersonalType(newSchedule.유형) && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><Users size={12}/> 참석 대상</label>
                        <button onClick={toggleAllTargets} className="text-[10px] text-indigo-500 font-bold hover:underline">
                            {newSchedule.대상자.length === members.length ? '전체 해제' : '전체 선택'}
                        </button>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {members.map(member => (
                            <label key={member.ID} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={newSchedule.대상자.includes(member.이름)}
                                    onChange={() => toggleTarget(member.이름)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{member.이름} <span className="text-xs text-slate-400">({member.직위})</span></span>
                            </label>
                        ))}
                    </div>
                    {newSchedule.대상자.length > 0 && (
                        <p className="text-xs text-indigo-600 mt-1 font-medium px-1">
                            {newSchedule.대상자.length}명 선택됨
                        </p>
                    )}
                  </div>
              )}

              {/* 내용 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1"><AlignLeft size={12}/> 내용</label>
                <input 
                    type="text" 
                    value={newSchedule.내용} 
                    onChange={(e) => setNewSchedule({...newSchedule, 내용: e.target.value})} 
                    placeholder={isPersonalType(newSchedule.유형) ? "예: 개인사유 (생략 가능)" : "예: 주간 업무 회의"}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder:text-slate-400" 
                    autoFocus={!isPersonalType(newSchedule.유형)}
                />
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">취소</button>
                  <button onClick={handleSave} className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all">등록하기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}