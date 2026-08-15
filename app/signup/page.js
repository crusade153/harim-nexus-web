import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">관리자 초대 방식으로 변경되었습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          계정과 회원 정보가 서로 분리되지 않도록 관리자가 팀원 관리 화면에서 로그인 아이디와 초기 비밀번호를 함께 발급합니다.
        </p>
        <Link href="/login" className="btn-primary mt-7 inline-flex w-full justify-center py-3">
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
