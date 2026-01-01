'use client'
import { useState } from 'react'
import { Book, FileText, Search, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function WikiPage({ wikiData = [], onRefresh }) {
  const [selectedDoc, setSelectedDoc] = useState(wikiData[0] || null)

  const categories = ['전체', '매뉴얼', '온보딩', '트러블슈팅']
  const [activeCategory, setActiveCategory] = useState('전체')

  const filteredDocs = wikiData.filter(doc => 
    activeCategory === '전체' ? true : doc.카테고리 === activeCategory
  )

  const getIcon = (category) => {
    switch(category) {
      case '매뉴얼': return <ShieldCheck size={18} className="text-indigo-500" />
      case '트러블슈팅': return <AlertTriangle size={18} className="text-orange-500" />
      default: return <FileText size={18} className="text-slate-400" />
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      
      {/* 왼쪽: 문서 목록 사이드바 */}
      <div className="w-full md:w-80 flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Book className="text-indigo-600" size={24} /> 팀 지식고
          </h2>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                activeCategory === cat 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 문서 리스트 */}
        <div className="flex-1 card-base overflow-y-auto p-2 space-y-1">
          {filteredDocs.map(doc => (
            <div
              key={doc.ID}
              onClick={() => setSelectedDoc(doc)}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${
                selectedDoc?.ID === doc.ID 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                {getIcon(doc.카테고리)}
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-bold truncate ${selectedDoc?.ID === doc.ID ? 'text-indigo-900' : 'text-slate-700'}`}>
                    {doc.제목}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {doc.작성자} · {doc.업데이트}
                  </p>
                </div>
                <ChevronRight size={16} className={`text-slate-300 ${selectedDoc?.ID === doc.ID ? 'text-indigo-400' : ''}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 오른쪽: 문서 뷰어 */}
      <div className="flex-1 card-base p-8 overflow-y-auto h-full bg-white relative">
        {selectedDoc ? (
          <div className="max-w-3xl mx-auto animate-fadeIn">
            <div className="mb-8 pb-6 border-b border-slate-100">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 mb-4">
                {getIcon(selectedDoc.카테고리)}
                {selectedDoc.카테고리}
              </span>
              <h1 className="text-3xl font-bold text-slate-900 mb-3 leading-tight">{selectedDoc.제목}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>작성자: <span className="text-slate-600 font-medium">{selectedDoc.작성자}</span></span>
                <span>•</span>
                <span>최종 수정: {selectedDoc.업데이트}</span>
              </div>
            </div>
            
            <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed whitespace-pre-line">
              {selectedDoc.내용}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Book size={48} className="mb-4 opacity-20" />
            <p>문서를 선택하여 내용을 확인하세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}