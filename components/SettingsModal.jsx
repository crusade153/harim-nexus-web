'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { updateMyProfile } from '@/lib/sheets'
import { X, Save, Smile } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  
  // 입력 폼 상태
  const [status, setStatus] = useState('온라인')
  const [message, setMessage] = useState('')

  // 모달 열릴 때 내 정보 불러오기
  useEffect(() => {
    if (isOpen) {
      loadMyInfo()
    }
  }, [isOpen])

  const loadMyInfo = async () => {
    // 1. 현재 로그인한 유저 ID 가져오기
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      // 2. DB에서 내 멤버 정보 가져오기
      const { data: member } = await supabase
        .from('members')
        .select('status, message')
        .eq('auth_id', user.id)
        .single()
      
      if (member) {
        setStatus(member.status || '온라인')
        setMessage(member.message || '')
      }
    }
  }

  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    try {
      await updateMyProfile(user.id, status, message)
      toast.success('프로필이 업데이트되었습니다!')
      onClose() // 저장 후 닫기
      window.location.reload() // 변경 사항 반영을 위해 새로고침
    } catch (error) {
      console.error(error)
      toast.error('업데이트 실패')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Smile className="text-indigo-500" size={20}/> 내 상태 설정
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 바디 */}
        <div className="p-6 space-y-6">
          {/* 1. 상태 선택 */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase">현재 상태</label>
            <div className="grid grid-cols-3 gap-2">
              {['온라인', '자리비움', '바쁨'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    status === s 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full inline-block mr-2 ${
                    s === '온라인' ? 'bg-green-400' : s === '자리비움' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 한마디 입력 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">오늘의 한마디</label>
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 오후 미팅 준비 중 ☕️"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all text-sm"
            />
            <p className="text-[10px] text-slate-400 text-right">{message.length}/20자</p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-5 pt-0">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? '저장 중...' : <><Save size={18}/> 설정 저장하기</>}
          </button>
        </div>
      </div>
    </div>
  )
}