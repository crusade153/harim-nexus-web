'use client'
import { Mail, Calendar, MoreHorizontal, User, Briefcase, Award } from 'lucide-react'

// 업무부하 계산 로직 (가중치 설정)
const calculateWorkload = (member, tasks, projects) => {
  let score = 0
  
  // 1. 진행중인 Kanban 업무 (개당 15점)
  const activeTasks = tasks?.filter(t => t.담당자명 === member.이름 && t.상태 === '진행중') || []
  score += activeTasks.length * 15

  // 2. 미완료 To-Do 항목 (개당 5점)
  let activeTodos = 0
  projects?.forEach(p => {
    activeTodos += p.todos.filter(todo => todo.담당자 === member.이름 && !todo.완료).length
  })
  score += activeTodos * 5

  return Math.min(score, 100) // 100점 만점
}

export default function MembersPage({ members, tasks, projects, onRefresh }) {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            팀원 관리 <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{members?.length || 0}명</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">실시간 업무 부하와 상태를 모니터링합니다.</p>
        </div>
        <button onClick={onRefresh} className="btn-secondary">
          데이터 동기화
        </button>
      </div>

      {/* 멤버 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {members?.map((member, index) => {
          // 실시간 부하 계산
          const workload = calculateWorkload(member, tasks, projects)
          
          return (
            <div 
              key={index}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-lg dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 relative group"
            >
              {/* 옵션 버튼 */}
              <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300">
                <MoreHorizontal size={20} />
              </button>

              {/* 프로필 섹션 */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-2xl font-bold mb-3 border-4 border-white dark:border-slate-800 shadow-sm relative">
                  {member.이름[0]}
                  <div className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${
                    member.상태 === '온라인' ? 'bg-green-500' : 
                    member.상태 === '자리비움' ? 'bg-yellow-500' : 'bg-slate-400'
                  }`} />
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{member.이름}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{member.직위} · {member.부서}</p>
                
                <div className="mt-3 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-600">
                  {member.상태}
                </div>
              </div>

              {/* 상세 정보 */}
              <div className="space-y-3 py-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Mail size={16} className="text-slate-400"/>
                  <span className="truncate">{member.이메일}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Calendar size={16} className="text-slate-400"/>
                  <span>입사일: {member.입사일 || '-'}</span>
                </div>
              </div>

              {/* 업무 부하 게이지 (자동 계산 적용) */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Current Workload</span>
                  <span className={`text-xs font-bold ${
                    workload > 80 ? 'text-red-500' : workload > 50 ? 'text-orange-500' : 'text-green-500'
                  }`}>{workload}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      workload > 80 ? 'bg-red-500' : workload > 50 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${workload}%` }}
                  />
                </div>
              </div>

              {/* 스킬 태그 */}
              <div className="mt-5 flex flex-wrap gap-2">
                {member.스킬?.map((skill, i) => (
                  <span key={i} className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold">
                    {skill}
                  </span>
                ))}
              </div>

              {/* 액션 버튼 */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button className="btn-secondary py-2 text-xs">프로필</button>
                <button className="btn-primary py-2 text-xs">메시지</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}