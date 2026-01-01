'use client'

export default function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 헤더 스켈레톤 */}
      <div className="flex justify-between items-center h-10">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
      </div>

      {/* 카드 그리드 스켈레톤 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        ))}
      </div>

      {/* 메인 콘텐츠 스켈레톤 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
        <div className="lg:col-span-2 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
        <div className="bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      </div>
    </div>
  )
}