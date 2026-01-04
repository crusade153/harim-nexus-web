'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const systemEmail = `${loginId}@harim-nexus.com`

      const { data, error } = await supabase.auth.signInWithPassword({
        email: systemEmail,
        password: password,
      })

      if (error) throw error

      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_id', data.user.id)
        .single()

      if (memberError || !member) {
        toast.error('회원 정보를 찾을 수 없습니다.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      // 1. 승인 대기 상태 확인 ('pending'이면 로그인 차단)
      if (member.status === 'pending') {
        toast.error('관리자 승인 대기 중입니다.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      toast.success(`${member.name}님 환영합니다!`)
      
      // ✅ 2. 로그인 시 상태를 무조건 '온라인'으로 초기화
      // (텍스트 메시지는 건드리지 않으므로 그대로 유지됩니다)
      await supabase.from('members').update({ status: '온라인' }).eq('id', member.id)
      
      router.push('/dashboard')

    } catch (error) {
      console.error(error)
      toast.error('로그인 실패: ID 또는 비밀번호를 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Nexus Workspace</h1>
          <p className="text-slate-500 dark:text-slate-400">아이디로 로그인하세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">아이디 (ID)</label>
            <input 
              type="text" 
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              placeholder="예: hong123"
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">비밀번호</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              placeholder="••••••••"
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="text-indigo-600 font-bold hover:underline">
            회원가입 신청
          </Link>
        </div>
      </div>
    </div>
  )
}