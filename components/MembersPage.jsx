'use client'
import { Mail, Phone, MoreHorizontal, Briefcase, Calendar } from 'lucide-react'

export default function MembersPage({ members, onRefresh }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">팀원 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">총 {members?.length || 0}명의 팀원이 함께하고 있습니다.</p>
        </div>
        <button 
          onClick={onRefresh}
          className="btn-secondary"
        >
          데이터 동기화
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {members?.map((member, index) => (
          <div 
            key={index}
            className="card-base p-6 group relative hover:-translate-y-1 transition-transform duration-300"
          >
            {/* 우측 상단 옵션 버튼 */}
            <button className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300">
              <MoreHorizontal size={20} />
            </button>

            {/* 프로필 헤더 */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-2xl font-bold mb-4 border-4 border-white dark:border-slate-800 shadow-sm">
                {member.이름[0]}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{member.이름}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{member.직위} · {member.부서}</p>
              
              {/* 상태 표시 */}
              <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${
                member.상태 === '온라인' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                member.상태 === '자리비움' ? 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' :
                'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  member.상태 === '온라인' ? 'bg-green-500' : 
                  member.상태 === '자리비움' ? 'bg-yellow-500' : 'bg-slate-400'
                }`} />
                {member.상태}
              </div>
            </div>

            {/* 정보 그리드 */}
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <Mail size={16} className="text-slate-400" />
                <span className="truncate">{member.이메일}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <Calendar size={16} className="text-slate-400" />
                <span>입사일: {member.입사일 || '-'}</span>
              </div>
            </div>

            {/* 업무 부하 */}
            <div className="mt-5">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">업무 부하</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{member.업무부하}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${member.업무부하}%` }}
                />
              </div>
            </div>

            {/* 스킬 태그 */}
            <div className="mt-5 flex flex-wrap gap-2">
              {member.스킬?.map((skill, i) => (
                <span key={i} className="px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-100 dark:border-slate-600">
                  {skill}
                </span>
              ))}
            </div>

            {/* 액션 버튼 */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button className="btn-secondary py-2 text-xs">
                프로필
              </button>
              <button className="btn-primary py-2 text-xs">
                메시지
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}