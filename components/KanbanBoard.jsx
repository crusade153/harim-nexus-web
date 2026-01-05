'use client'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Plus, MessageSquare, Calendar, User, AlignLeft, Send, CheckCircle2, ChevronDown, ChevronUp, Link as LinkIcon, ExternalLink, X, Flag } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove, // ✅ 여기서 불러온 arrayMove를 이제 진짜로 사용합니다!
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import Drawer from '@/components/ui/Drawer'
import { updateTaskStatus, createTask } from '@/lib/sheets'

// 1. 충돌 감지 알고리즘
function customCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCorners(args);
}

// 2. 드래그 가능한 카드 컴포넌트
function SortableTask({ task, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.ID, data: { ...task } })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1, // 드래그 중일 때 투명도 조절
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm cursor-grab active:cursor-grabbing transition-all group touch-none mb-3"
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
  )
}

// 3. 컬럼(기둥) 컴포넌트
function KanbanColumn({ id, title, count, totalCount, isExpanded, onToggle, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: id })

  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col h-full rounded-xl border p-4 transition-colors ${
        isOver 
          ? 'bg-indigo-50/50 border-indigo-300 dark:bg-slate-800/80 dark:border-indigo-500' 
          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${title === '완료' ? 'bg-green-500' : title === '중단' ? 'bg-red-500' : 'bg-indigo-500'}`} />
          {title}
        </span>
        <div className="flex items-center gap-2">
          {title === '완료' && (
            <button onClick={onToggle} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400">
              {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
          )}
          <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
            {title === '완료' && !isExpanded && totalCount > 5 ? `5 / ${totalCount}` : count}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 min-h-[150px]">
        {children}
        {title === '완료' && !isExpanded && totalCount > 5 && (
          <div onClick={onToggle} className="text-xs text-center text-slate-400 py-3 cursor-pointer hover:text-indigo-500 transition-colors border-t border-dashed border-slate-200 dark:border-slate-700 mt-2">
            ...외 {totalCount - 5}개 완료됨 (더 보기)
          </div>
        )}
      </div>
    </div>
  )
}

// 4. 메인 칸반 보드 컴포넌트
export default function KanbanBoard({ tasks: initialTasks, archives = [], currentUser, onRefresh }) {
  const [items, setItems] = useState(initialTasks)
  const [selectedTask, setSelectedTask] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [showAllDone, setShowAllDone] = useState(false)
  const [activeMobileColumn, setActiveMobileColumn] = useState('진행중')
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [newTask, setNewTask] = useState({ 제목: '', 우선순위: '보통', 담당자명: currentUser?.이름 || '미정', 마감일: '', 내용: '' })

  const [onlyMyTasks, setOnlyMyTasks] = useState(false)
  const currentUserName = currentUser?.이름 || '게스트'
  const columns = ['대기', '진행중', '완료', '중단']

  useEffect(() => {
    setItems(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    if(isTaskModalOpen && currentUser) {
        setNewTask(prev => ({...prev, 담당자명: currentUser.이름}))
    }
  }, [isTaskModalOpen, currentUser])

  const filteredItems = useMemo(() => {
    if (onlyMyTasks) {
      return items.filter(t => t.담당자명 === currentUserName)
    }
    return items
  }, [items, onlyMyTasks, currentUserName])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeItem = useMemo(() => items.find((i) => i.ID === activeId), [activeId, items])

  // --- 🔥 드래그 앤 드롭 핵심 로직 수정됨 🔥 ---

  const handleDragStart = (event) => setActiveId(event.active.id)
  
  // 드래그 중일 때 (실시간 위치 변경 및 순서 변경)
  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return
    
    const activeId = active.id
    const overId = over.id
    
    // 1. 같은 아이템 위면 무시
    if (activeId === overId) return

    // 2. 타겟이 '태스크'인지 '컬럼(빈 공간)'인지 확인
    const isActiveTask = items.find(i => i.ID === activeId)
    const isOverTask = items.find(i => i.ID === overId)

    if (!isActiveTask) return

    // Case A: 다른 태스크 위로 드래그 중일 때 (순서 바꾸기)
    if (isOverTask) {
      const activeIndex = items.findIndex(i => i.ID === activeId)
      const overIndex = items.findIndex(i => i.ID === overId)

      if (items[activeIndex].상태 !== items[overIndex].상태) {
        // 다른 컬럼의 태스크 위로 갔을 때 -> 상태 변경 & 이동
        setItems((items) => {
          const newItems = [...items]
          newItems[activeIndex].상태 = items[overIndex].상태
          return arrayMove(newItems, activeIndex, overIndex - 1) // 약간 위쪽으로 삽입
        })
      } else {
        // 같은 컬럼 내에서 순서 변경 (Reordering) -> ✅ arrayMove 사용!
        setItems((items) => arrayMove(items, activeIndex, overIndex))
      }
    } 
    // Case B: 빈 컬럼 위로 드래그 중일 때 (이동)
    else if (columns.includes(overId)) {
       if (isActiveTask.상태 !== overId) {
         setItems((items) => items.map(item => item.ID === activeId ? { ...item, 상태: overId } : item))
       }
    }
  }

  // 드래그가 끝났을 때 (DB 저장)
  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    
    const activeId = active.id
    const overId = over.id
    const activeTask = items.find(i => i.ID === activeId)

    // 최종적으로 어디에 떨어졌는지 확인
    let newStatus = overId
    if (items.find(i => i.ID === overId)) {
       newStatus = items.find(i => i.ID === overId).상태
    }

    // 상태가 변했다면 DB 업데이트
    if (activeTask && activeTask.상태 !== newStatus) {
      // 화면은 handleDragOver에서 이미 변했으므로 DB만 쏴주면 됨
      try {
        await updateTaskStatus(activeId, newStatus) 
        toast.success(`'${newStatus}' 상태로 변경됨`)
      } catch (error) {
        console.error(error)
        toast.error('상태 저장 실패')
        if (onRefresh) onRefresh() // 실패 시 원복
      }
    }
    // 참고: 같은 컬럼 내 순서 변경은 DB에 'order' 컬럼이 없으므로 저장되지 않음.
    // (새로고침하면 다시 날짜순 정렬됨. 하지만 UX상으로는 드래그가 먹히므로 "안 된다"는 느낌은 사라짐)
  }

  // --- 기존 핸들러들 ---

  const handleStatusChange = async (newStatus) => {
    if (!selectedTask) return
    
    const updatedItems = items.map(item => item.ID === selectedTask.ID ? { ...item, 상태: newStatus } : item)
    setItems(updatedItems)
    setSelectedTask({ ...selectedTask, 상태: newStatus })
    
    try {
        await updateTaskStatus(selectedTask.ID, newStatus)
        toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다.`)
    } catch (error) {
        toast.error('상태 변경 실패')
        if (onRefresh) onRefresh()
    }
  }

  const handleCreateTask = async () => {
    if (!newTask.제목) {
      toast.error('업무 제목을 입력해주세요.')
      return
    }

    try {
      await createTask(newTask)
      toast.success('새 업무가 등록되었습니다!')
      setIsTaskModalOpen(false)
      setNewTask({ 제목: '', 우선순위: '보통', 담당자명: currentUserName, 마감일: '', 내용: '' })
      if (onRefresh) onRefresh()
    } catch (error) {
      console.error(error)
      toast.error('업무 등록 실패')
    }
  }

  const handleAddComment = (e) => {
    e.preventDefault()
    const comment = e.target.comment.value
    if (!comment) return
    
    const newComment = { 작성자: currentUserName, 내용: comment, 시간: '방금 전' }
    const updatedTask = { ...selectedTask, 댓글: [...(selectedTask.댓글 || []), newComment] }
    
    setSelectedTask(updatedTask)
    setItems(items.map(item => item.ID === selectedTask.ID ? updatedTask : item))
    
    toast.success('댓글이 등록되었습니다.')
    e.target.reset()
  }

  const handleLinkWiki = (wikiId) => {
    const updated = { ...selectedTask, 관련문서ID: wikiId }
    setSelectedTask(updated)
    setItems(items.map(i => i.ID === selectedTask.ID ? updated : i))
    toast.success('관련 문서가 연결되었습니다.')
  }

  return (
    <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="space-y-4 h-full flex flex-col">
        {/* 상단 헤더 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">업무 보드</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">팀의 업무 흐름을 관리하세요.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setOnlyMyTasks(!onlyMyTasks)}
              className={`btn-secondary text-xs flex items-center gap-2 ${onlyMyTasks ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : ''}`}
            >
              <User size={14} /> {onlyMyTasks ? '전체 보기' : '내 업무만 보기'}
            </button>
            <button onClick={() => setIsTaskModalOpen(true)} className="btn-primary">
              <Plus size={16} /> 새 업무 추가
            </button>
          </div>
        </div>

        {/* 모바일 탭 */}
        <div className="flex md:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto scrollbar-hide">
          {columns.map(col => (
            <button
              key={col}
              onClick={() => setActiveMobileColumn(col)}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                activeMobileColumn === col ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {col} ({filteredItems.filter(i => i.상태 === col).length})
            </button>
          ))}
        </div>

        {/* 메인 칸반 그리드 */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 overflow-hidden min-h-[500px]">
          {columns.map(status => {
            const isHiddenMobile = status !== activeMobileColumn
            const allColumnItems = filteredItems.filter(t => t.상태 === status) 
            
            let displayItems = allColumnItems
            if (status === '완료' && !showAllDone && allColumnItems.length > 5) {
              displayItems = allColumnItems.slice(0, 5) 
            }
            
            return (
              <div key={status} className={`${isHiddenMobile ? 'hidden md:flex' : 'flex'} h-full flex-col`}>
                <KanbanColumn 
                  id={status} title={status} 
                  count={displayItems.length} totalCount={allColumnItems.length} 
                  isExpanded={showAllDone} onToggle={() => setShowAllDone(!showAllDone)}
                >
                  <SortableContext id={status} items={displayItems.map(i => i.ID)} strategy={verticalListSortingStrategy}>
                    {displayItems.map(task => (
                      <SortableTask key={task.ID} task={task} onClick={() => setSelectedTask(task)} />
                    ))}
                  </SortableContext>
                </KanbanColumn>
              </div>
            )
          })}
        </div>

        {/* 드래그 중인 아이템 잔상 (DragOverlay) */}
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-indigo-500 shadow-xl opacity-90 rotate-2 cursor-grabbing w-[300px] pointer-events-none">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 leading-snug">{activeItem.제목}</h4>
            </div>
          ) : null}
        </DragOverlay>

        {/* 업무 상세 Drawer */}
        <Drawer isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="업무 상세 정보">
          {selectedTask && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <select value={selectedTask.상태} onChange={(e) => handleStatusChange(e.target.value)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none outline-none cursor-pointer transition-colors bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white`}>
                    {columns.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <span className="text-xs text-slate-400">ID: #{selectedTask.ID}</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{selectedTask.제목}</h2>
              </div>
              
              {/* 위키 연결 섹션 */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2"><LinkIcon size={16} /> 관련 지식/문서</h3>
                {selectedTask.관련문서ID ? (
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded text-indigo-600 dark:text-indigo-400"><LinkIcon size={16} /></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Linked Wiki</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {archives.find(a => a.ID === selectedTask.관련문서ID)?.제목 || '삭제된 문서'}
                        </p>
                      </div>
                    </div>
                    <a href="#" onClick={(e) => { e.preventDefault(); toast('해당 문서로 이동합니다'); }} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 p-2 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded"><ExternalLink size={18} /></a>
                  </div>
                ) : (
                  <select onChange={(e) => handleLinkWiki(e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" defaultValue="">
                    <option value="" disabled>+ 관련 위키 문서 연결하기</option>
                    {archives.map(doc => <option key={doc.ID} value={doc.ID}>{doc.제목}</option>)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="space-y-1"><p className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><User size={12}/> 담당자</p><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedTask.담당자명}</p></div>
                <div className="space-y-1"><p className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1"><Calendar size={12}/> 마감일</p><p className="text-sm font-medium text-slate-700 dark:text-slate-200 pt-1">{selectedTask.마감일 || '미정'}</p></div>
              </div>

              <div><p className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-2"><AlignLeft size={14}/> 상세 내용</p><div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed min-h-[100px]">{selectedTask.내용 || '내용이 없습니다.'}</div></div>
              
              <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><MessageSquare size={18} /> 댓글 ({selectedTask.댓글?.length || 0})</h3>
                <div className="space-y-4 mb-6">
                  {selectedTask.댓글?.map((cmt, idx) => (
                    <div key={idx} className="flex gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 mt-1">{cmt.작성자[0]}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cmt.작성자}</span><span className="text-[10px] text-slate-400">{cmt.시간}</span></div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg rounded-tl-none">{cmt.내용}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddComment} className="relative"><input name="comment" type="text" placeholder="댓글을 입력하세요..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm outline-none dark:text-white" /><button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"><Send size={14} /></button></form>
              </div>
            </div>
          )}
        </Drawer>

        {/* 새 업무 추가 모달 */}
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">새 업무 추가</h2>
                <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
              </div>
              
              <div className="p-6 space-y-5 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">제목 <span className="text-red-500">*</span></label>
                  <input type="text" value={newTask.제목} onChange={(e) => setNewTask({...newTask, 제목: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" placeholder="업무 제목을 입력하세요" autoFocus />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">우선순위</label>
                    <div className="flex gap-2">
                      {['낮음', '보통', '높음'].map(p => (
                        <button key={p} onClick={() => setNewTask({...newTask, 우선순위: p})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${newTask.우선순위 === p ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 border-transparent' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">담당자</label>
                    <input type="text" value={newTask.담당자명} onChange={(e) => setNewTask({...newTask, 담당자명: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" />
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">마감일</label>
                   <input type="date" value={newTask.마감일} onChange={(e) => setNewTask({...newTask, 마감일: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">상세 내용</label>
                  <textarea value={newTask.내용} onChange={(e) => setNewTask({...newTask, 내용: e.target.value})} className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none dark:text-white" placeholder="업무 내용을 입력하세요..." />
                </div>
              </div>

              <div className="p-6 pt-0 flex gap-3">
                <button onClick={() => setIsTaskModalOpen(false)} className="flex-1 btn-secondary">취소</button>
                <button onClick={handleCreateTask} className="flex-1 btn-primary">등록하기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}