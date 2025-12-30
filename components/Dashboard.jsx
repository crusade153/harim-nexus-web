'use client'
import { useMemo } from 'react'

export default function Dashboard({ data, onRefresh }) {
  // 전체 데이터 요약 계산
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
      
      {/* 1. 상단 헤더 & 검색 (Dashboard 내부에 통합) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">안녕하세요, Team Nexus! 👋</h1>
          <p className="text-gray-500 text-sm mt-1">오늘의 업무 현황을 한눈에 확인하세요.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <input 
              type="text" 
              placeholder="검색..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-gray-200 focus:ring-2 focus:ring-[#d9f99d] focus:border-transparent outline-none transition-all shadow-sm text-sm"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
          <button onClick={onRefresh} className="p-2.5 bg-white rounded-full border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors">
            🔄
          </button>
        </div>
      </div>

      {/* 2. 메인 벤토 그리드 레이아웃 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* [A] 상단 4개 요약 카드 (GearUp 스타일) */}
        <div className="md:col-span-3 bento-card p-5 flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl">📊</div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">+2건</span>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">전체 업무</p>
            <p className="text-3xl font-bold text-gray-900">{summary.totalTasks}</p>
          </div>
        </div>

        <div className="md:col-span-3 bento-card p-5 flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-[#ecfccb] flex items-center justify-center text-xl">⚡</div>
            <span className="bg-[#d9f99d] text-[#3f6212] text-xs font-bold px-2 py-1 rounded-full">Active</span>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">진행 중</p>
            <p className="text-3xl font-bold text-gray-900">{summary.ongoingTasks.length}</p>
          </div>
        </div>

        <div className="md:col-span-3 bento-card p-5 flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-xl">📅</div>
            <span className="text-gray-400 text-xs">Today</span>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">오늘 일정</p>
            <p className="text-3xl font-bold text-gray-900">{summary.todaySchedules.length}</p>
          </div>
        </div>

        <div className="md:col-span-3 bento-card p-5 flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-xl">🚨</div>
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">Urgent</span>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">긴급 이슈</p>
            <p className="text-3xl font-bold text-gray-900">{summary.urgentTasks.length}</p>
          </div>
        </div>


        {/* [B] 긴급 업무 리스트 (Kanban Data) */}
        <div className="md:col-span-8 bento-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
              <span className="w-2 h-6 rounded-full bg-[#d9f99d]"></span>
              긴급 및 진행 업무
            </h3>
            <span className="text-xs text-gray-400 cursor-pointer hover:text-black">전체보기 →</span>
          </div>
          
          <div className="space-y-3">
            {summary.urgentTasks.concat(summary.ongoingTasks).slice(0, 4).map((task, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group">
                <div className="flex items-center gap-4">
                  <span className={`w-2 h-2 rounded-full ${task.우선순위 === '높음' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{task.제목}</p>
                    <p className="text-xs text-gray-400 mt-0.5">담당: {task.담당자명} · 마감 {task.마감일}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  task.상태 === '진행중' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                }`}>
                  {task.상태}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* [C] 일정 및 게시판 요약 (Calendar & Board Data) */}
        <div className="md:col-span-4 bento-card p-6 flex flex-col gap-6">
          {/* 일정 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">오늘의 일정</h3>
            <div className="space-y-3">
              {summary.todaySchedules.length > 0 ? summary.todaySchedules.map((sch, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-12 text-xs font-bold text-gray-400 pt-1">{sch.시간 || '09:00'}</div>
                  <div className="p-2.5 rounded-xl bg-gray-50 flex-1 border-l-2 border-blue-500">
                    <p className="text-xs font-bold text-gray-800">{sch.내용}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{sch.유형}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">등록된 일정이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="w-full h-px bg-gray-100 my-1" />

          {/* 게시판 */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">최근 공지</h3>
            <ul className="space-y-3">
              {summary.recentPosts.map((post, i) => (
                <li key={i} className="flex justify-between items-center text-sm group cursor-pointer">
                  <span className="text-gray-600 group-hover:text-blue-600 truncate flex-1 pr-2">• {post.제목}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{post.날짜}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* [D] 신규 KPI 관리 (Placeholder) - 인원별 공란 */}
        <div className="md:col-span-12 bento-card p-8 bg-[#1e1e24] text-white border-none">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2">
                <span className="text-2xl">📈</span> KPI 관리
              </h3>
              <p className="text-gray-400 text-sm mt-1">2025년도 팀원별 핵심 성과 지표 (개발 예정)</p>
            </div>
            <button className="px-4 py-2 bg-[#d9f99d] text-black rounded-xl font-bold text-sm hover:bg-[#bef264] transition-colors">
              + 목표 설정
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.members?.map((member, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{backgroundColor: member.아바타색상}}>
                    {member.이름[0]}
                  </div>
                  <div>
                    <p className="font-bold">{member.이름}</p>
                    <p className="text-xs text-gray-400">{member.직위}</p>
                  </div>
                </div>
                {/* 공란 영역 */}
                <div className="h-24 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center">
                  <span className="text-xs text-gray-600">데이터 없음</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}