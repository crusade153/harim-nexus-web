'use client'
import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'

export default function KanbanBoard({ tasks, onRefresh }) {
  const [filterPriority, setFilterPriority] = useState('all')
  const [selectedTask, setSelectedTask] = useState(null)

  const columns = ['대기', '진행중', '완료', '중단']

  const filteredTasks = useMemo(() => {
    if (filterPriority === 'all') return tasks || []
    return (tasks || []).filter(t => t.우선순위 === filterPriority)
  }, [tasks, filterPriority])

  const TaskCard = ({ task }) => (
    <div
      onClick={() => setSelectedTask(task)}
      className="glass rounded-xl p-4 cursor-pointer card-hover group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          task.우선순위 === '높음' ? 'bg-red-100 text-red-700' :
          task.우선순위 === '보통' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {task.우선순위}
        </span>
        {task.강조표시 === 'TRUE' && <span className="text-yellow-400 text-lg">⭐</span>}
      </div>

      <h4 className="font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
        {task.제목}
      </h4>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {task.내용}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
            {task.담당자명?.[0] || '?'}
          </div>
          <span className="text-xs text-gray-500">{task.담당자명}</span>
        </div>
        {task.마감일 && (
          <span className="text-xs text-gray-400">
            📅 {task.마감일}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">업무 보드</h1>
          <p className="text-gray-600">드래그하여 업무 상태를 변경하세요</p>
        </div>

        <div className="flex gap-3">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-4 py-2 glass rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">전체 우선순위</option>
            <option value="높음">높음</option>
            <option value="보통">보통</option>
            <option value="낮음">낮음</option>
          </select>

          <button 
            onClick={() => toast.success('새 업무 추가 기능 준비 중입니다!')}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all btn-glow"
          >
            + 새 업무
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {columns.map((status) => (
          <div key={status} className="glass rounded-2xl p-4 min-h-[600px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  status === '중단' ? 'bg-red-500' :
                  status === '완료' ? 'bg-green-500' :
                  'bg-blue-500'
                }`} />
                <h3 className="font-bold text-gray-900">{status}</h3>
              </div>
              <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-bold text-gray-600">
                {filteredTasks.filter(t => t.상태 === status).length}
              </span>
            </div>

            <div className="space-y-3">
              {filteredTasks
                .filter(t => t.상태 === status)
                .map((task, index) => (
                  <TaskCard key={index} task={task} />
                ))}
              
              {filteredTasks.filter(t => t.상태 === status).length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm">업무 없음</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div 
          onClick={() => setSelectedTask(null)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass max-w-2xl w-full rounded-2xl p-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold gradient-text mb-2">
                  {selectedTask.제목}
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    selectedTask.우선순위 === '높음' ? 'bg-red-100 text-red-700' :
                    selectedTask.우선순위 === '보통' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedTask.우선순위}
                  </span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    selectedTask.상태 === '완료' ? 'bg-green-100 text-green-700' :
                    selectedTask.상태 === '중단' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedTask.상태}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-gray-700 mb-2">상세 내용</h4>
                <p className="text-gray-600 leading-relaxed">{selectedTask.내용}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">담당자</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {selectedTask.담당자명?.[0]}
                    </div>
                    <span className="text-gray-900">{selectedTask.담당자명}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 mb-2">마감일</h4>
                  <p className="text-gray-900">📅 {selectedTask.마감일 || '미정'}</p>
                </div>
              </div>

              {selectedTask.중단사유 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl">
                  <h4 className="font-bold text-red-900 mb-2">중단 사유</h4>
                  <p className="text-red-700">{selectedTask.중단사유}</p>
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button 
                  onClick={() => toast.success('수정 기능 준비 중입니다!')}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                >
                  수정
                </button>
                <button 
                  onClick={() => toast.success('삭제 기능 준비 중입니다!')}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}