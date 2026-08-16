import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { lookup } from 'node:dns/promises'
import net from 'node:net'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase()
    return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')
  }
  return true
}

async function assertSafeWebhookUrl(rawUrl) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') throw new Error('웹훅은 HTTPS 주소만 사용할 수 있습니다.')
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('내부 주소는 웹훅으로 사용할 수 없습니다.')
  const addresses = await lookup(host, { all: true })
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) {
    throw new Error('사설 네트워크 주소는 웹훅으로 사용할 수 없습니다.')
  }
  return url
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('서버 자동화 환경 변수가 설정되지 않았습니다.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function matchesConditions(conditions, eventPayload) {
  return Object.entries(conditions || {}).every(([key, expected]) => {
    if (expected === null || expected === '' || expected === undefined) return true
    return String(eventPayload?.[key] ?? '') === String(expected)
  })
}

async function executeRule(admin, member, rule, eventPayload) {
  let runId = null
  try {
    if (!matchesConditions(rule.conditions, eventPayload)) {
      return { ok: true, ruleId: rule.id, skipped: true }
    }

    const started = await admin.from('automation_runs').insert([{
      workspace_id: WORKSPACE_ID,
      rule_id: rule.id,
      status: 'running',
      trigger_payload: { ...eventPayload, actorMemberId: member.id }
    }]).select('id').single()
    if (started.error) throw started.error
    runId = started.data.id

    let result = {}
    if (rule.action_type === 'notify') {
      const recipient = Number(rule.action_config?.recipientMemberId || eventPayload?.assigneeMemberId || member.id)
      const inserted = await admin.from('notifications').insert([{
        workspace_id: WORKSPACE_ID,
        recipient_member_id: recipient,
        actor_member_id: member.id,
        kind: 'automation',
        title: rule.action_config?.title || rule.name,
        body: rule.action_config?.body || '자동화 규칙이 실행되었습니다.'
      }]).select('id').single()
      if (inserted.error) throw inserted.error
      result = { notificationId: inserted.data.id }
    } else if (rule.action_type === 'update_task') {
      const taskId = Number(rule.action_config?.taskId || eventPayload?.taskId)
      const status = String(rule.action_config?.status || '')
      if (!Number.isInteger(taskId) || !['대기', '진행중', '검토', '완료'].includes(status)) {
        throw new Error('업무 ID와 허용된 상태가 필요합니다.')
      }
      const updated = await admin.from('tasks').update({ status }).eq('id', taskId)
        .eq('workspace_id', WORKSPACE_ID).is('deleted_at', null).select('id').single()
      if (updated.error) throw updated.error
      result = { taskId, status }
    } else if (rule.action_type === 'webhook') {
      const endpointId = rule.action_config?.endpointId
      const endpointResult = await admin.from('webhook_endpoints')
        .select('id,endpoint_url,enabled').eq('id', endpointId).eq('workspace_id', WORKSPACE_ID).maybeSingle()
      if (endpointResult.error) throw endpointResult.error
      if (!endpointResult.data?.enabled) throw new Error('활성 웹훅 엔드포인트를 찾을 수 없습니다.')
      const url = await assertSafeWebhookUrl(endpointResult.data.endpoint_url)
      const webhookPayload = {
        event: eventPayload?.event || `automation.${rule.trigger_type}`,
        ruleId: rule.id,
        runId,
        occurredAt: new Date().toISOString(),
        data: eventPayload || {}
      }
      const delivery = await admin.from('webhook_deliveries').insert([{
        workspace_id: WORKSPACE_ID,
        endpoint_id: endpointResult.data.id,
        event_type: webhookPayload.event,
        payload: webhookPayload
      }]).select('id').single()
      if (delivery.error) throw delivery.error

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      let response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Harim-Nexus-Webhook/1.0' },
          body: JSON.stringify(webhookPayload),
          redirect: 'error',
          signal: controller.signal
        })
      } finally {
        clearTimeout(timeout)
      }
      const deliveryStatus = response.ok ? 'success' : 'failed'
      await admin.from('webhook_deliveries').update({
        status: deliveryStatus,
        response_status: response.status,
        attempted_at: new Date().toISOString(),
        error_message: response.ok ? null : `HTTP ${response.status}`
      }).eq('id', delivery.data.id)
      if (!response.ok) throw new Error(`웹훅이 HTTP ${response.status}로 실패했습니다.`)
      result = { deliveryId: delivery.data.id, responseStatus: response.status }
    }

    await admin.from('automation_runs').update({
      status: 'success', result, finished_at: new Date().toISOString()
    }).eq('id', runId)
    return { ok: true, ruleId: rule.id, runId, result }
  } catch (error) {
    if (runId) {
      await admin.from('automation_runs').update({
        status: 'failed', error_message: error.message?.slice(0, 500), finished_at: new Date().toISOString()
      }).eq('id', runId)
    }
    console.error('자동화 실행 실패:', error)
    return { ok: false, ruleId: rule.id, runId, error: error.message || '자동화 실행에 실패했습니다.' }
  }
}

export async function POST(request) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    const admin = getAdminClient()

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return NextResponse.json({ error: '세션이 유효하지 않습니다.' }, { status: 401 })

    const { data: member, error: memberError } = await admin
      .from('members').select('id,role,approved,status').eq('auth_id', userData.user.id).maybeSingle()
    if (memberError) throw memberError
    if (!member?.approved || member.status === 'pending') {
      return NextResponse.json({ error: '승인된 Nexus 구성원만 자동화를 실행할 수 있습니다.' }, { status: 403 })
    }

    const payload = await request.json()
    const ruleId = Number(payload.ruleId)
    let rules = []
    let eventPayload = payload.eventPayload || {}

    if (Number.isInteger(ruleId)) {
      if (member.role !== 'admin') {
        return NextResponse.json({ error: '수동 실행은 워크스페이스 관리자만 사용할 수 있습니다.' }, { status: 403 })
      }
      const result = await admin.from('automation_rules')
        .select('id,workspace_id,name,trigger_type,conditions,action_type,action_config,enabled')
        .eq('id', ruleId).eq('workspace_id', WORKSPACE_ID).maybeSingle()
      if (result.error) throw result.error
      if (!result.data?.enabled) return NextResponse.json({ error: '활성화된 자동화 규칙을 찾을 수 없습니다.' }, { status: 404 })
      rules = [result.data]
      eventPayload = { ...eventPayload, event: 'automation.manual', source: 'manual' }
    } else {
      const triggerType = String(payload.triggerType || '')
      if (!['task_created', 'task_status_changed', 'task_due'].includes(triggerType)) {
        return NextResponse.json({ error: '지원되는 자동화 이벤트가 아닙니다.' }, { status: 400 })
      }
      const result = await admin.from('automation_rules')
        .select('id,workspace_id,name,trigger_type,conditions,action_type,action_config,enabled')
        .eq('workspace_id', WORKSPACE_ID).eq('trigger_type', triggerType).eq('enabled', true).limit(20)
      if (result.error) throw result.error
      rules = result.data || []
      eventPayload = { ...eventPayload, event: `task.${triggerType.replace('task_', '')}`, source: 'application' }
    }

    const results = await Promise.all(rules.map(rule => executeRule(admin, member, rule, eventPayload)))
    const failures = results.filter(result => !result.ok)
    return NextResponse.json({ ok: failures.length === 0, matchedRules: rules.length, results }, { status: failures.length ? 207 : 200 })
  } catch (error) {
    console.error('자동화 요청 실패:', error)
    return NextResponse.json({ error: error.message || '자동화 요청에 실패했습니다.' }, { status: 500 })
  }
}
