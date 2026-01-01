'use client'
import { useState } from 'react'
import { Plus, MoreHorizontal, MessageSquare, Calendar, User, AlignLeft, X, Send } from 'lucide-react'

export default function KanbanBoard({ tasks, onRefresh }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)
  const currentUser = '유경덕' // 현재 로그인 사용자 가정

  const columns = ['대기', '진행중', '완료', '중단']

  // 업무 상태 변경 (구글 시트 연동 포인트)
  const handleStatusChange = (newStatus) => {
    if (selectedTask.작성자 !== currentUser) {
      alert('작성자만 상태를 변경할 수 있습니다.')
      return
    }
    // 실제로는 API 호출 필요
    setSelectedTask({ ...selectedTask, 상태: newStatus })
    alert(`상태가 '${newStatus}'(으)로 변경되었습니다. (DB 저장 예정)`)
    onRefresh() // 데이터 갱신 시늉
  }

  // 댓글 등록
  const handleAddComment = (e) => {
    e.preventDefault()
    const comment = e.target.comment.value
    if (!comment) return
    
    // 댓글 추가 로직 (DB 연동 필요)
    const newComment = { 작성자: currentUser, 내용: comment, 시간: '방금 전' }
    setSelectedTask({ ...selectedTask, 댓글: [...(selectedTask.댓글 || []), newComment] })
    e.target.reset()
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">업무 보드</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">팀의 업무 흐름을 관리하세요.</p>
        </div>
        <button 
          onClick={() => setIsWriteModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={16} /> 새 업무 추가
        </button>
      </div>

      {/* 칸반 컬럼 */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 overflow-hidden min-h-[600px]">
        {columns.map(status => (
          <div key={status} className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-4">
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
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{task.제목}</h4>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center font-bold text-[10px]">{task.담당자명[0]}</div>
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

      {/* 업무 상세 모달 */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white dark:bg-slate-800 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start z-10">
              <div className="flex-1 pr-8">
                <div className="flex items-center gap-3 mb-2">
                  <select 
                    value={selectedTask.상태}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={selectedTask.작성자 !== currentUser}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none outline-none cursor-pointer
                      ${selectedTask.작성자 !== currentUser ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                      bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white`}
                  >
                    {columns.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <span className="text-xs text-slate-400">작성자: {selectedTask.작성자}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{selectedTask.제목}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><X size={24}/></button>
            </div>

            <div className="p-6 space-y-8">
              {/* 속성 정보 */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User size={18} className="text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">담당자</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedTask.담당자명}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">마감일</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedTask.마감일 || '미정'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2"><AlignLeft size={14}/> 상세 내용</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    {selectedTask.내용 || '내용이 없습니다.'}
                  </p>
                </div>
              </div>

              {/* 댓글 섹션 */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <MessageSquare size={18} /> 댓글 및 활동
                </h3>
                
                <div className="space-y-4 mb-6">
                  {selectedTask.댓글?.length > 0 ? selectedTask.댓글.map((cmt, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300 shrink-0">
                        {cmt.작성자[0]}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-2 rounded-2xl rounded-tl-none">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cmt.작성자}</span>
                          <span className="text-[10px] text-slate-400">{cmt.시간}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{cmt.내용}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-400 text-center py-4">아직 댓글이 없습니다.</p>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input 
                    name="comment"
                    type="text" 
                    placeholder="댓글을 입력하세요..." 
                    className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  />
                  <button type="submit" className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors">
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}