import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { WORKSPACE_ID, checked } from '@/lib/nexus-server'
import { loadHolidays, startClosingRun } from '@/lib/closing-server'
import { buildBriefText, chatWebhookConfigured, flushChatNotifications, sendChatMessage } from '@/lib/google-chat'
import { defaultPeriod, defaultRunStart, isBusinessDay } from '@/lib/closing-utils.mjs'
import { seoulDate } from '@/lib/weekly-utils.mjs'
import { datesSinceLastBusinessDay } from '@/lib/recurrence.mjs'
import { createRecurringTasks, runDueAutomations } from '@/lib/automation-server'

// Vercel Cron 매일 1회 (vercel.json, 08:40 KST).
// 1) DB 가볍게 조회 → 무료 프로젝트 일시정지 방지
// 2) 영업일이면: 자동 시작 월마감 생성 → 반복 템플릿 업무 생성 → 마감 도래 자동화 → 밀린 Chat 알림 전송 → 아침 브리핑(하루 1회)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  const authorized = Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
  if (secret && !authorized) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 가 없습니다.' }, { status: 500 })

  const result = { at: new Date().toISOString() }
  const { count, error } = await admin.from('members').select('id', { count: 'exact', head: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  result.keepalive = { members: count }
  // CRON_SECRET 이 없으면 누구나 부를 수 있으므로 일시정지 방지 조회만 한다.
  if (!authorized) return NextResponse.json({ ...result, note: 'CRON_SECRET 미설정: 월마감·브리핑은 건너뜀' })

  const today = seoulDate()
  const holidays = await loadHolidays(admin)
  if (!isBusinessDay(today, holidays)) return NextResponse.json({ ...result, today, skipped: '휴일' })

  // 자동 시작: 오늘이 "지난달 마감 시작일"이면 auto_start 템플릿마다 한 번 생성
  const period = defaultPeriod(today)
  result.closing = []
  if (defaultRunStart(period, holidays) === today) {
    const templates = checked(await admin.from('closing_templates').select('id,name').eq('workspace_id', WORKSPACE_ID).eq('active', true).eq('auto_start', true))
    for (const template of templates) {
      try {
        const started = await startClosingRun(admin, { templateId: template.id, period, startDate: today, actorId: null })
        result.closing.push({ template: template.name, period, tasks: started.taskCount })
      } catch (error) {
        result.closing.push({ template: template.name, period, error: error.message })
      }
    }
  }

  // 반복 템플릿 → 마감 도래 자동화 순서: 오늘 새로 만든 업무도 마감이 오늘이면 같은 실행에서 처리된다.
  const dates = datesSinceLastBusinessDay(today, holidays)
  result.recurring = await createRecurringTasks(admin, dates, today).catch(error => ({ error: error.message }))
  result.dueAutomations = await runDueAutomations(admin, dates, today).catch(error => ({ error: error.message }))

  if (chatWebhookConfigured()) {
    result.chat = await flushChatNotifications(admin).catch(error => ({ error: error.message }))
    const claimed = checked(await admin.rpc('nexus_claim_daily_brief', { p_workspace: WORKSPACE_ID, p_date: today }))
    if (claimed) {
      try {
        await sendChatMessage(await buildBriefText(admin, today))
        result.brief = 'sent'
      } catch (error) {
        // 실패하면 오늘 다시 보낼 수 있게 표시를 되돌린다
        await admin.from('workspace_settings').update({ chat_last_brief_date: null }).eq('workspace_id', WORKSPACE_ID)
        result.brief = `failed: ${error.message}`
      }
    } else {
      result.brief = 'skipped (꺼짐 또는 오늘 이미 보냄)'
    }
  }
  return NextResponse.json({ ...result, today })
}
