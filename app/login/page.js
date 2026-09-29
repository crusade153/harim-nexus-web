'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getSystemEmail, validateLoginId } from '@/lib/auth-id'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()

    const loginValidation = validateLoginId(loginId)
    if (!loginValidation.ok) {
      toast.error(loginValidation.message)
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: getSystemEmail(loginValidation.loginId),
        password,
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
        return
      }

      if (member.status === 'pending') {
        toast.error('관리자 승인 대기 중입니다.')
        await supabase.auth.signOut()
        return
      }

      toast.success(`${member.name}님 환영합니다.`)
      await supabase.from('members').update({ status: '온라인' }).eq('id', member.id)

      router.push('/dashboard')
    } catch (error) {
      console.error(error)
      toast.error('로그인 실패: 아이디 또는 PIN을 확인하세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nexus-landing min-h-screen flex items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#deeadf] bg-white shadow-[0_24px_80px_rgba(69,93,71,.12)] md:grid-cols-[1fr_1.05fr]">
        <div className="h-44 bg-[url('/nexus-warm-hero.webp')] bg-cover bg-[62%_center] md:min-h-[620px] md:bg-[65%_center]" aria-hidden="true" />
      <div className="w-full p-7 sm:p-10 md:self-center md:p-12">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#397969] text-xl font-bold text-white">N</Link>
          <h1 className="mt-4 text-3xl font-bold text-[#263a36] mb-2">업무공간 로그인</h1>
          <p className="text-[#687c70]">아이디와 PIN 입력</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">아이디(ID)</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              placeholder="예: hong123"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">PIN (숫자 6자리)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              placeholder="••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#397969] hover:bg-[#2d6256] text-white font-bold shadow-lg shadow-[#397969]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          처음이신가요? <Link href="/signup" className="font-bold text-[#397969] hover:underline">팀에 합류하기</Link>
        </div>
        <p className="mt-3 text-center text-sm"><Link href="/guide" className="font-bold text-[#397969] hover:underline">처음 사용하세요? 사용 설명서 보기</Link></p>
        <p className="text-center text-xs text-[#9aa99a]">Harim Nexus · 원가팀 업무공간</p>
      </div>
      </div>
    </div>
  )
}
