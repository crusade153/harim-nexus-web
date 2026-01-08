'use client'
import { useState } from 'react'
import { Gantt, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { updateTaskTimeline } from '@/lib/sheets'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale' // ✅ 한국어 로케일

// ✅ 커스텀 리스트 헤더 컴포넌트 (컬럼 정의)
const TaskListHeader = ({ headerHeight }) => {
  return (
    <div
      className="flex items-center border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
      style={{
        height: headerHeight,
        fontFamily: 'Pretendard, sans-serif',
      }}
    >
      <div className="flex-1 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">주요업무</div>
      <div className="w-[100px] px-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-center border-l border-slate-200 dark:border-slate-700">시작일</div>
      <div className="w-[100px] px-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-center border-l border-slate-200 dark:border-slate-700">종료일</div>
      <div className="w-[80px] px-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase text-center border-l border-slate-200 dark:border-slate-700">담당자</div>
    </div>
  )
}

// ✅ 커스텀 리스트 테이블 컴포넌트 (데이터 표시)
const TaskListTable = ({ tasks, rowHeight, onExpanderClick }) => {
  return (
    <div style={{ fontFamily: 'Pretendard, sans-serif' }}>
      {tasks.map((t) => (
        <div
          key={t.id}
          className="flex items-center border-b border-r border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors bg-white dark:bg-slate-900"
          style={{ height: rowHeight }}
          onClick={() => onExpanderClick(t)}
        >
          <div className="flex-1 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex items-center gap-2" title={t.name}>
             {/* 상태 색상 표시바 */}
             <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
               t.progress === 100 ? 'bg-green-500' : 'bg-indigo-500'
             }`} />
             {t.name}
          </div>
          <div className="w-[100px] px-2 text-xs text-slate-500 dark:text-slate-400 text-center border-l border-slate-100 dark:border-slate-800">
            {/* ✅ [수정됨] 날짜 포맷: 1/5 (월) 형태 */}
            {format(t.start, 'M/d (E)', { locale: ko })}
          </div>
          <div className="w-[100px] px-2 text-xs text-slate-500 dark:text-slate-400 text-center border-l border-slate-100 dark:border-slate-800">
            {/* ✅ [수정됨] 날짜 포맷: 1/6 (화) 형태 */}
            {format(t.end, 'M/d (E)', { locale: ko })}
          </div>
          <div className="w-[80px] px-2 flex justify-center border-l border-slate-100 dark:border-slate-800">
             <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium truncate max-w-full">
               {t.assignee}
             </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function GanttChart({ tasks, onTaskChange, onTaskClick }) {
  const [viewMode, setViewMode] = useState(ViewMode.Day)

  // 데이터 매핑
  const ganttTasks = tasks.map(t => {
    const startDate = t.start_date ? new Date(t.start_date) : new Date(t.created_at)
    // 종료일이 시작일보다 빠르면 자동 보정
    let endDate = t.due_date ? new Date(t.due_date) : new Date(new Date().setDate(new Date().getDate() + 1))
    if (endDate <= startDate) {
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
    }

    return {
        start: startDate,
        end: endDate,
        name: t.title,
        id: String(t.id),
        type: 'task',
        progress: t.status === '완료' ? 100 : (t.progress || 0),
        isDisabled: false,
        // ✅ 담당자 정보 전달
        assignee: t.담당자명 || t.assignee || '미정', 
        styles: { 
          progressColor: t.status === '완료' ? '#22c55e' : '#4F46E5', // 완료면 초록, 아니면 인디고
          progressSelectedColor: t.status === '완료' ? '#16a34a' : '#4338ca',
          barBackgroundColor: t.status === '완료' ? '#bbf7d0' : '#a5b4fc',
          barBackgroundSelectedColor: t.status === '완료' ? '#86efac' : '#818cf8',
        },
    }
  })

  const handleTaskChange = async (task) => {
    try {
      await updateTaskTimeline(task.id, task.start, task.end)
      toast.success(`'${task.name}' 일정이 변경되었습니다.`)
      if(onTaskChange) onTaskChange()
    } catch (error) {
      toast.error('일정 변경 실패')
    }
  }

  const handleClick = (task) => {
    if (onTaskClick) onTaskClick(task)
  }

  const ViewSwitcher = () => (
    <div className="flex gap-2 mb-4">
      <button onClick={() => setViewMode(ViewMode.Day)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${viewMode === ViewMode.Day ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>일간</button>
      <button onClick={() => setViewMode(ViewMode.Week)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${viewMode === ViewMode.Week ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>주간</button>
      <button onClick={() => setViewMode(ViewMode.Month)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${viewMode === ViewMode.Month ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>월간</button>
    </div>
  )

  if (ganttTasks.length === 0) {
    return (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
            <p>등록된 업무가 없습니다.</p>
            <p className="text-sm mt-1">위 '일정 추가' 버튼을 눌러보세요.</p>
        </div>
    )
  }

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <ViewSwitcher />
      <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-700/50">
        <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleTaskChange}
            onClick={handleClick}
            
            // ✅ 커스텀 컴포넌트 적용
            TaskListHeader={TaskListHeader} 
            TaskListTable={TaskListTable}
            
            // ✅ 한국어 로케일 적용
            locale="ko" 

            // ✅ 레이아웃 설정
            listCellWidth="350px" 
            columnWidth={viewMode === ViewMode.Month ? 150 : 60}
            barFill={70}
            ganttHeight={400}
            rowHeight={45}
            headerHeight={45}
            
            // ✅ 스타일링 오버라이드
            fontFamily="Pretendard, sans-serif"
            fontSize="12px"
        />
      </div>
    </div>
  )
}