'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarPlus, Copy, RefreshCw } from 'lucide-react'
import { nexusApi } from '@/lib/nexus-api'

// 내 업무 마감·근태를 구글 캘린더에 "URL로 추가"하는 개인 구독 주소
export default function CalendarSubscription() {
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    nexusApi('/api/calendar/token').then(result => setUrl(result.url)).catch(() => setUrl(null))
  }, [])

  const issue = async () => {
    if (url && !confirm('새 주소를 만들면 예전 주소로 구독한 캘린더는 더 이상 갱신되지 않습니다. 계속할까요?')) return
    setBusy(true)
    try { setUrl((await nexusApi('/api/calendar/token', {})).url); toast.success('구독 주소를 만들었습니다.') }
    catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }
  const copy = async () => {
    await navigator.clipboard?.writeText(url)
    toast.success('주소를 복사했습니다. 구글 캘린더 > 다른 캘린더 + > URL로 추가 에 붙여 넣으세요.')
  }

  return (
    <div className="space-y-2 border-t border-dashed border-slate-200 pt-5 dark:border-slate-700">
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500">
        <CalendarPlus size={13} className="text-indigo-500" /> 구글 캘린더 구독
      </label>
      <p className="text-[11px] leading-relaxed text-slate-400">내 업무 마감일·월마감·근태가 구글 캘린더에 표시됩니다. 주소를 아는 사람은 누구나 볼 수 있으니 공유하지 마세요. 구글이 몇 시간마다 갱신합니다.</p>
      {url && (
        <div className="flex gap-2">
          <input readOnly value={url} onFocus={e => e.target.select()} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" aria-label="캘린더 구독 주소" />
          <button onClick={copy} className="rounded-xl border border-slate-200 px-3 text-slate-500 hover:text-indigo-600 dark:border-slate-700" title="복사"><Copy size={15} /></button>
        </div>
      )}
      <button onClick={issue} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 py-2.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10">
        {url ? <><RefreshCw size={15} /> 새 주소로 바꾸기</> : <><CalendarPlus size={15} /> 구독 주소 만들기</>}
      </button>
    </div>
  )
}
