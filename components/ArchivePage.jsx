'use client'
import { useState } from 'react'
import { Archive, Link as LinkIcon, ExternalLink, MessageSquare, Plus, X, AlignLeft, Tag } from 'lucide-react'

export default function ArchivePage({ archives = [], onRefresh }) {
  const [selectedDoc, setSelectedDoc] = useState(archives[0] || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // 새 글 작성 상태
  const [newArchive, setNewArchive] = useState({
    카테고리: '매뉴얼',
    제목: '',
    링크: '',
    내용: ''
  })

  const categories = ['매뉴얼', '온보딩', '트러블슈팅', '기타']

  // 저장 핸들러 (API 연동 포인트)
  const handleSave = () => {
    if (!newArchive.제목) return alert('제목을 입력해주세요!')
    
    // 실제로는 DB에 저장하는 로직 필요
    alert(`새 아카이브 "${newArchive.제목}" 저장 완료 (DB 연동 필요)`)
    
    setIsModalOpen(false)
    setNewArchive({ 카테고리: '매뉴얼', 제목: '', 링크: '', 내용: '' }) // 초기화
    onRefresh() // 데이터 새로고침
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      
      {/* 1. 좌측: 문서 목록 */}
      <div className="w-full md:w-80 flex flex-col gap-4 border-r border-slate-200 dark:border-slate-700 pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="text-indigo-600" /> 아카이브
          </h2>
          {/* ➕ 추가 버튼 */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
          {archives.map(doc => (
            <div 
              key={doc.ID}
              onClick={() => setSelectedDoc(doc)} 
              className={`p-3 rounded-lg cursor-pointer border transition-all ${
                selectedDoc?.ID === doc.ID 
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{doc.제목}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                  {doc.카테고리}
                </span>
                <span className="text-xs text-slate-400">· {doc.작성자}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 우측: 상세 보기 */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 overflow-y-auto shadow-sm h-[calc(100vh-140px)]">
        {selectedDoc ? (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                {selectedDoc.카테고리}
              </span>
              <span className="text-xs text-slate-400">최종 수정: {selectedDoc.날짜}</span>
            </div>
            
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">{selectedDoc.제목}</h1>
            
            {/* 링크 섹션 */}
            {selectedDoc.링크 && (
              <a href={selectedDoc.링크} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl mb-8 group hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg text-indigo-600 shadow-sm border border-slate-100 dark:border-slate-700"><LinkIcon size={20}/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Reference Link</p>
                  <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate group-hover:underline">{selectedDoc.링크}</p>
                </div>
                <ExternalLink size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors"/>
              </a>
            )}

            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-10 pb-10 border-b border-slate-100 dark:border-slate-700">
              {selectedDoc.내용}
            </div>

            {/* 댓글 섹션 */}
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare size={18}/> 댓글 ({selectedDoc.댓글?.length || 0})
              </h3>
              
              <div className="space-y-4 mb-6">
                {selectedDoc.댓글?.map((cmt, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                      {cmt.작성자[0]}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-2 rounded-2xl rounded-tl-none">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cmt.작성자}</span>
                        <span className="text-[10px] text-slate-400">{cmt.시간}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{cmt.내용}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input type="text" placeholder="댓글을 입력하세요..." className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all" />
                <button className="btn-primary py-2 text-xs px-4">등록</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Archive size={48} className="mb-4 opacity-20" />
            <p>문서를 선택하거나 새로운 문서를 추가하세요.</p>
          </div>
        )}
      </div>

      {/* 3. 새 문서 추가 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">새 지식 추가</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* 카테고리 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1">
                  <Tag size={12}/> 카테고리
                </label>
                <div className="flex gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setNewArchive({...newArchive, 카테고리: cat})}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        newArchive.카테고리 === cat 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">제목</label>
                <input
                  type="text"
                  value={newArchive.제목}
                  onChange={(e) => setNewArchive({...newArchive, 제목: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="예: 월말 결산 가이드"
                />
              </div>

              {/* 링크 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1">
                  <LinkIcon size={12}/> 관련 링크 (선택)
                </label>
                <input
                  type="text"
                  value={newArchive.링크}
                  onChange={(e) => setNewArchive({...newArchive, 링크: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  placeholder="https://..."
                />
              </div>

              {/* 내용 입력 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1">
                  <AlignLeft size={12}/> 내용
                </label>
                <textarea
                  value={newArchive.내용}
                  onChange={(e) => setNewArchive({...newArchive, 내용: e.target.value})}
                  className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
                  placeholder="내용을 입력하세요..."
                />
              </div>

              {/* 버튼 그룹 */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">취소</button>
                <button onClick={handleSave} className="flex-1 btn-primary">저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}