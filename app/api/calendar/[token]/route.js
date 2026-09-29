import { getAdminClient } from '@/lib/supabase-admin'
import { WORKSPACE_ID } from '@/lib/nexus-server'
import { appUrl } from '@/lib/google-chat'
import { buildIcs } from '@/lib/ics.mjs'

// 구글 캘린더가 주기적으로 가져가는 개인 일정 피드 (로그인 없이 비밀 주소로 접근).
// 내 미완료 업무 마감일 + 내 근태 일정만 담는다.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ATTENDANCE = { annual_leave: '연차', am_half: '오전 반차', pm_half: '오후 반차', quarter_day: '반반차', vacation: '휴가', business_trip: '출장', outside_work: '외근', holiday_work: '휴일근무' }
const notFound = () => new Response('Not found', { status: 404 })

export async function GET(request, { params }) {
  const token = String(params.token || '').replace(/\.ics$/i, '')
  if (!UUID.test(token)) return notFound()
  const admin = getAdminClient()
  if (!admin) return new Response('Server not configured', { status: 500 })

  const { data: owner } = await admin.from('member_calendar_tokens').select('member_id').eq('token', token).maybeSingle()
  if (!owner) return notFound()
  const { data: member } = await admin.from('members').select('id,name,approved,status').eq('id', owner.member_id).maybeSingle()
  if (!member?.approved || member.status === 'pending') return notFound()

  const [tasks, attendance] = await Promise.all([
    admin.from('tasks').select('id,title,status,due_date,content,closing_run_id').eq('workspace_id', WORKSPACE_ID)
      .eq('assignee_member_id', member.id).is('deleted_at', null).neq('status', '완료').not('due_date', 'is', null).neq('due_date', '')
      .order('due_date').limit(500),
    admin.from('attendance_events').select('id,event_type,start_date,end_date,note,status').eq('member_id', member.id)
      .neq('status', 'cancelled').order('start_date', { ascending: false }).limit(300),
  ])
  if (tasks.error || attendance.error) return new Response('Temporary error', { status: 503 })

  const base = appUrl() || new URL(request.url).origin
  const events = [
    ...tasks.data.map(task => ({
      uid: `task-${task.id}@harim-nexus`, date: task.due_date,
      title: `${task.closing_run_id ? '[월마감] ' : '[마감] '}${task.title || ''}`,
      description: `${task.status}${task.content ? `\n${task.content.slice(0, 500)}` : ''}`,
      url: `${base}/kanban?task=${task.id}`,
    })),
    ...attendance.data.map(event => ({
      uid: `attendance-${event.id}@harim-nexus`, date: event.start_date, endDate: event.end_date,
      title: `${ATTENDANCE[event.event_type] || '근태'}${event.status === 'requested' ? ' (요청)' : ''}`,
      description: event.note || '',
    })),
  ]
  return new Response(buildIcs(events, { name: `Nexus · ${member.name}` }), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="nexus.ics"',
      'Cache-Control': 'private, max-age=900',
      'X-Robots-Tag': 'noindex',
    },
  })
}
