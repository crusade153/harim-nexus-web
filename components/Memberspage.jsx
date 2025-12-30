'use client'

export default function MembersPage({ members, onRefresh }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">팀원 관리</h1>
          <p className="text-gray-600">우리 팀원들을 소개합니다</p>
        </div>
        <button 
          onClick={onRefresh}
          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all btn-glow"
        >
          🔄 새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {members?.map((member, index) => (
          <div 
            key={index}
            className="glass rounded-2xl p-6 card-hover animate-fadeIn"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex flex-col items-center mb-4">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-3"
                style={{ 
                  background: `linear-gradient(135deg, ${member.아바타색상 || '#667eea'} 0%, ${member.아바타색상 || '#764ba2'} 100%)` 
                }}
              >
                {member.이름?.[0] || '?'}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {member.이름}
              </h3>
              <p className="text-sm text-gray-500 mb-1">
                {member.직위} · {member.부서}
              </p>
              
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                member.권한 === 'admin' 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {member.권한 === 'admin' ? '관리자' : '팀원'}
              </span>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">📧</span>
                <span className="text-gray-600 truncate">{member.이메일}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">💼</span>
                <span className="text-gray-600">{member.전문분야}</span>
              </div>
              
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-500">업무 부하</span>
                  <span className="text-xs font-bold text-purple-600">{member.업무부하}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      member.업무부하 >= 80 ? 'bg-red-500' :
                      member.업무부하 >= 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${member.업무부하}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
              <button 
                onClick={() => alert(`${member.이름}님에게 메시지 보내기`)}
                className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
              >
                💬 메시지
              </button>
              <button 
                onClick={() => alert(`${member.이름}님의 프로필 보기`)}
                className="flex-1 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                👤 프로필
              </button>
            </div>
          </div>
        ))}
      </div>

      {(!members || members.length === 0) && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">팀원이 없습니다</h3>
          <p className="text-gray-600">팀원을 추가해보세요!</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <p className="text-sm text-gray-500">총 팀원</p>
              <p className="text-3xl font-bold gradient-text">{members?.length || 0}명</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-2xl">
              ⚡
            </div>
            <div>
              <p className="text-sm text-gray-500">평균 업무 부하</p>
              <p className="text-3xl font-bold gradient-text">
                {members?.length > 0 
                  ? Math.round(members.reduce((sum, m) => sum + parseFloat(m.업무부하 || 0), 0) / members.length)
                  : 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
              🎯
            </div>
            <div>
              <p className="text-sm text-gray-500">관리자</p>
              <p className="text-3xl font-bold gradient-text">
                {members?.filter(m => m.권한 === 'admin').length || 0}명
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}