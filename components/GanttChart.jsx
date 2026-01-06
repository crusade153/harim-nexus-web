'use client'
import { useState } from 'react'
import { Gantt, ViewMode } from 'gantt-task-react'
import "gantt-task-react/dist/index.css"
import { updateTaskTimeline } from '@/lib/sheets'
import toast from 'react-hot-toast'

// ✅ onTaskClick props 추가 및 이벤트 연결
export default function GanttChart({ tasks, onTaskChange, onTaskClick }) {
  const [viewMode, setViewMode] = useState(ViewMode.Day)

  const ganttTasks = tasks.map(t => {
    const startDate = t.start_date ? new Date(t.start_date) : new Date(t.created_at)
    const endDate = t.due_date ? new Date(t.due_date) : new Date(new Date().setDate(new Date().getDate() + 1))
    
    if (endDate < startDate) {
        endDate.setDate(startDate.getDate() + 1)
    }

    return {
        start: startDate,
        end: endDate,
        name: t.title,
        id: String(t.id),
        type: 'task',
        progress: t.progress || 0,
        isDisabled: false,
        styles: { 
          progressColor: '#4F46E5',
          progressSelectedColor: '#4338ca',
          barBackgroundColor: '#a5b4fc',
          barBackgroundSelectedColor: '#818cf8',
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

  // ✅ 클릭 핸들러: 클릭 시 상위 컴포넌트(TimelinePage)의 수정 모달 호출
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
      <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700/50">
        <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleTaskChange}
            onClick={handleClick} // ✅ 클릭 이벤트 연결 (여기서 수정 모달 열림)
            listCellWidth="180px"
            columnWidth={viewMode === ViewMode.Month ? 150 : 60}
            barFill={70}
            ganttHeight={400}
            rowHeight={45}
        />
      </div>
    </div>
  )
}