'use client'
import { useMemo } from 'react'
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  ArrowUpRight,
  MoreHorizontal
} from 'lucide-react'

export default function Dashboard({ data, onRefresh }) {
  // 데이터 요약 계산 로직 유지
  const summary = useMemo(() => {
    const tasks = data.tasks || []
    return {
      totalTasks: tasks.length,
      progress: tasks.length ? Math.round((tasks.filter(t => t.상태 === '완료').length / tasks.length) * 100) : 0,
      urgentTasks: tasks.filter(t => t.우선순위 === '높음' && t.상태 !== '완료'),
      ongoingTasks: tasks.filter(t => t.상태 === '진행중'),
      recentPosts: data.posts?.slice(0, 3) || [],
      todaySchedules: data.schedules?.slice(0, 3) || [],
    }
  }, [data])

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      
      {/* 1. 상단 타이틀 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
          <p className="text-slate-500 text-sm mt-1">오늘의 업무 현황과 주요 이슈를 확인하세요.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onRefresh} 
            className="btn-secondary"
          >
            <ArrowUpRight size={16} />
            데이터 동기화
          </button>
        </div>
      </div>

      {/* 2. 핵심 지표 (Stats Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 카드 컴포넌트 */}
        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <CheckCircle2 size={20} />
            </div>
            <span className="badge bg-green-50 text-green-700 border border-green-100">+2건</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">전체 업무</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalTasks}</p>
          </div>
        </div>

        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Clock size={20} />
            </div>
            <span className="badge bg-blue-50 text-blue-700 border border-blue-100">Active</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">진행 중</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.ongoingTasks.length}</p>
          </div>
        </div>

        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertCircle size={20} />
            </div>
            <span className="badge bg-red-50 text-red-700 border border-red-100">긴급</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">긴급 이슈</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.urgentTasks.length}</p>
          </div>
        </div>

        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Calendar size={20} />
            </div>
            <span className="text-slate-400 text-xs">Today</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">오늘 일정</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.todaySchedules.length}</p>
          </div>
        </div>
      </div>

      {/* 3. 메인 콘텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* [좌측] 긴급 업무 리스트 (2칸 차지) */}
        <div className="lg:col-span-2 card-base p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              우선순위 업무
            </h3>
            <button className="text-xs text-slate-400 hover:text-slate-600 font-medium">전체보기</button>
          </div>
          
          <div className="space-y-1">
            {summary.urgentTasks.concat(summary.ongoingTasks).slice(0, 5).map((task, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${task.우선순위 === '높음' ? 'bg-red-500' : 'bg-green-500'}`} />
                  <div>
                    <p className="font-medium text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{task.제목}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">담당: {task.담당자명}</span>
                      <span className="text-[10px] text-slate-300">•</span>
                      <span className="text-xs text-slate-400">마감: {task.마감일}</span>
                    </div>
                  </div>
                </div>
                <span className={`badge ${
                  task.상태 === '진행중' ? 'bg-blue-50 text-blue-600' : 
                  task.상태 === '대기' ? 'bg-slate-100 text-slate-600' :
                  'bg-red-50 text-red-600'
                }`}>
                  {task.상태}
                </span>
              </div>
            ))}
            {summary.urgentTasks.length === 0 && summary.ongoingTasks.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">등록된 업무가 없습니다.</div>
            )}
          </div>
        </div>

        {/* [우측] 일정 및 공지 (1칸 차지) */}
        <div className="flex flex-col gap-6">
          {/* 일정 카드 */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">오늘의 일정</h3>
              <MoreHorizontal size={16} className="text-slate-300 cursor-pointer" />
            </div>
            <div className="space-y-4">
              {summary.todaySchedules.length > 0 ? summary.todaySchedules.map((sch, i) => (
                <div key={i} className="flex gap-3 relative">
                  {/* 타임라인 라인 */}
                  {i !== summary.todaySchedules.length - 1 && (
                    <div className="absolute left-[5px] top-7 bottom-[-16px] w-px bg-slate-100" />
                  )}
                  <div className="mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-indigo-500 bg-white z-10 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">{sch.시간 || '09:00'}</p>
                    <p className="text-sm font-medium text-slate-800">{sch.내용}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sch.유형}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-400 py-4">등록된 일정이 없습니다.</p>
              )}
            </div>
          </div>

          {/* 공지사항 요약 */}
          <div className="card-base p-6 flex-1">
            <h3 className="font-bold text-slate-900 mb-4">최근 공지</h3>
            <ul className="space-y-3">
              {summary.recentPosts.map((post, i) => (
                <li key={i} className="group cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-slate-600 group-hover:text-indigo-600 transition-colors line-clamp-1 font-medium">
                      {post.제목}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{post.날짜.slice(5)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}