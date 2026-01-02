'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, MessageSquare, Calendar, User, AlignLeft, Send, CheckCircle2 } from 'lucide-react'
import Drawer from '@/components/ui/Drawer' 

export default function KanbanBoard({ tasks, onRefresh }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const currentUser = '유경덕' 
  const columns = ['대기', '진행중', '완료', '중단']

  const handleStatusChange = (newStatus) => {
    if (selectedTask.작성자 !== currentUser) {
      toast.error('작성자만 상태를 변경할 수 있습니다.')
      return
    }
    const updatedTask = { ...selectedTask, 상태: newStatus }
    setSelectedTask(updatedTask)
    toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다.`)
  }

  const handleAddComment = (e) => {
    e.preventDefault()
    const comment = e.target.comment.value
    if (!comment) return
    const newComment = { 작성자: currentUser, 내용: comment, 시간: '방금 전' }
    setSelectedTask({ ...selectedTask, 댓글: [...(selectedTask.댓글 || []), newComment] })
    toast.success('댓글이 등록되었습니다.')
    e.target.reset()
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">업무 보드</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">팀의 업무 흐름을 관리하세요.</p>
        </div>
        <button onClick={() => toast('새 업무 추가 기능은 준비 중입니다.', { icon: '🚧' })} className="btn-primary">
          <Plus size={16} /> 새 업무 추가
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden min-h-[600px]">
        {columns.map(status => (
          <div key={status} className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status === '완료' ? 'bg-green-500' : status === '중단' ? 'bg-red-500' : 'bg-indigo-500'}`} />
                {status}
              </span>
              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                {tasks.filter(t => t.상태 === status).length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {tasks.filter(t => t.상태 === status).map(task => (
                <div 
                  key={task.ID}
                  onClick={() => setSelectedTask(task)}
                  className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      task.우선순위 === '높음' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>{task.우선순위}</span>
                    {task.상태 === '완료' && <CheckCircle2 size={14} className="text-green-500"/>}
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 leading-snug">{task.제목}</h4>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-white">{task.담당자명[0]}</div>
                      {task.담당자명}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <MessageSquare size={12} /> {task.댓글?.length || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Drawer isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="업무 상세 정보">
        {selectedTask && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <select 
                  value={selectedTask.상태}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={selectedTask.작성자 !== currentUser}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none outline-none cursor-pointer transition-colors bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white`}
                >
                  {columns.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <span className="text-xs text-slate-400">ID: #{selectedTask.ID}</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{selectedTask.제목}</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="space-y-1">
                <p className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><User size={12}/> 담당자</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedTask.담당자명}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><Calendar size={12}/> 마감일</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 pt-1">{selectedTask.마감일 || '미정'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2"><AlignLeft size={14}/> 상세 내용</p>
              <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed min-h-[100px]">
                {selectedTask.내용 || '내용이 없습니다.'}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare size={18} /> 댓글 및 활동 ({selectedTask.댓글?.length || 0})
              </h3>
              <div className="space-y-4 mb-6">
                {selectedTask.댓글?.map((cmt, idx) => (
                  <div key={idx} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-1">{cmt.작성자[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cmt.작성자}</span>
                        <span className="text-[10px] text-slate-400">{cmt.시간}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg rounded-tl-none">{cmt.내용}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="relative">
                <input name="comment" type="text" placeholder="댓글을 입력하세요..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm outline-none dark:text-white" />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"><Send size={14} /></button>
              </form>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}