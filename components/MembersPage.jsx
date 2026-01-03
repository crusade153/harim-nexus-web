'use client'
import { Mail, Calendar, MoreHorizontal, ShieldCheck, Crown } from 'lucide-react'

// 업무부하 계산 로직
const calculateWorkload = (member, tasks, projects) => {
  let score = 0
  const activeTasks = tasks?.filter(t => t.담당자명 === member.이름 && t.상태 === '진행중') || []
  score += activeTasks.length * 15
  let activeTodos = 0
  projects?.forEach(p => {
    activeTodos += p.todos.filter(todo => todo.담당자 === member.이름 && !todo.완료).length
  })
  score += activeTodos * 5
  return Math.min(score, 100)
}

export default function MembersPage({ members, tasks, projects, onRefresh }) {
  // 관리자 ID 정의
  const SYS_ADMIN_ID = 'crusade153'

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            팀원 관리 <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{members?.length || 0}명</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            원가팀 멤버 현황 및 업무 부하를 모니터링합니다. (가입순 정렬)
          </p>
        </div>
        <button onClick={onRefresh} className="btn-secondary">
          데이터 동기화
        </button>
      </div>

      {/* 멤버 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {members?.map((member, index) => {
          const workload = calculateWorkload(member, tasks, projects)
          // 시스템 관리자 확인
          const isAdmin = member.아이디 === SYS_ADMIN_ID

          return (
            <div 
              key={index}
              className={`bg-white dark:bg-slate-800 border rounded-xl p-6 hover:shadow-lg dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 relative group
                ${isAdmin ? 'border-indigo-300 dark:border-indigo-500 ring-1 ring-indigo-100 dark:ring-indigo-900' : 'border-slate-200 dark:border-slate-700'}
              `}
            >
              <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300">
                <MoreHorizontal size={20} />
              </button>

              {/* 프로필 섹션 */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-2xl font-bold mb-3 border-4 border-white dark:border-slate-800 shadow-sm">
                    {member.이름[0]}
                  </div>
                  {/* 관리자 왕관 아이콘 */}
                  {isAdmin && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-white p-1 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" title="최고 관리자">
                      <Crown size={14} fill="currentColor" />
                    </div>
                  )}
                  <div className={`absolute bottom-3 right-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${
                    member.상태 === '온라인' || member.상태 === 'active' ? 'bg-green-500' : 
                    member.상태 === '자리비움' ? 'bg-yellow-500' : 'bg-slate-400'
                  }`} />
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  {member.이름}
                  {isAdmin && <ShieldCheck size={16} className="text-indigo-500" />}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{member.직위} · {member.부서}</p>
                
                {/* 상태 뱃지 */}
                <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold border ${
                  isAdmin 
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' 
                    : 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                }`}>
                  {isAdmin ? 'System Admin' : member.상태 === 'pending' ? '승인 대기' : member.상태}
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
                {/* 가입 인사말 표시 */}
                {member.오늘의한마디 && (
                  <div className="text-xs text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg mt-2 italic">
                    "{member.오늘의한마디}"
                  </div>
                )}
              </div>

              {/* 업무 부하 게이지 */}
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
              
              {/* 버튼 삭제됨 */}
            </div>
          )
        })}
      </div>
    </div>
  )
}