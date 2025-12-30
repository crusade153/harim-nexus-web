'use client'
import { useMemo } from 'react'

export default function Dashboard({ data, onRefresh }) {
  const stats = useMemo(() => {
    const tasks = data.tasks || []
    const total = tasks.length
    const inProgress = tasks.filter(t => t.상태 === '진행중').length
    const completed = tasks.filter(t => t.상태 === '완료').length
    const blocked = tasks.filter(t => t.상태 === '중단').length
    const progress = total ? Math.round((completed / total) * 100) : 0

    return { total, inProgress, completed, blocked, progress }
  }, [data.tasks])

  const StatCard = ({ title, value, subtitle, icon, gradient, delay }) => (
    <div 
      className="glass rounded-2xl p-6 card-hover animate-fadeIn"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-4xl font-bold gradient-text">{value}</h3>
        </div>
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-lg`}>
          {icon}
        </div>
      </div>
      <p className="text-gray-400 text-sm">{subtitle}</p>
    </div>
  )

  const urgentTasks = data.tasks?.filter(t => t.강조표시 === 'TRUE' && t.상태 !== '완료') || []

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="glass rounded-2xl p-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white animate-fadeIn">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold mb-2">
              안녕하세요, 유경덕님! 👋
            </h1>
            <p className="text-purple-100 text-lg">
              오늘도 멋진 하루 되세요! 현재 {stats.inProgress}개의 업무가 진행 중입니다.
            </p>
          </div>
          <button 
            onClick={onRefresh}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-all backdrop-blur-sm"
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* Urgent Tasks Alert */}
      {urgentTasks.length > 0 && (
        <div className="glass rounded-2xl p-6 border-l-4 border-red-500 bg-red-50/50 animate-fadeIn">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center text-2xl flex-shrink-0">
              🚨
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-900 mb-2">
                긴급 이슈 {urgentTasks.length}건
              </h3>
              <div className="space-y-2">
                {urgentTasks.map((task, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl">
                    <div>
                      <span className="font-bold text-gray-900">{task.제목}</span>
                      <span className="text-gray-500 text-sm ml-2">담당: {task.담당자명}</span>
                    </div>
                    <span className="text-red-600 font-medium text-sm">
                      마감: {task.마감일}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="전체 업무"
          value={stats.total}
          subtitle="등록된 총 업무"
          icon="📊"
          gradient="from-blue-500 to-cyan-500"
          delay={0}
        />
        <StatCard
          title="진행 중"
          value={stats.inProgress}
          subtitle="현재 작업 중"
          icon="⚡"
          gradient="from-purple-500 to-pink-500"
          delay={100}
        />
        <StatCard
          title="완료"
          value={stats.completed}
          subtitle="처리 완료됨"
          icon="✅"
          gradient="from-green-500 to-teal-500"
          delay={200}
        />
        <StatCard
          title="완료율"
          value={`${stats.progress}%`}
          subtitle="주간 달성률"
          icon="🎯"
          gradient="from-orange-500 to-red-500"
          delay={300}
        />
      </div>

      {/* Recent Activity */}
      <div className="glass rounded-2xl p-6 animate-fadeIn">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold gradient-text">최근 활동</h2>
          <button className="text-purple-600 font-medium hover:text-purple-700 transition-colors">
            전체 보기 →
          </button>
        </div>
        
        <div className="space-y-4">
          {data.tasks?.slice(0, 5).map((task, index) => (
            <div 
              key={index}
              className="flex items-center gap-4 p-4 hover:bg-purple-50 rounded-xl transition-all cursor-pointer group"
            >
              <div className={`w-2 h-2 rounded-full ${
                task.상태 === '완료' ? 'bg-green-500' :
                task.상태 === '중단' ? 'bg-red-500' :
                'bg-blue-500'
              } group-hover:scale-150 transition-transform`} />
              
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                  {task.제목}
                </h4>
                <p className="text-sm text-gray-500">
                  {task.담당자명} · {task.상태}
                </p>
              </div>
              
              <div className="text-right">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  task.우선순위 === '높음' ? 'bg-red-100 text-red-700' :
                  task.우선순위 === '보통' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {task.우선순위}
                </span>
                <p className="text-xs text-gray-400 mt-1">{task.작성일}</p>
              </div>
            </div>
          ))}
          
          {(!data.tasks || data.tasks.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-lg font-medium">아직 등록된 업무가 없습니다</p>
              <p className="text-sm">새 업무를 등록해보세요!</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 animate-fadeIn">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <h3 className="font-bold text-gray-900">팀원</h3>
              <p className="text-2xl font-bold gradient-text">{data.members?.length || 0}명</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">활성 팀원 수</p>
        </div>

        <div className="glass rounded-2xl p-6 animate-fadeIn">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-2xl">
              💬
            </div>
            <div>
              <h3 className="font-bold text-gray-900">게시글</h3>
              <p className="text-2xl font-bold gradient-text">{data.posts?.length || 0}개</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">등록된 게시글</p>
        </div>

        <div className="glass rounded-2xl p-6 animate-fadeIn">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
              📅
            </div>
            <div>
              <h3 className="font-bold text-gray-900">일정</h3>
              <p className="text-2xl font-bold gradient-text">{data.schedules?.length || 0}건</p>
            </div>
          </div>
          <p className="text-sm text-gray-500">예정된 일정</p>
        </div>
      </div>
    </div>
  )
}