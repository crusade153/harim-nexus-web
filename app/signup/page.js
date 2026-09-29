'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { getSystemEmail, isValidPin, PIN_RULE_MESSAGE, validateLoginId } from '@/lib/auth-id'

const inputClass = 'w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ loginId: '', name: '', position: '', pin: '', pinConfirm: '', signupCode: '' })
  const set = key => event => setForm(prev => ({ ...prev, [key]: event.target.value }))

  const handleSignup = async (event) => {
    event.preventDefault()
    const login = validateLoginId(form.loginId)
    if (!login.ok) return toast.error(login.message)
    if (!form.name.trim()) return toast.error('이름을 입력하세요.')
    if (!isValidPin(form.pin)) return toast.error(PIN_RULE_MESSAGE)
    if (form.pin !== form.pinConfirm) return toast.error('PIN 확인이 일치하지 않습니다.')

    setLoading(true)
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId: login.loginId, name: form.name, position: form.position,
          pin: form.pin, signupCode: form.signupCode,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || '가입에 실패했습니다.')

      const { error } = await supabase.auth.signInWithPassword({ email: getSystemEmail(login.loginId), password: form.pin })
      if (error) {
        toast.success('가입되었습니다. 로그인해 주세요.')
        router.push('/login')
        return
      }
      toast.success(`${form.name.trim()}님, 가입을 환영합니다.`)
      router.push('/dashboard')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Nexus 가입</h1>
          <p className="text-slate-500 dark:text-slate-400">아이디와 숫자 6자리 PIN이면 바로 시작합니다.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className={labelClass}>아이디(ID)</label>
            <input value={form.loginId} onChange={set('loginId')} className={inputClass} placeholder="영문 소문자·숫자 3자 이상 (예: hong123)" autoComplete="username" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>이름</label>
              <input value={form.name} onChange={set('name')} className={inputClass} placeholder="홍길동" required />
            </div>
            <div>
              <label className={labelClass}>직위 <span className="font-normal text-slate-400">(선택)</span></label>
              <input value={form.position} onChange={set('position')} className={inputClass} placeholder="매니저" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>PIN (숫자 6자리)</label>
              <input type="password" inputMode="numeric" maxLength={6} value={form.pin} onChange={set('pin')} className={`${inputClass} font-mono tracking-widest`} placeholder="••••••" autoComplete="new-password" required />
            </div>
            <div>
              <label className={labelClass}>PIN 확인</label>
              <input type="password" inputMode="numeric" maxLength={6} value={form.pinConfirm} onChange={set('pinConfirm')} className={`${inputClass} font-mono tracking-widest`} placeholder="••••••" autoComplete="new-password" required />
            </div>
          </div>
          <div>
            <label className={labelClass}>팀 가입코드 <span className="font-normal text-slate-400">(안내받은 경우에만)</span></label>
            <input value={form.signupCode} onChange={set('signupCode')} className={inputClass} placeholder="없으면 비워 두세요" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? '가입 중...' : '가입하고 시작하기'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있나요? <Link href="/login" className="font-bold text-indigo-600 hover:underline">로그인</Link>
        </div>
      </div>
    </div>
  )
}
