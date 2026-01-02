'use client'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Plus, MessageSquare, Calendar, User, AlignLeft, Send, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import Drawer from '@/components/ui/Drawer'

// ---------------------------------------------------------
// 1. 커스텀 충돌 감지 알고리즘 (빈 컬럼 인식률 극대화)
// ---------------------------------------------------------
function customCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
}

// ---------------------------------------------------------
// 2. 드래그 가능한 카드 컴포넌트
// ---------------------------------------------------------
function SortableTask({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.ID, data: { ...task } })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
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

// ---------------------------------------------------------
// 3. 드롭 가능한 컬럼 컴포넌트 (✅ 완료 항목 토글 기능 추가)
// ---------------------------------------------------------
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
            <button 
              onClick={onToggle}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400"
              title={isExpanded ? "접기 (최근 5개만 보기)" : "전체 보기"}
            >
              {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
          )}
          <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
            {/* 완료 컬럼일 경우: 보여지는개수 / 전체개수 */}
            {title === '완료' && !isExpanded && totalCount > 5 ? `5 / ${totalCount}` : count}
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-1 min-h-[150px]">
        {children}
        {/* 완료 항목이 숨겨져 있을 때 안내 메시지 */}
        {title === '완료' && !isExpanded && totalCount > 5 && (
          <div 
            onClick={onToggle}
            className="text-xs text-center text-slate-400 py-3 cursor-pointer hover:text-indigo-500 transition-colors border-t border-dashed border-slate-200 dark:border-slate-700 mt-2"
          >
            ...외 {totalCount - 5}개 완료됨 (더 보기)
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ tasks: initialTasks, onRefresh }) {
  const [items, setItems] = useState(initialTasks)
  const [selectedTask, setSelectedTask] = useState(null)
  const [activeId, setActiveId] = useState(null)
  
  // ✅ [추가] 완료 항목 전체 보기 토글 상태
  const [showAllDone, setShowAllDone] = useState(false)
  
  const currentUser = '유경덕' 
  const columns = ['대기', '진행중', '완료', '중단']

  useEffect(() => {
    setItems(initialTasks)
  }, [initialTasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const activeItem = useMemo(() => items.find((i) => i.ID === activeId), [activeId, items])

  // --- 이벤트 핸들러 ---
  const handleDragStart = (event) => setActiveId(event.active.id)

  const handleDragOver = (event) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id
    if (activeId === overId) return

    const activeTask = items.find(i => i.ID === activeId)
    const overTask = items.find(i => i.ID === overId)

    if (!activeTask) return

    // 1. Task 위로 드래그
    if (overTask && activeTask.상태 !== overTask.상태) {
      setItems((items) => items.map(item => 
        item.ID === activeId ? { ...item, 상태: overTask.상태 } : item
      ))
    } 
    // 2. 빈 컬럼 위로 드래그
    else if (columns.includes(overId) && activeTask.상태 !== overId) {
      setItems((items) => items.map(item => 
        item.ID === activeId ? { ...item, 상태: overId } : item
      ))
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeId = active.id
    const overId = over.id
    const activeTask = items.find(i => i.ID === activeId)
    const overTask = items.find(i => i.ID === overId)
    
    // 순서 정렬
    if (activeTask && overTask && activeTask.상태 === overTask.상태) {
      const activeIndex = items.findIndex(i => i.ID === activeId)
      const overIndex = items.findIndex(i => i.ID === overId)
      if (activeIndex !== overIndex) {
        setItems((items) => arrayMove(items, activeIndex, overIndex))
      }
    }
  }

  // 기존 상세 보기 & 댓글 로직
  const handleStatusChange = (newStatus) => {
    if (!selectedTask) return
    const updatedItems = items.map(item => 
        item.ID === selectedTask.ID ? { ...item, 상태: newStatus } : item
    )
    setItems(updatedItems)
    setSelectedTask({ ...selectedTask, 상태: newStatus })
    toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다.`)
  }

  const handleAddComment = (e) => {
    e.preventDefault()
    const comment = e.target.comment.value
    if (!comment) return
    const newComment = { 작성자: currentUser, 내용: comment, 시간: '방금 전' }
    
    const updatedTask = { ...selectedTask, 댓글: [...(selectedTask.댓글 || []), newComment] }
    setSelectedTask(updatedTask)
    
    const updatedItems = items.map(item => 
        item.ID === selectedTask.ID ? updatedTask : item
    )
    setItems(updatedItems)
    toast.success('댓글이 등록되었습니다.')
    e.target.reset()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
          {columns.map(status => {
            const allColumnItems = items.filter(t => t.상태 === status)
            
            // ✅ [핵심 로직] 완료 상태이고 접혀있으면 최근 5개만 보여줌
            // (주의: 배열 순서가 뒤쪽이 최근이라고 가정할 경우 slice(-5) 사용)
            let displayItems = allColumnItems
            if (status === '완료' && !showAllDone && allColumnItems.length > 5) {
              // 여기서는 배열의 앞부분(상단)이 최신순이라 가정하고 slice(0, 5)를 씁니다.
              // 만약 새 업무가 뒤에 추가된다면 slice(-5)를 써야 합니다.
              displayItems = allColumnItems.slice(0, 5) 
            }
            
            return (
              <KanbanColumn 
                key={status} 
                id={status} 
                title={status} 
                count={displayItems.length}
                totalCount={allColumnItems.length} // 전체 개수 전달
                isExpanded={showAllDone} // 펼침 상태 전달
                onToggle={() => setShowAllDone(!showAllDone)} // 토글 함수 전달
              >
                <SortableContext 
                  id={status}
                  items={displayItems.map(i => i.ID)}
                  strategy={verticalListSortingStrategy}
                >
                  {displayItems.map(task => (
                    <SortableTask 
                      key={task.ID} 
                      task={task} 
                      onClick={() => setSelectedTask(task)} 
                    />
                  ))}
                </SortableContext>
              </KanbanColumn>
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-indigo-500 shadow-xl opacity-90 rotate-2 cursor-grabbing w-[300px] pointer-events-none">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeItem.우선순위 === '높음' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
                }`}>{activeItem.우선순위}</span>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1 leading-snug">{activeItem.제목}</h4>
            </div>
          ) : null}
        </DragOverlay>

        <Drawer isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} title="업무 상세 정보">
          {selectedTask && (
            <div className="space-y-8">
              {/* 상세 보기 내용은 동일하므로 생략 없이 유지 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <select 
                    value={selectedTask.상태}
                    onChange={(e) => handleStatusChange(e.target.value)}
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
    </DndContext>
  )
}