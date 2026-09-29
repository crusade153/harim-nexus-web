'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarDays, ClipboardList, HeartHandshake, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) router.replace('/dashboard') })
  }, [router])

  return <div className="nexus-landing min-h-screen text-[#263a36]">
    <header className="nexus-landing-header sticky top-0 z-30 border-b border-[#dbe8df]/80 bg-[#fffdf7]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight sm:gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#377d6e] text-lg text-white shadow-sm">N</span><span className="text-base leading-tight sm:text-lg">Harim<br className="sm:hidden" /> Nexus</span></Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2"><Link href="/guide" className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-xs font-semibold hover:bg-[#e8f2e9] sm:px-4 sm:text-sm">사용 설명서</Link><Link href="/login" className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-xs font-semibold hover:bg-[#e8f2e9] sm:px-4 sm:text-sm">로그인</Link><Link href="/signup" className="shrink-0 whitespace-nowrap rounded-full bg-[#2f6d60] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#24584e] sm:px-4 sm:text-sm">팀 합류하기</Link></nav>
      </div>
    </header>

    <main>
      <section className="nexus-hero relative isolate mx-auto mt-6 flex min-h-[610px] max-w-[1440px] items-center overflow-hidden rounded-[2rem] border border-[#eee3d1] shadow-[0_24px_80px_rgba(84,94,74,.1)] sm:mt-8 sm:rounded-[3rem]">
        <div className="nexus-hero-art absolute inset-0" aria-hidden="true" />
        <div className="nexus-hero-wash absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 max-w-[670px] px-7 py-16 sm:px-14 lg:px-20">
          <p className="nexus-rise inline-flex items-center gap-2 rounded-full border border-[#bdd8c6] bg-white/70 px-4 py-2 text-xs font-bold tracking-wide text-[#2f6d60] backdrop-blur"><Sparkles size={14} /> HARIM NEXUS · 원가팀</p>
          <h1 className="nexus-rise nexus-delay-1 mt-7 text-[clamp(2.5rem,4.4vw,4.5rem)] font-extrabold leading-[1.16] tracking-[-.055em]">원가팀 업무,<br /><span className="text-[#397969]">한곳에서.</span></h1>
          <p className="nexus-rise nexus-delay-2 mt-6 max-w-lg text-base leading-8 text-[#53665e] sm:text-lg">업무 기록·팀 일정·주간보고·자료를 한곳에서 확인하고 관리.</p>
          <div className="nexus-rise nexus-delay-3 mt-9 flex flex-wrap gap-3"><Link href="/login" className="inline-flex items-center gap-2 rounded-2xl bg-[#2f6d60] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2f6d60]/20 transition hover:-translate-y-0.5 hover:bg-[#24584e]">업무공간 열기 <ArrowRight size={17} /></Link><Link href="/signup" className="inline-flex items-center rounded-2xl border border-[#b4cbbb] bg-white/80 px-6 py-3.5 text-sm font-bold text-[#2f6d60] transition hover:-translate-y-0.5 hover:bg-white">팀원 가입</Link></div>
          <p className="mt-6 text-xs text-[#728276]">원가팀 업무 관리 · Harim Nexus</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:py-24">
        <div className="mb-9"><p className="text-xs font-bold tracking-[.2em] text-[#3d806d]">WORKSPACE</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">필요한 기능 한곳에</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[{ icon: ClipboardList, title: '내 업무 기록', text: '일일 업무 작성과 주간보고 초안 반영.' }, { icon: CalendarDays, title: '팀 일정·WBS', text: '업무 일정과 마감일 통합 확인.' }, { icon: HeartHandshake, title: '이슈 공유', text: '문제·영향·지원 요청 기록과 공유.' }].map(({ icon: Icon, title, text }) => <article key={title} className="nexus-feature rounded-[1.6rem] border border-[#dfeadf] bg-white/85 p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><span className="mb-5 inline-flex rounded-2xl bg-[#e4f0e8] p-3 text-[#367766]"><Icon size={23} /></span><h3 className="text-lg font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-[#66776c]">{text}</p></article>)}
        </div>
      </section>
    </main>

    <footer className="border-t border-[#dce7db] bg-[#eff4eb]/80"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-[#6e7e71] sm:px-8"><span>Harim Nexus · 원가팀 업무공간</span><Link href="/guide" className="font-bold text-[#367766] hover:underline">사용 설명서</Link></div></footer>
  </div>
}
