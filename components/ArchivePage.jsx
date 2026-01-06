'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Archive, Link as LinkIcon, ExternalLink, MessageSquare, Plus, X, Send, Trash2, Edit2 } from 'lucide-react'
import Editor from '@/components/ui/Editor'
import { createArchive, createComment, deleteArchive, updateArchive } from '@/lib/sheets'

export default function ArchivePage({ archives = [], currentUser, onRefresh }) {
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false) // 수정 모드 상태
  const [newArchive, setNewArchive] = useState({ 카테고리: '매뉴얼', 제목: '', 링크: '', 내용: '' })
  const [commentInput, setCommentInput] = useState('')
  const categories = ['매뉴얼', '온보딩', '트러블슈팅', '기타']
  const isAdmin = currentUser?.아이디 === 'crusade153'

  useEffect(() => {
    if (archives.length > 0 && !selectedDoc) {
      setSelectedDoc(archives[0])
    } else if (selectedDoc) {
      const updated = archives.find(a => a.ID === selectedDoc.ID)
      if (updated) setSelectedDoc(updated)
    }
  }, [archives, selectedDoc])

  // ✅ 작성/수정 핸들러
  const handleSave = async () => {
    if (!newArchive.제목) { toast.error('제목을 입력해주세요!'); return }
    try {
      if (isEditMode) {
        await updateArchive(selectedDoc.ID, newArchive)
        toast.success('문서가 수정되었습니다.')
      } else {
        await createArchive({ ...newArchive, 작성자: currentUser?.이름 || '익명' })
        toast.success('문서가 저장되었습니다!')
      }
      setIsModalOpen(false)
      setIsEditMode(false)
      setNewArchive({ 카테고리: '매뉴얼', 제목: '', 링크: '', 내용: '' })
      if (onRefresh) onRefresh()
    } catch (error) { toast.error('저장 실패') }
  }

  const handleDelete = async () => {
    if(!confirm('문서를 삭제하시겠습니까?')) return
    try {
      await deleteArchive(selectedDoc.ID)
      toast.success('문서가 삭제되었습니다.')
      setSelectedDoc(null)
      if (onRefresh) onRefresh()
    } catch (e) { toast.error('삭제 실패') }
  }

  // ✅ 수정 모달 열기
  const openEditModal = () => {
    setNewArchive({
        카테고리: selectedDoc.카테고리,
        제목: selectedDoc.제목,
        링크: selectedDoc.링크,
        내용: selectedDoc.내용
    })
    setIsEditMode(true)
    setIsModalOpen(true)
  }

  const handleAddComment = async () => {
    if (!commentInput.trim()) return
    try {
      await createComment({ postID: selectedDoc.ID, content: commentInput, authorName: currentUser?.이름 || '익명' })
      toast.success('댓글 등록 완료')
      setCommentInput('')
      if (onRefresh) onRefresh()
    } catch (e) { toast.error('댓글 등록 실패') }
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-80 flex flex-col gap-4 border-r border-slate-200 dark:border-slate-700 pr-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Archive className="text-indigo-600" /> 아카이브</h2>
          <button onClick={() => { setIsEditMode(false); setNewArchive({ 카테고리: '매뉴얼', 제목: '', 링크: '', 내용: '' }); setIsModalOpen(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><Plus size={20} /></button>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar">
          {archives.map(doc => (
            <div key={doc.ID} onClick={() => setSelectedDoc(doc)} className={`p-3 rounded-lg cursor-pointer border transition-all ${selectedDoc?.ID === doc.ID ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>
              <p className={`font-bold text-sm truncate ${selectedDoc?.ID === doc.ID ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}>{doc.제목}</p>
              <div className="flex items-center gap-2 mt-1.5"><span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">{doc.카테고리}</span><span className="text-xs text-slate-400">· {doc.작성자}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 overflow-y-auto shadow-sm h-[calc(100vh-140px)] custom-scrollbar">
        {selectedDoc ? (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-4"><span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">{selectedDoc.카테고리}</span><span className="text-xs text-slate-400">최종 수정: {selectedDoc.날짜}</span></div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight">{selectedDoc.제목}</h1>
                </div>
                {/* ✅ 수정/삭제 버튼 */}
                {(currentUser?.이름 === selectedDoc.작성자 || isAdmin) && (
                    <div className="flex gap-2">
                        <button onClick={openEditModal} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="문서 수정"><Edit2 size={20}/></button>
                        <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="문서 삭제"><Trash2 size={20}/></button>
                    </div>
                )}
            </div>
            
            {selectedDoc.링크 && (
              <a href={selectedDoc.링크} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl mb-8 group hover:border-indigo-300 transition-all">
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg text-indigo-600 shadow-sm"><LinkIcon size={20}/></div>
                <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-500 uppercase mb-0.5">Reference Link</p><p className="text-sm font-medium text-indigo-600 truncate group-hover:underline">{selectedDoc.링크}</p></div>
                <ExternalLink size={16} className="text-slate-400 group-hover:text-indigo-500"/>
              </a>
            )}
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 mb-10 pb-10 border-b border-slate-100 dark:border-slate-700" dangerouslySetInnerHTML={{ __html: selectedDoc.내용 }} />

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><MessageSquare size={18}/> 댓글 ({selectedDoc.댓글?.length || 0})</h3>
              <div className="space-y-4 mb-6">{selectedDoc.댓글?.map((cmt, idx) => (<div key={idx} className="flex gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">{cmt.작성자[0]}</div><div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl rounded-tl-none"><div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{cmt.작성자}</span><span className="text-[10px] text-slate-400">{cmt.시간}</span></div><p className="text-sm text-slate-600 dark:text-slate-400">{cmt.내용}</p></div></div>))}</div>
              <div className="flex gap-2"><input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="댓글을 입력하세요..." className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" onKeyDown={e => e.key === 'Enter' && handleAddComment()} /><button onClick={handleAddComment} className="btn-primary py-2 text-xs px-4"><Send size={14}/></button></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400"><Archive size={48} className="mb-4 opacity-20" /><p>문서를 선택하세요.</p></div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700"><h3 className="text-lg font-bold text-slate-900 dark:text-white">{isEditMode ? '문서 수정' : '새 지식 추가'}</h3><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <input type="text" value={newArchive.제목} onChange={e => setNewArchive({...newArchive, 제목: e.target.value})} className="w-full px-4 py-2.5 border rounded-lg" placeholder="제목" />
              <div className="grid grid-cols-2 gap-4">
                <select value={newArchive.카테고리} onChange={e => setNewArchive({...newArchive, 카테고리: e.target.value})} className="w-full px-3 py-2.5 border rounded-lg">{categories.map(c => <option key={c}>{c}</option>)}</select>
                <input type="text" value={newArchive.링크} onChange={e => setNewArchive({...newArchive, 링크: e.target.value})} className="w-full px-3 py-2.5 border rounded-lg" placeholder="관련 링크" />
              </div>
              <Editor content={newArchive.내용} onChange={html => setNewArchive({...newArchive, 내용: html})} />
            </div>
            <div className="flex gap-3 p-6 pt-2 border-t"><button onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">취소</button><button onClick={handleSave} className="flex-1 btn-primary">{isEditMode ? '수정' : '저장'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}