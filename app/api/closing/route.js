import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked, apiError } from '@/lib/nexus-server'
import { loadHolidays, startClosingRun } from '@/lib/closing-server'
import { chatWebhookConfigured, flushChatNotifications, buildBriefText, sendChatMessage } from '@/lib/google-chat'
import { defaultPeriod, defaultRunStart, normalizeHolidays, normalizePlant } from '@/lib/closing-utils.mjs'
import { seoulDate } from '@/lib/weekly-utils.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TASK_COLUMNS = 'id,title,status,due_date,assignee,assignee_member_id,completed_at,closing_item_id'
const bad = message => Object.assign(new Error(message), { status: 400 })
const text = (value, max) => String(value ?? '').trim().slice(0, max)

export async function GET(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    const today = seoulDate()
    const requestedRun = Number(new URL(request.url).searchParams.get('run')) || null
    const [templates, items, runs, members, holidays, settings] = await Promise.all([
      admin.from('closing_templates').select('id,name,description,active,auto_start,updated_at').eq('workspace_id', WORKSPACE_ID).order('name'),
      admin.from('closing_template_items').select('id,template_id,title,description,offset_days,default_assignee_member_id,reference_url,sort_order,plant').order('sort_order').limit(1000),
      admin.from('closing_runs').select('id,template_id,period,start_date,status,created_at,closed_at').eq('workspace_id', WORKSPACE_ID).order('period', { ascending: false }).limit(24),
      admin.from('workspace_members').select('member_id,members(id,name)').eq('workspace_id', WORKSPACE_ID).eq('active', true).neq('role', 'guest'),
      loadHolidays(admin),
      isAdmin ? admin.from('workspace_settings').select('chat_enabled,chat_mention_by_email').eq('workspace_id', WORKSPACE_ID).single() : Promise.resolve({ data: null }),
    ])
    const runList = checked(runs)
    const templateIds = new Set(checked(templates).map(t => t.id))
    const run = runList.find(r => r.id === requestedRun) || runList.find(r => r.status === 'open') || runList[0] || null
    let runTasks = []
    let previousTasks = []
    let previousRun = null
    if (run) {
      previousRun = runList.find(r => r.template_id === run.template_id && r.period < run.period) || null
      const [current, previous] = await Promise.all([
        admin.from('tasks').select(TASK_COLUMNS).eq('closing_run_id', run.id).is('deleted_at', null).order('due_date').limit(300),
        previousRun ? admin.from('tasks').select(TASK_COLUMNS).eq('closing_run_id', previousRun.id).is('deleted_at', null).limit(300) : Promise.resolve({ data: [] }),
      ])
      runTasks = checked(current)
      previousTasks = checked(previous)
    }
    const period = defaultPeriod(today)
    return NextResponse.json({
      today, isAdmin, memberId: member.id,
      templates: checked(templates),
      items: checked(items).filter(item => templateIds.has(item.template_id)),
      runs: runList, run, runTasks, previousRun, previousTasks,
      members: checked(members).map(m => m.members).filter(Boolean),
      holidays,
      defaults: { period, startDate: defaultRunStart(period, holidays) },
      chat: isAdmin ? { configured: chatWebhookConfigured(), ...checked(settings) } : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return NextResponse.json(apiError(error), { status: error.status || 500 }) }
}

async function saveTemplate(admin, member, body) {
  const name = text(body.name, 100)
  if (!name) throw bad('템플릿 이름을 입력해 주세요.')
  if (!Array.isArray(body.items) || body.items.length > 100) throw bad('항목은 100개 이하로 입력해 주세요.')
  const items = body.items.map((item, index) => {
    const title = text(item.title, 200)
    const offset = Number(item.offset_days)
    const url = text(item.reference_url, 1000)
    if (!title) throw bad(`${index + 1}번째 항목 이름을 입력해 주세요.`)
    if (!Number.isInteger(offset) || offset < 0 || offset > 30) throw bad(`${index + 1}번째 항목의 영업일은 0~30 사이여야 합니다.`)
    if (url && !/^https?:\/\//.test(url)) throw bad(`${index + 1}번째 항목의 참고 링크는 http(s):// 로 시작해야 합니다.`)
    return {
      id: Number.isSafeInteger(item.id) ? item.id : null, title, description: text(item.description, 4000),
      offset_days: offset, default_assignee_member_id: Number.isSafeInteger(Number(item.default_assignee_member_id)) && item.default_assignee_member_id ? Number(item.default_assignee_member_id) : null,
      reference_url: url || null, sort_order: index, plant: normalizePlant(item.plant),
    }
  })
  const row = { name, description: text(body.description, 2000), active: body.active !== false, auto_start: body.auto_start === true, updated_at: new Date().toISOString() }
  let templateId = Number.isSafeInteger(body.id) ? body.id : null
  if (templateId) {
    checked(await admin.from('closing_templates').update(row).eq('id', templateId).eq('workspace_id', WORKSPACE_ID).select('id').single())
  } else {
    templateId = checked(await admin.from('closing_templates').insert({ ...row, workspace_id: WORKSPACE_ID, created_by_member_id: member.id }).select('id').single()).id
  }
  const existing = checked(await admin.from('closing_template_items').select('id').eq('template_id', templateId))
  const keep = new Set(items.filter(i => i.id).map(i => i.id))
  const removed = existing.map(i => i.id).filter(id => !keep.has(id))
  if (removed.length) checked(await admin.from('closing_template_items').delete().in('id', removed))
  for (const item of items) {
    const { id, ...values } = item
    if (id && existing.some(e => e.id === id)) checked(await admin.from('closing_template_items').update(values).eq('id', id).eq('template_id', templateId))
    else checked(await admin.from('closing_template_items').insert({ ...values, template_id: templateId }))
  }
  return { templateId }
}

export async function POST(request) {
  try {
    const { admin, member, isAdmin } = await requireNexusMember(request)
    if (!isAdmin) return NextResponse.json({ error: '관리자만 변경할 수 있습니다.' }, { status: 403 })
    const body = await request.json().catch(() => ({}))
    switch (body.action) {
      case 'save_template': {
        const result = await saveTemplate(admin, member, body)
        return NextResponse.json({ saved: true, ...result })
      }
      case 'start_run': {
        const result = await startClosingRun(admin, { templateId: Number(body.template_id), period: body.period, startDate: body.start_date, plants: body.plants, actorId: member.id })
        const chat = await flushChatNotifications(admin).catch(error => ({ error: error.message }))
        return NextResponse.json({ ...result, chat })
      }
      case 'close_run':
      case 'reopen_run': {
        const closing = body.action === 'close_run'
        checked(await admin.from('closing_runs').update({ status: closing ? 'closed' : 'open', closed_at: closing ? new Date().toISOString() : null })
          .eq('id', Number(body.run_id)).eq('workspace_id', WORKSPACE_ID).select('id').single())
        return NextResponse.json({ saved: true })
      }
      case 'save_holidays': {
        if (!Array.isArray(body.holidays) || body.holidays.length > 400) throw bad('공휴일 목록을 확인해 주세요.')
        const holidays = normalizeHolidays(body.holidays)
        checked(await admin.from('workspace_settings').update({ holidays }).eq('workspace_id', WORKSPACE_ID))
        return NextResponse.json({ saved: true, holidays })
      }
      case 'chat_settings': {
        const current = checked(await admin.from('workspace_settings').select('chat_enabled').eq('workspace_id', WORKSPACE_ID).single())
        const enabled = body.enabled === true
        if (enabled && !chatWebhookConfigured()) throw bad('서버에 GOOGLE_CHAT_WEBHOOK_URL 을 먼저 설정해 주세요.')
        checked(await admin.from('workspace_settings').update({
          chat_enabled: enabled,
          chat_mention_by_email: body.mention_by_email === true,
          ...(enabled && !current.chat_enabled ? { chat_enabled_at: new Date().toISOString() } : {}),
        }).eq('workspace_id', WORKSPACE_ID))
        return NextResponse.json({ saved: true })
      }
      case 'chat_test': {
        await sendChatMessage(`✅ Nexus 연결 테스트 — ${member.name}님이 보냈습니다. 이 스페이스로 배정·멘션 알림과 평일 아침 브리핑이 옵니다.`)
        return NextResponse.json({ sent: true })
      }
      case 'chat_brief_now': {
        await sendChatMessage(await buildBriefText(admin))
        return NextResponse.json({ sent: true })
      }
      default:
        throw bad('알 수 없는 요청입니다.')
    }
  } catch (error) {
    if (error.code === '23505') return NextResponse.json({ error: '같은 이름의 템플릿이 이미 있습니다.' }, { status: 409 })
    const status = error.status || (/Google Chat|GOOGLE_CHAT/.test(error.message || '') ? 502 : 500)
    return NextResponse.json(status === 502 ? { error: error.message } : apiError(error), { status })
  }
}
