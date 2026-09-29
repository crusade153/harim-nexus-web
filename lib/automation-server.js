import { getAdminClient } from '@/lib/supabase-admin'
import { WORKSPACE_ID } from '@/lib/nexus-server'
import { recurrenceMatches } from '@/lib/recurrence.mjs'
import { lookup } from 'node:dns/promises'
import net from 'node:net'


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

export function getRequiredAdminClient() {
  const admin = getAdminClient()
  if (!admin) throw new Error('서버 자동화 환경 변수가 설정되지 않았습니다.')
  return admin
}

function matchesConditions(conditions, eventPayload) {
  return Object.entries(conditions || {}).every(([key, expected]) => {
    if (expected === null || expected === '' || expected === undefined) return true
    return String(eventPayload?.[key] ?? '') === String(expected)
  })
}

export async function executeRule(admin, member, rule, eventPayload) {
  let runId = null
  try {
    if (!matchesConditions(rule.conditions, eventPayload)) {
      return { ok: true, ruleId: rule.id, skipped: true }
    }

    const started = await admin.from('automation_runs').insert([{
      workspace_id: WORKSPACE_ID,
      rule_id: rule.id,
      status: 'running',
      trigger_payload: { ...eventPayload, actorMemberId: member?.id ?? null }
    }]).select('id').single()
    if (started.error) throw started.error
    runId = started.data.id

    let result = {}
    if (rule.action_type === 'notify') {
      const recipient = Number(rule.action_config?.recipientMemberId || eventPayload?.assigneeMemberId || member?.id)
      if (!Number.isInteger(recipient)) throw new Error('알림을 받을 사람이 없습니다. 담당자가 지정된 업무인지 확인해 주세요.')
      const inserted = await admin.from('notifications').insert([{
        workspace_id: WORKSPACE_ID,
        recipient_member_id: recipient,
        actor_member_id: member?.id ?? null,
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

// ------------------------------------------------------------------
// 정기 실행 (일일 크론, 영업일 아침에만 호출)
//   task_due  : 마감일이 오늘(또는 직전 영업일 이후 휴일)인 미완료 업무마다 규칙 실행
//   반복 템플릿: recurrence_rule 이 오늘에 해당하면 업무 1건 생성
// 같은 날 두 번 호출돼도 중복 실행·생성하지 않는다.
// ------------------------------------------------------------------
function ok(result) {
  if (result.error) throw result.error
  return result.data
}

export async function runDueAutomations(admin, dates, today) {
  const rules = ok(await admin.from('automation_rules')
    .select('id,workspace_id,name,trigger_type,conditions,action_type,action_config,enabled')
    .eq('workspace_id', WORKSPACE_ID).eq('trigger_type', 'task_due').eq('enabled', true).limit(20))
  if (!rules.length) return { rules: 0, runs: 0, failed: 0 }

  const tasks = ok(await admin.from('tasks')
    .select('id,title,status,priority,due_date,assignee_member_id')
    .eq('workspace_id', WORKSPACE_ID).in('due_date', dates).neq('status', '완료').is('deleted_at', null).limit(200))

  let runs = 0
  let failed = 0
  for (const rule of rules) {
    for (const task of tasks) {
      const eventPayload = {
        event: 'task.due', source: 'schedule', dueOn: today,
        taskId: task.id, title: task.title, status: task.status, priority: task.priority,
        assigneeMemberId: task.assignee_member_id
      }
      const prior = await admin.from('automation_runs').select('id', { count: 'exact', head: true })
        .eq('rule_id', rule.id).contains('trigger_payload', { event: 'task.due', dueOn: today, taskId: task.id })
      if (prior.error) throw prior.error
      if (prior.count) continue
      const result = await executeRule(admin, null, rule, eventPayload)
      if (result.skipped) continue
      runs += 1
      if (!result.ok) failed += 1
    }
  }
  return { rules: rules.length, runs, failed }
}

export async function createRecurringTasks(admin, dates, today) {
  const templates = ok(await admin.from('task_templates')
    .select('id,name,description,content,default_priority,recurrence_rule,created_by_member_id')
    .eq('workspace_id', WORKSPACE_ID).eq('active', true).not('recurrence_rule', 'is', null))
  const created = []
  const skipped = []
  for (const template of templates) {
    if (!dates.some(date => recurrenceMatches(template.recurrence_rule, date))) continue
    try {
      const existing = ok(await admin.from('tasks').select('id').eq('workspace_id', WORKSPACE_ID)
        .eq('title', template.name).eq('due_date', today).is('deleted_at', null).limit(1))
      if (existing.length) { skipped.push(template.name); continue }
      let assignee = null
      if (template.created_by_member_id) {
        assignee = ok(await admin.from('members').select('id,name').eq('id', template.created_by_member_id).maybeSingle())
      }
      const task = ok(await admin.from('tasks').insert([{
        workspace_id: WORKSPACE_ID,
        title: template.name,
        status: '대기',
        priority: template.default_priority || '보통',
        content: template.content || template.description || '',
        due_date: today,
        start_date: today,
        assignee: assignee?.name || null,
        assignee_member_id: assignee?.id || null,
        created_by_member_id: template.created_by_member_id || null
      }]).select('id').single())
      created.push(template.name)
      // 화면에서 만든 업무와 똑같이 "업무 생성" 자동화 규칙을 실행한다.
      const createdRules = ok(await admin.from('automation_rules')
        .select('id,workspace_id,name,trigger_type,conditions,action_type,action_config,enabled')
        .eq('workspace_id', WORKSPACE_ID).eq('trigger_type', 'task_created').eq('enabled', true).limit(20))
      for (const rule of createdRules) {
        await executeRule(admin, null, rule, {
          event: 'task.created', source: 'schedule', taskId: task.id, title: template.name,
          status: '대기', priority: template.default_priority || '보통', assigneeMemberId: assignee?.id || null
        })
      }
    } catch (error) {
      console.error('반복 업무 생성 실패:', template.name, error)
      skipped.push(`${template.name}: ${error.message}`)
    }
  }
  return { templates: templates.length, created, skipped }
}
