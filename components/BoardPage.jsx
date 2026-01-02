'use client'
import { useState } from 'react'
import toast from 'react-hot-toast' // 알림용
import { X, Image as ImageIcon, Search } from 'lucide-react'

export default function BoardPage({ posts, currentUser, onRefresh }) {
  const [filter, setFilter] = useState('전체')
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)
  
  // ✅ [추가] 새 글 작성을 위한 상태
  const [newPost, setNewPost] = useState({
    제목: '',
    태그: '일반',
    내용: '',
    첨부파일: null
  })

  // 필터링 로직
  const filteredPosts = posts?.filter(post => {
    if (filter === '전체') return true
    return post.태그 === filter
  }) || []

  // 태그별 스타일
  const getTagStyle = (tag) => {
    switch (tag) {
      case '긴급': return 'bg-red-100 text-red-600 border-red-200'
      case '공지': return 'bg-blue-100 text-blue-600 border-blue-200'
      case '이슈': return 'bg-orange-100 text-orange-600 border-orange-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  // ✅ [추가] 이미지 업로드 시뮬레이션
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // 실제로는 여기서 Supabase Storage에 업로드하고 URL을 받아옴
      toast.success(`'${file.name}' 파일이 선택되었습니다.`)
      setNewPost({ ...newPost, 첨부파일: file.name })
    }
  }

  // ✅ [추가] 게시글 저장 핸들러 (유효성 검사 & 데이터 구조화)
  const handleSave = () => {
    // 1. 유효성 검사 (Validation)
    if (!newPost.제목.trim()) {
      toast.error('제목을 입력해주세요!')
      return
    }
    if (!newPost.내용.trim()) {
      toast.error('내용을 입력해주세요!')
      return
    }

    // 2. 데이터 구조 생성 (DB 연동 대비)
    const postData = {
      ...newPost,
      작성자명: currentUser?.이름 || '익명',
      작성자ID: currentUser?.ID || 'guest', // FK 역할
      날짜: new Date().toISOString().split('T')[0], // 오늘 날짜
      조회수: 0,
      댓글: 0
    }

    console.log('저장될 데이터:', postData)
    toast.success('게시글이 등록되었습니다! (DB 연동 시 저장됨)')
    
    // 초기화 및 닫기
    setNewPost({ 제목: '', 태그: '일반', 내용: '', 첨부파일: null })
    setIsWriteModalOpen(false)
    if (onRefresh) onRefresh()
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">게시판 & 이슈 💬</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">팀 내 주요 소식과 긴급 이슈를 공유하세요.</p>
        </div>
        
        <button 
          onClick={() => setIsWriteModalOpen(true)}
          className="btn-primary"
        >
          <span>✏️</span> 글쓰기
        </button>
      </div>

      {/* 2. 상단: 긴급/공지 하이라이트 (데이터가 있을 때만 표시) */}
      {posts?.some(p => p.태그 === '긴급' || p.태그 === '공지') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {posts.filter(p => p.태그 === '긴급' || p.태그 === '공지').slice(0, 3).map((post, i) => (
            <div key={i} className="card-base p-6 flex flex-col justify-between group cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 transition-colors">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getTagStyle(post.태그)}`}>
                    {post.태그}
                  </span>
                  <span className="text-xs text-gray-400">{post.날짜}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {post.제목}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {post.내용}
                </p>
              </div>
              
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold dark:text-white">
                    {post.작성자명[0]}
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{post.작성자명}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>👁️ {post.조회수}</span>
                  <span>💬 {post.댓글}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. 하단: 게시글 리스트 */}
      <div className="card-base p-6 min-h-[500px]">
        {/* 탭 필터 */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {['전체', '공지', '이슈', '일반', '자료'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                filter === tab 
                  ? 'bg-slate-800 text-white shadow-md dark:bg-slate-200 dark:text-slate-900' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 리스트 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-400 uppercase tracking-wider">
                <th className="py-3 pl-4 font-medium w-20">태그</th>
                <th className="py-3 font-medium">제목</th>
                <th className="py-3 font-medium w-32">작성자</th>
                <th className="py-3 font-medium w-32">날짜</th>
                <th className="py-3 font-medium w-24 text-center">조회/댓글</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPosts.map((post, i) => (
                <tr key={i} className="group border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <td className="py-4 pl-4">
                    <span className={`inline-block px-2 py-1 rounded text-[11px] font-bold border ${getTagStyle(post.태그)}`}>
                      {post.태그}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className="font-medium text-gray-900 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block truncate max-w-lg">
                      {post.제목}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300 font-bold">
                        {post.작성자명[0]}
                      </div>
                      <span className="text-gray-600 dark:text-gray-400">{post.작성자명}</span>
                    </div>
                  </td>
                  <td className="py-4 text-gray-500 dark:text-gray-500 text-xs">
                    {post.날짜}
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs text-gray-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {post.댓글}
                    </span>
                  </td>
                </tr>
              ))}
              
              {/* ✅ [추가] 빈 상태 (Empty State) UI */}
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Search size={40} className="mb-4 opacity-20" />
                      <p className="text-sm font-medium">등록된 게시글이 없습니다.</p>
                      <p className="text-xs mt-1 opacity-70">첫 번째 글을 작성해보세요!</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ [업데이트] 글쓰기 모달 (Validation 적용) */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative">
            <button 
              onClick={() => setIsWriteModalOpen(false)} 
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">새 게시글 작성</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">제목 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newPost.제목}
                  onChange={(e) => setNewPost({...newPost, 제목: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all dark:text-white" 
                  placeholder="제목을 입력하세요" 
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">카테고리</label>
                  <select 
                    value={newPost.태그}
                    onChange={(e) => setNewPost({...newPost, 태그: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-transparent focus:border-indigo-500 outline-none dark:text-white appearance-none"
                  >
                    <option>일반</option>
                    <option>이슈</option>
                    <option>공지</option>
                    <option>긴급</option>
                    <option>자료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">첨부파일</label>
                  <label className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 text-sm flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <span className="truncate">{newPost.첨부파일 ? newPost.첨부파일 : '클릭하여 파일 업로드'}</span>
                    <ImageIcon size={18} className="opacity-50"/>
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">내용 <span className="text-red-500">*</span></label>
                <textarea 
                  value={newPost.내용}
                  onChange={(e) => setNewPost({...newPost, 내용: e.target.value})}
                  className="w-full h-40 px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none transition-all dark:text-white" 
                  placeholder="내용을 입력하세요..." 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
              <button 
                onClick={() => setIsWriteModalOpen(false)}
                className="px-6 py-3 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold hover:bg-black dark:hover:bg-indigo-700 shadow-lg shadow-gray-200 dark:shadow-none transition-all"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}