'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    loginId: '',
    password: '',
    name: '',
    companyEmail: '',
    department: '',
    position: '매니저', // ✅ 기본값 변경: 사원 -> 매니저
    joinedAt: new Date().toISOString().split('T')[0],
    message: ''
  })

  // 관리자 ID (이 아이디만 자동 승인)
  const ADMIN_ID = 'crusade153'

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. 아이디 중복 체크
      const { data: existingUser } = await supabase
        .from('members')
        .select('login_id')
        .eq('login_id', formData.loginId)
        .single()

      if (existingUser) {
        toast.error('이미 사용 중인 ID입니다.')
        setLoading(false)
        return
      }

      // 2. Supabase Auth 가입
      const systemEmail = `${formData.loginId}@harim-nexus.com`

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: systemEmail,
        password: formData.password,
        options: {
          data: { name: formData.name }
        }
      })

      if (authError) throw authError

      // 3. DB 저장
      const initialStatus = formData.loginId === ADMIN_ID ? 'active' : 'pending' 
      const initialApproved = formData.loginId === ADMIN_ID ? true : false

      const { error: dbError } = await supabase.from('members').insert([{
        auth_id: authData.user.id,
        login_id: formData.loginId,
        email: formData.companyEmail,
        name: formData.name,
        department: formData.department,
        position: formData.position,
        joined_at: formData.joinedAt,
        status: initialStatus, 
        approved: initialApproved,
        message: formData.message || '반갑습니다!' 
      }])

      if (dbError) throw dbError

      if (initialStatus === 'active') {
        toast.success(`관리자(${formData.loginId}) 계정 생성 완료!`)
        router.push('/login')
      } else {
        toast.success('가입 신청 완료! 관리자 승인 후 로그인 가능합니다.')
        router.push('/login')
      }

    } catch (error) {
      console.error(error)
      toast.error('가입 실패: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">팀원 합류 신청</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">아이디와 정보를 입력해주세요.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">희망 ID <span className="text-red-500">*</span></label>
                <input type="text" required className="input-field" placeholder="예: hong123"
                value={formData.loginId} onChange={e => setFormData({...formData, loginId: e.target.value})} />
            </div>
            <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">비밀번호 <span className="text-red-500">*</span></label>
                <input type="password" required className="input-field" placeholder="6자 이상" minLength={6}
                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-700 my-4"></div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">이름</label>
            <input type="text" required className="input-field" placeholder="본명 (예: 홍길동)"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">회사 이메일</label>
            <input type="email" required className="input-field" placeholder="name@company.com"
              value={formData.companyEmail} onChange={e => setFormData({...formData, companyEmail: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">담당 업무</label>
              <input type="text" required className="input-field" placeholder="예: 기획/개발"
                value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">입사일</label>
              <input type="date" required className="input-field"
                value={formData.joinedAt} onChange={e => setFormData({...formData, joinedAt: e.target.value})} />
            </div>
          </div>

          {/* 가입 인사말 입력 필드 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">가입 인사말</label>
            <textarea 
              className="input-field h-20 resize-none" 
              placeholder="자유롭게 인사말을 남겨주세요 (예: 잘 부탁드립니다!)"
              value={formData.message} 
              onChange={e => setFormData({...formData, message: e.target.value})} 
            />
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 mt-4 text-base">
            {loading ? '처리 중...' : '가입 신청하기'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          이미 계정이 있으신가요? <Link href="/login" className="text-indigo-500 font-bold hover:underline">로그인</Link>
        </p>
      </div>
      
      <style jsx>{`
        .input-field {
          @apply w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white transition-all text-sm;
        }
      `}</style>
    </div>
  )
}