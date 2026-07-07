'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getSystemEmail, validateLoginId } from '@/lib/auth-id'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    loginId: '',
    password: '',
    name: '',
    companyEmail: '',
    department: '',
    position: '매니저',
    joinedAt: new Date().toISOString().split('T')[0],
    message: '',
  })

  const ADMIN_ID = 'crusade153'

  const handleSignup = async (e) => {
    e.preventDefault()

    const loginValidation = validateLoginId(formData.loginId)
    if (!loginValidation.ok) {
      toast.error(loginValidation.message)
      return
    }

    const loginId = loginValidation.loginId
    const name = formData.name.trim()
    const companyEmail = formData.companyEmail.trim()
    const department = formData.department.trim()
    const message = formData.message.trim()

    setLoading(true)

    try {
      const { data: existingUser, error: existingError } = await supabase
        .from('members')
        .select('login_id')
        .eq('login_id', loginId)
        .maybeSingle()

      if (existingError) throw existingError

      if (existingUser) {
        toast.error('이미 사용 중인 아이디입니다.')
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: getSystemEmail(loginId),
        password: formData.password,
        options: {
          data: { name },
        },
      })

      if (authError) throw authError
      if (!authData?.user?.id) {
        throw new Error('인증 계정이 생성되지 않았습니다. Supabase Auth 설정을 확인하세요.')
      }

      const isAdmin = loginId === ADMIN_ID
      const { error: dbError } = await supabase.from('members').insert([
        {
          auth_id: authData.user.id,
          login_id: loginId,
          email: companyEmail,
          name,
          department,
          position: formData.position,
          joined_at: formData.joinedAt,
          status: isAdmin ? 'active' : 'pending',
          approved: isAdmin,
          message: message || '반갑습니다.',
        },
      ])

      if (dbError) throw dbError

      toast.success(isAdmin ? `관리자(${loginId}) 계정 생성 완료!` : '가입 신청 완료! 관리자 승인 후 로그인 가능합니다.')
      router.push('/login')
    } catch (error) {
      console.error(error)
      toast.error(`가입 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">회원가입 신청</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">아이디와 기본 정보를 입력하세요.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                로그인 ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="예: hong123"
                autoComplete="username"
                value={formData.loginId}
                onChange={(e) => updateField('loginId', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                className="input-field"
                placeholder="6자 이상"
                minLength={6}
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-700 my-4" />

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">이름</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="이름"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">회사 이메일</label>
            <input
              type="email"
              required
              className="input-field"
              placeholder="name@company.com"
              autoComplete="email"
              value={formData.companyEmail}
              onChange={(e) => updateField('companyEmail', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">담당 업무</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="예: 기획/개발"
                value={formData.department}
                onChange={(e) => updateField('department', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">입사일</label>
              <input
                type="date"
                required
                className="input-field"
                value={formData.joinedAt}
                onChange={(e) => updateField('joinedAt', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">가입 인사말</label>
            <textarea
              className="input-field h-20 resize-none"
              placeholder="자유롭게 인사말을 남겨주세요."
              value={formData.message}
              onChange={(e) => updateField('message', e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} className="w-full btn-primary py-3 mt-4 text-base">
            {loading ? '처리 중...' : '가입 신청하기'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-indigo-500 font-bold hover:underline">
            로그인
          </Link>
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
