'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Archive, Link as LinkIcon, ExternalLink, MessageSquare, Plus, X, AlignLeft, Tag } from 'lucide-react'
import Editor from '@/components/ui/Editor'
import { createArchive } from '@/lib/sheets' // ✅ [New] 저장 함수 불러오기

export default function ArchivePage({ archives = [], onRefresh }) {
  const [selectedDoc, setSelectedDoc] = useState(archives[0] || null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newArchive, setNewArchive] = useState({ 카테고리: '매뉴얼', 제목: '', 링크: '', 내용: '' })
  const categories = ['매뉴얼', '온보딩', '트러블슈팅', '기타']

  // ✅ [수정됨] 아카이브 저장 핸들러 (DB 연동)
  const handleSave = async () => {
    // 유효성 검사
    if (!newArchive.제목) {
      toast.error('제목을 입력해주세요!')
      return
    }

    try {
      // 1. Supabase에 저장 요청
      await createArchive(newArchive)

      // 2. 성공 시 처리
      toast.success('문서가 저장되었습니다!')
      setIsModalOpen(false)
      setNewArchive({ 카테고리: '매뉴얼', 제목: '', 링크: '', 내용: '' })
      
      // 3. 목록 새로고침
      if (onRefresh) onRefresh()

    } catch (error) {
      console.error(error)
      toast.error('문서 저장에 실패했습니다.')
    }
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* 1. 좌측: 문서 목록 */}
      <div className="w-full md:w-80 flex flex-col gap-4 border-r border-slate-200 dark:border-slate-700 pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="text-indigo-600" /> 아카이브
          </h2>
          <button onClick={() => setIsModalOpen(true)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          {archives.map(doc => {
            const isSelected = selectedDoc?.ID === doc.ID
            return (
              <div 
                key={doc.ID}
                onClick={() => setSelectedDoc(doc)} 
                className={`p-3 rounded-lg cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <p className={`font-bold text-sm truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>
                  {doc.제목}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                    {doc.카테고리}
                  </span>
                  <span className="text-xs text-slate-400">· {doc.작성자}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. 우측: 상세 보기 */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 overflow-y-auto shadow-sm h-[calc(100vh-140px)] custom-scrollbar">
        {selectedDoc ? (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                {selectedDoc.카테고리}
              </span>
              <span className="text-xs text-slate-400">최종 수정: {selectedDoc.날짜}</span>
            </div>
            
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">{selectedDoc.제목}</h1>
            
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

            <div 
              className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 mb-10 pb-10 border-b border-slate-100 dark:border-slate-700"
              dangerouslySetInnerHTML={{ __html: selectedDoc.내용 }} 
            />

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare size={18}/> 댓글 ({selectedDoc.댓글 || 0})
              </h3>
              <div className="flex gap-2">
                <input type="text" placeholder="댓글을 입력하세요..." className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all" />
                <button onClick={() => toast.success('댓글 등록됨')} className="btn-primary py-2 text-xs px-4">등록</button>
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

      {/* 새 문서 추가 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">새 지식 추가</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1"><Tag size={12}/> 카테고리</label>
                  <select value={newArchive.카테고리} onChange={(e) => setNewArchive({...newArchive, 카테고리: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white">
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1"><LinkIcon size={12}/> 관련 링크 (선택)</label>
                  <input type="text" value={newArchive.링크} onChange={(e) => setNewArchive({...newArchive, 링크: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">제목</label>
                <input type="text" value={newArchive.제목} onChange={(e) => setNewArchive({...newArchive, 제목: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" placeholder="예: 월말 결산 가이드" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-1"><AlignLeft size={12}/> 내용</label>
                <Editor content={newArchive.내용} onChange={(html) => setNewArchive({...newArchive, 내용: html})} />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-2 border-t border-slate-100 dark:border-slate-700 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">취소</button>
              <button onClick={handleSave} className="flex-1 btn-primary">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}