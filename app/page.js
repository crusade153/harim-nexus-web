'use client'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg">
          H
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Harim Team Nexus
        </h1>
        <p className="text-gray-600 mb-8">
          🚀 Enterprise Workspace - Coming Soon
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition">
            시작하기
          </button>
          <button className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition">
            더 알아보기
          </button>
        </div>
      </div>
    </div>
  )
}