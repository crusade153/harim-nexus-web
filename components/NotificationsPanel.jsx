'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Bell, CalendarClock, CheckCircle2, MessageSquare, UserPlus } from 'lucide-react'
import { markAllNotificationsRead, markNotificationRead } from '@/lib/work-os'
import { entityUrl } from '@/lib/links'
import { countByFilter, FILTERS, kindMeta, matchesFilter, relativeTime, safeInternalUrl } from '@/lib/notification-utils.mjs'

const ICONS = { assignment: UserPlus, talk: MessageSquare, due: CalendarClock, status: CheckCircle2, system: Bell }
const TONES = {
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
}

export default function NotificationsPanel({ notifications, onReload }) {
  const router = useRouter()
  const [filter, setFilter] = useState('all')
  const counts = useMemo(() => countByFilter(notifications), [notifications])
  const visible = notifications.filter(item => matchesFilter(item, filter))
  const unread = counts.unread

  const readAll = async () => {
    try { await markAllNotificationsRead(); toast.success('모든 알림을 확인했습니다.'); onReload() } catch (error) { toast.error(error.message) }
  }
  const open = async item => {
    try {
      if (!item.read_at) await markNotificationRead(item.id)
      const target = safeInternalUrl(item.action_url) || (item.entity_type && item.entity_id ? entityUrl(item.entity_type, item.entity_id) : null)
      if (target) router.push(target)
      else onReload()
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">알림함</h2><p className="mt-1 text-sm text-slate-500">배정·댓글·마감·완료 소식을 종류별로 골라 볼 수 있습니다. 최근 {notifications.length}건까지 보여 줍니다.</p></div>
        <button onClick={readAll} disabled={!unread} className="btn-secondary text-sm disabled:opacity-40">모두 읽음{unread ? ` (${unread})` : ''}</button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="알림 종류">
        {FILTERS.map(item => (
          <button key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${filter === item.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300'}`}>
            {item.label}<span className={`ml-1.5 ${filter === item.id ? 'text-indigo-100' : 'text-slate-400'}`}>{counts[item.id]}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {visible.length === 0
          ? <div className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-800/40"><CheckCircle2 className="mb-2 text-slate-300" size={24} />{notifications.length === 0 ? '받은 알림이 없습니다.' : filter === 'unread' ? '확인하지 않은 알림이 없습니다.' : '이 종류의 알림이 없습니다.'}</div>
          : visible.map(item => {
            const meta = kindMeta(item.kind)
            const Icon = ICONS[meta.icon]
            return (
              <button key={item.id} onClick={() => open(item)} className={`w-full rounded-2xl border p-4 text-left transition hover:border-indigo-300 ${item.read_at ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/20'}`}>
                <div className="flex gap-3">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONES[meta.tone]}`} title={meta.label}><Icon size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <strong className="text-sm text-slate-800 dark:text-white">{!item.read_at && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-indigo-500 align-middle" aria-label="미확인" />}{item.title}</strong>
                      <span className="shrink-0 text-xs text-slate-400" title={new Date(item.created_at).toLocaleString('ko-KR')}>{relativeTime(item.created_at)}</span>
                    </div>
                    {item.body && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-500">{item.body}</p>}
                    <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">{meta.label}</span>
                  </div>
                </div>
              </button>
            )
          })}
      </div>
    </div>
  )
}
