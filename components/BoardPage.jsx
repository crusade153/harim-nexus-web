'use client'
import { useState } from 'react'

export default function BoardPage({ posts, onRefresh }) {
  const [filter, setFilter] = useState('전체')
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)

  // 필터링 로직
  const filteredPosts = posts?.filter(post => {
    if (filter === '전체') return true
    return post.태그 === filter
  }) || []

  // 태그별 스타일 매핑
  const getTagStyle = (tag) => {
    switch (tag) {
      case '긴급': return 'bg-red-100 text-red-600 border-red-200'
      case '공지': return 'bg-blue-100 text-blue-600 border-blue-200'
      case '이슈': return 'bg-orange-100 text-orange-600 border-orange-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      
      {/* 1. 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">게시판 & 이슈 💬</h1>
          <p className="text-gray-500 text-sm mt-1">팀 내 주요 소식과 긴급 이슈를 공유하세요.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="게시글 검색..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-[#d9f99d] focus:border-transparent outline-none w-64 shadow-sm"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
          <button 
            onClick={() => setIsWriteModalOpen(true)}
            className="px-5 py-2.5 bg-[#d9f99d] hover:bg-[#bef264] text-[#1e1e24] font-bold rounded-full text-sm shadow-sm transition-colors flex items-center gap-2"
          >
            <span>✏️</span> 글쓰기
          </button>
        </div>
      </div>

      {/* 2. 상단: 긴급/공지 하이라이트 (Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {posts?.filter(p => p.태그 === '긴급' || p.태그 === '공지').slice(0, 3).map((post, i) => (
          <div key={i} className="bento-card p-6 flex flex-col justify-between group cursor-pointer hover:border-blue-300">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getTagStyle(post.태그)}`}>
                  {post.태그}
                </span>
                <span className="text-xs text-gray-400">{post.날짜}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                {post.제목}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2">
                {post.내용}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">
                  {post.작성자명[0]}
                </div>
                <span className="text-xs text-gray-600 font-medium">{post.작성자명}</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-400">
                <span>👁️ {post.조회수}</span>
                <span>💬 {post.댓글}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. 하단: 게시글 리스트 */}
      <div className="bento-card p-6 min-h-[500px]">
        {/* 탭 필터 */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {['전체', '공지', '이슈', '일반', '자료'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                filter === tab 
                  ? 'bg-[#1e1e24] text-white shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
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
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                <th className="py-3 pl-4 font-medium w-20">태그</th>
                <th className="py-3 font-medium">제목</th>
                <th className="py-3 font-medium w-32">작성자</th>
                <th className="py-3 font-medium w-32">날짜</th>
                <th className="py-3 font-medium w-24 text-center">조회/댓글</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredPosts.map((post, i) => (
                <tr key={i} className="group border-b border-gray-50 hover:bg-gray-50/80 transition-colors cursor-pointer">
                  <td className="py-4 pl-4">
                    <span className={`inline-block px-2 py-1 rounded text-[11px] font-bold border ${getTagStyle(post.태그)}`}>
                      {post.태그}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors block truncate max-w-lg">
                      {post.제목}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-600 font-bold">
                        {post.작성자명[0]}
                      </div>
                      <span className="text-gray-600">{post.작성자명}</span>
                    </div>
                  </td>
                  <td className="py-4 text-gray-500 text-xs">
                    {post.날짜}
                  </td>
                  <td className="py-4 text-center">
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                      {post.댓글}
                    </span>
                  </td>
                </tr>
              ))}
              
              {filteredPosts.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    게시글이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 글쓰기 모달 (UI만 구현) */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-fadeIn">
            <h2 className="text-2xl font-bold mb-6">새 게시글 작성</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">제목</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none" placeholder="제목을 입력하세요" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">카테고리</label>
                  <select className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>일반</option>
                    <option>이슈</option>
                    <option>공지</option>
                    <option>긴급</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">첨부파일</label>
                  <div className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm flex items-center gap-2 cursor-pointer hover:bg-gray-100">
                    📎 파일 선택
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">내용</label>
                <textarea className="w-full h-40 px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="내용을 입력하세요..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setIsWriteModalOpen(false)}
                className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  alert('작성 기능은 준비 중입니다!')
                  setIsWriteModalOpen(false)
                }}
                className="px-6 py-3 rounded-xl bg-[#1e1e24] text-white font-bold hover:bg-black shadow-lg"
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