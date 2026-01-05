'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { X, Image as ImageIcon, Search, MessageSquare, Trash2, Edit2 } from 'lucide-react'
import { createPost, createComment, deletePost, updatePost, deleteComment } from '@/lib/sheets' // ✅ 수정/삭제 함수 추가

export default function BoardPage({ posts, currentUser, onRefresh }) {
  const [filter, setFilter] = useState('전체')
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  
  // 수정 모드인지 확인
  const [isEditMode, setIsEditMode] = useState(false) 
  
  const [newPost, setNewPost] = useState({ 제목: '', 태그: '일반', 내용: '', 첨부파일: null })
  const [commentInput, setCommentInput] = useState('')

  // 관리자 권한 확인 (유경덕 ID 확인)
  const isAdmin = currentUser?.아이디 === 'crusade153'

  useEffect(() => {
    if (selectedPost) {
      const updatedPost = posts.find(p => p.ID === selectedPost.ID)
      if (updatedPost) setSelectedPost(updatedPost)
    }
  }, [posts])

  const filteredPosts = posts?.filter(post => {
    if (filter === '전체') return true
    return post.태그 === filter
  }) || []

  const getTagStyle = (tag) => {
    switch (tag) {
      case '긴급': return 'bg-red-100 text-red-600 border-red-200'
      case '공지': return 'bg-blue-100 text-blue-600 border-blue-200'
      case '이슈': return 'bg-orange-100 text-orange-600 border-orange-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) { setNewPost({ ...newPost, 첨부파일: file.name }) }
  }

  // ✅ 글 저장 or 수정 핸들러
  const handleSave = async () => {
    if (!newPost.제목.trim()) { toast.error('제목 입력!'); return }
    if (!newPost.내용.trim()) { toast.error('내용 입력!'); return }

    try {
      if (isEditMode && selectedPost) {
        // 수정 모드
        await updatePost(selectedPost.ID, newPost)
        toast.success('게시글이 수정되었습니다!')
      } else {
        // 새 글 작성
        await createPost({ ...newPost, 작성자명: currentUser?.이름 || '익명' })
        toast.success('게시글 등록 완료!')
      }
      
      setNewPost({ 제목: '', 태그: '일반', 내용: '', 첨부파일: null })
      setIsWriteModalOpen(false)
      setIsEditMode(false)
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('처리 실패')
    }
  }

  // ✅ 글 삭제 핸들러
  const handleDeletePost = async () => {
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return
    try {
      await deletePost(selectedPost.ID)
      toast.success('게시글이 삭제되었습니다.')
      setSelectedPost(null)
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('삭제 실패')
    }
  }

  // ✅ 수정 버튼 클릭 시 모달 열기
  const openEditModal = () => {
    setNewPost({
      제목: selectedPost.제목,
      태그: selectedPost.태그,
      내용: selectedPost.내용,
      첨부파일: null
    })
    setIsEditMode(true)
    setIsWriteModalOpen(true)
  }

  const handleAddComment = async () => {
    if (!commentInput.trim()) return
    try {
      await createComment({
        postID: selectedPost.ID,
        content: commentInput,
        authorName: currentUser?.이름 || '익명'
      })
      toast.success('댓글 등록 완료')
      setCommentInput('')
      if (onRefresh) onRefresh() 
    } catch (error) {
      toast.error('댓글 등록 실패')
    }
  }

  // ✅ 댓글 삭제 핸들러
  const handleDeleteComment = async (commentId) => {
    if(!confirm('댓글을 삭제하시겠습니까?')) return
    try {
      await deleteComment(commentId)
      toast.success('댓글 삭제됨')
      if (onRefresh) onRefresh()
    } catch (error) {
      toast.error('삭제 실패')
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">게시판 & 이슈 💬</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">팀 내 주요 소식과 긴급 이슈를 공유하세요.</p>
        </div>
        <button onClick={() => { setIsEditMode(false); setNewPost({ 제목: '', 태그: '일반', 내용: '', 첨부파일: null }); setIsWriteModalOpen(true); }} className="btn-primary"><span>✏️</span> 글쓰기</button>
      </div>

      <div className="card-base p-6 min-h-[500px]">
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {['전체', '공지', '이슈', '일반', '자료'].map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${filter === tab ? 'bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'}`}>{tab}</button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 uppercase tracking-wider">
                <th className="py-3 pl-4 font-medium w-20">태그</th>
                <th className="py-3 font-medium">제목</th>
                <th className="py-3 font-medium w-32">작성자</th>
                <th className="py-3 font-medium w-32">날짜</th>
                <th className="py-3 font-medium w-24 text-center">댓글</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPosts.map((post, i) => (
                <tr key={i} onClick={() => setSelectedPost(post)} className="group border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <td className="py-4 pl-4"><span className={`inline-block px-2 py-1 rounded text-[11px] font-bold border ${getTagStyle(post.태그)}`}>{post.태그}</span></td>
                  <td className="py-4 pr-4"><span className="font-medium text-gray-900 dark:text-gray-200 group-hover:text-blue-600 transition-colors">{post.제목}</span></td>
                  <td className="py-4"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[10px] text-gray-600 font-bold">{post.작성자명[0]}</div><span className="text-gray-600 dark:text-gray-400">{post.작성자명}</span></div></td>
                  <td className="py-4 text-gray-500 text-xs">{post.날짜}</td>
                  <td className="py-4 text-center"><span className="text-xs text-gray-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-lg">{post.댓글수}</span></td>
                </tr>
              ))}
              {filteredPosts.length === 0 && (
                <tr><td colSpan="5" className="py-20 text-center text-gray-400 text-sm">등록된 게시글이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-2 mb-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTagStyle(selectedPost.태그)}`}>{selectedPost.태그}</span><span className="text-xs text-gray-400">{selectedPost.날짜}</span></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{selectedPost.제목}</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* ✅ 수정/삭제 버튼: 본인이거나 관리자일 때만 표시 */}
                {(currentUser?.이름 === selectedPost.작성자명 || isAdmin) && (
                  <>
                    <button onClick={openEditModal} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18}/></button>
                    <button onClick={handleDeletePost} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                  </>
                )}
                <button onClick={() => setSelectedPost(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400"><X size={20} /></button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line min-h-[100px] mb-8">{selectedPost.내용}</div>

              <div className="pt-6 border-t border-gray-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4 flex items-center gap-2"><MessageSquare size={16}/> 댓글 <span className="text-indigo-500">{selectedPost.댓글수}</span></h3>
                <div className="space-y-4 mb-6">
                  {selectedPost.댓글 && selectedPost.댓글.length > 0 ? (
                    selectedPost.댓글.map((cmt, idx) => (
                      <div key={idx} className="flex gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">{cmt.작성자[0]}</div>
                        <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl rounded-tl-none relative group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cmt.작성자}</span><span className="text-[10px] text-slate-400">{cmt.시간}</span></div>
                            {/* 댓글 삭제 버튼: 본인 또는 관리자 */}
                            {(currentUser?.이름 === cmt.작성자 || isAdmin) && (
                              <button onClick={() => handleDeleteComment(cmt.ID)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{cmt.내용}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">아직 댓글이 없습니다.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="댓글을 입력하세요..." className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all shadow-sm" onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                  <button onClick={handleAddComment} className="btn-primary py-2 px-5 text-xs whitespace-nowrap h-[46px]">등록</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative">
            <button onClick={() => { setIsWriteModalOpen(false); setIsEditMode(false); }} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-white"><X size={24} /></button>
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{isEditMode ? '게시글 수정' : '새 게시글 작성'}</h2>
            <div className="space-y-5">
              <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">제목 <span className="text-red-500">*</span></label><input type="text" value={newPost.제목} onChange={(e) => setNewPost({...newPost, 제목: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all dark:text-white" placeholder="제목을 입력하세요" autoFocus /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">카테고리</label><select value={newPost.태그} onChange={(e) => setNewPost({...newPost, 태그: e.target.value})} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-transparent focus:border-indigo-500 outline-none dark:text-white appearance-none"><option>일반</option><option>이슈</option><option>공지</option><option>긴급</option><option>자료</option></select></div>
                <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">첨부파일</label><label className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 text-sm flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><span className="truncate">{newPost.첨부파일 ? newPost.첨부파일 : '클릭하여 파일 업로드'}</span><ImageIcon size={18} className="opacity-50"/><input type="file" className="hidden" onChange={handleFileChange} /></label></div>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">내용 <span className="text-red-500">*</span></label><textarea value={newPost.내용} onChange={(e) => setNewPost({...newPost, 내용: e.target.value})} className="w-full h-40 px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all dark:text-white" placeholder="내용을 입력하세요..." /></div>
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
              <button onClick={() => { setIsWriteModalOpen(false); setIsEditMode(false); }} className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">취소</button>
              <button onClick={handleSave} className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold hover:bg-black dark:hover:bg-indigo-700 shadow-lg shadow-gray-200 dark:shadow-none transition-all">{isEditMode ? '수정하기' : '등록하기'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}