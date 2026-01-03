'use client'
import { useMemo } from 'react'
import { 
  CheckCircle2, Clock, AlertCircle, Calendar, ArrowUpRight, 
  Zap, Link as LinkIcon, Activity 
} from 'lucide-react'

export default function Dashboard({ data, onRefresh }) {
  const summary = useMemo(() => {
    const tasks = data.tasks || []
    const members = data.members || []
    
    // ✅ [수정됨] 진행률 자동 계산
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.상태 === '완료').length
    const progressRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

    // ✅ [수정됨] 온라인 멤버 수 자동 계산
    const onlineMembers = members.filter(m => m.상태 === '온라인').length

    return {
      progressRate, // 계산된 진행률
      onlineMembers, // 계산된 온라인 수
      totalMembers: members.length,
      urgentTasks: tasks.filter(t => t.우선순위 === '높음' && t.상태 !== '완료'),
      ongoingTasks: tasks.filter(t => t.상태 === '진행중'),
      recentActivities: data.activities || [],
      quickLinks: data.quickLinks || [],
      members: members
    }
  }, [data])

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">안녕하세요, 원가팀! 👋</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">오늘의 업무 현황과 주요 이슈를 확인하세요.</p>
        </div>
        <button onClick={onRefresh} className="btn-secondary">
          <ArrowUpRight size={16} /> 데이터 동기화
        </button>
      </div>

      {/* 2. 핵심 지표 (Stats Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 진행률 카드 */}
        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><CheckCircle2 size={20} /></div>
            <span className="badge bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">Live</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">전체 업무 진행률</p>
            {/* ✅ 계산된 진행률 표시 */}
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.progressRate}%</p>
          </div>
        </div>
        
        {/* 진행중 업무 카드 */}
        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400"><Clock size={20} /></div>
            <span className="badge bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">Active</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">진행 중 업무</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.ongoingTasks.length}</p>
          </div>
        </div>

        {/* 긴급 이슈 카드 */}
        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><AlertCircle size={20} /></div>
            <span className="badge bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800">Action</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">긴급 이슈</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.urgentTasks.length}</p>
          </div>
        </div>

        {/* 팀원 상태 카드 */}
        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400"><Calendar size={20} /></div>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">팀원 상태</p>
            {/* ✅ 계산된 멤버 수 표시 */}
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.onlineMembers}/{summary.totalMembers}명 온라인</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* [좌측 2칸] 메인: 팀 펄스 + 긴급 업무 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Team Pulse 위젯 */}
          <div className="card-base p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap size={18} className="text-yellow-500 fill-yellow-500" /> Team Pulse
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.members.map((member, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                      {member.이름[0]}
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                      member.상태 === '온라인' ? 'bg-green-500' : 
                      member.상태 === '자리비움' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{member.이름}</p>
                      <span className="text-[10px] text-slate-400">{member.상태}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">"{member.오늘의한마디 || '열심히 하겠습니다!'}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 긴급 업무 리스트 */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">우선순위 업무</h3>
              <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium">더보기</button>
            </div>
            <div className="space-y-1">
              {summary.urgentTasks.concat(summary.ongoingTasks).slice(0, 4).map((task, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                   <div className="flex items-center gap-3">
                     <span className={`w-1.5 h-1.5 rounded-full ${task.우선순위 === '높음' ? 'bg-red-500' : 'bg-green-500'}`} />
                     <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{task.제목}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-xs text-slate-400">{task.담당자명}</span>
                     <span className={`badge ${task.상태 === '진행중' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                       {task.상태}
                     </span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* [우측 1칸] 사이드: 퀵 링크 + 활동 로그 */}
        <div className="flex flex-col gap-6">
          
          {/* 퀵 링크 */}
          <div className="card-base p-6">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <LinkIcon size={18} className="text-indigo-500" /> 퀵 링크
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {summary.quickLinks.map((link, i) => (
                <a 
                  key={i} 
                  href={link.URL} 
                  target="_blank"             // ✅ 새 탭에서 열기
                  rel="noopener noreferrer"   // ✅ 보안 옵션 추가
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
                >
                  <span className="text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 mb-2">
                    <LinkIcon size={20} /> 
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{link.이름}</span>
                </a>
              ))}
            </div>
          </div>

          {/* 활동 로그 */}
          <div className="card-base p-6 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={18} className="text-slate-400" /> 활동 로그
            </h3>
            <div className="relative pl-2 space-y-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-100 dark:bg-slate-700" />
              {summary.recentActivities.map((log, i) => (
                <div key={i} className="relative flex gap-3 text-sm">
                  <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-800 z-10 shrink-0 mt-1" />
                  <div>
                    <p className="text-slate-800 dark:text-slate-200 leading-snug">
                      <span className="font-bold">{log.사용자}</span>{log.행동}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{log.시간}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}