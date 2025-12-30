'use client'

export default function Header() {
  return (
    <header className="sticky top-0 z-30 bg-[#f3f5f7]/80 backdrop-blur-md pt-6 pb-4 px-8">
      <div className="flex items-center justify-between">
        {/* 📍 위치/경로 표시 */}
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
          <span>📍</span>
          <span className="font-bold text-gray-800">Harim Foods</span>
          <span>/</span>
          <span>익산공장 원가팀</span>
        </div>

        {/* 🔍 검색바 */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative group">
            <input
              type="text"
              placeholder="무엇이든 검색해보세요..."
              className="w-full pl-12 pr-4 py-3 text-sm bg-white border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-[#ccf33e] transition-all"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
          </div>
        </div>

        {/* 🔔 알림 및 설정 */}
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-500 hover:text-black shadow-sm transition-colors">
            🔔
          </button>
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-500 hover:text-black shadow-sm transition-colors">
            ⚙️
          </button>
        </div>
      </div>
    </header>
  )
}