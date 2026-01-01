'use client'
import { useState } from 'react'
import { CheckSquare, Calendar, PieChart, AlertCircle } from 'lucide-react'

export default function ChecklistPage({ checklistData = [], onRefresh }) {
  // 그룹화 로직
  const groups = checklistData.reduce((acc, item) => {
    acc[item.그룹] = acc[item.그룹] || []
    acc[item.그룹].push(item)
    return acc
  }, {})

  const totalItems = checklistData.length
  const completedItems = checklistData.filter(i => i.완료).length
  const progress = Math.round((completedItems / totalItems) * 100) || 0

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      
      {/* 헤더 및 진행률 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-indigo-600" /> 1월 결산 마감 체크리스트
          </h1>
          <p className="text-slate-500 text-sm mt-1">팀 전체가 함께 관리하는 월말 결산 프로세스입니다.</p>
        </div>
        
        <div className="card-base p-4 flex items-center gap-6 w-full md:w-auto min-w-[300px]">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" 
                className="text-indigo-600 transition-all duration-1000 ease-out"
                strokeDasharray={175.9}
                strokeDashoffset={175.9 - (175.9 * progress) / 100}
              />
            </svg>
            <span className="absolute text-sm font-bold text-indigo-900">{progress}%</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total Progress</p>
            <p className="text-sm font-bold text-slate-800">
              {totalItems}개 중 <span className="text-indigo-600">{completedItems}개</span> 완료
            </p>
            {progress < 100 ? (
               <p className="text-xs text-orange-500 font-medium mt-1 flex items-center gap-1">
                 <AlertCircle size={12} /> 마감 D-5
               </p>
            ) : (
              <p className="text-xs text-green-600 font-medium mt-1">모든 항목 완료!</p>
            )}
          </div>
        </div>
      </div>

      {/* 체크리스트 그룹 */}
      <div className="space-y-6">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} className="card-base overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{groupName}</h3>
              <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">
                {items.filter(i => i.완료).length}/{items.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <label key={item.ID} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer group transition-colors">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={item.완료}
                      onChange={() => {}} // 실제 구현 시 상태 업데이트 로직 필요
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-indigo-500 checked:bg-indigo-500"
                    />
                    <CheckSquare className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" size={14} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium transition-colors ${item.완료 ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item.항목}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      {item.담당자[0]}
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right">{item.담당자}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}