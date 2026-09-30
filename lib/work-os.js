'use client'

import { supabase } from '@/lib/supabase'
import { createTask, DEFAULT_WORKSPACE_ID } from '@/lib/sheets'
import { safeStorageFileName, sanitizeSearchTerm } from '@/lib/work-os-utils.mjs'
import { entityUrl } from '@/lib/links'
import { nexusApi } from '@/lib/nexus-api'
import { parseRecurrence } from '@/lib/recurrence.mjs'
import { seoulDate, weekRange } from '@/lib/weekly-utils.mjs'

const WORKSPACE_ID = DEFAULT_WORKSPACE_ID
const ENTITY_TABLES = ['tasks', 'projects', 'posts', 'archives', 'comments', 'schedules', 'quick_links']

function ensureSuccess(label, response) {
  if (response?.error) throw new Error(`${label}: ${response.error.message}`)
  return response?.data || []
}

export async function getWorkIdentity() {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('로그인이 필요합니다.')
  const { data: member, error } = await supabase
    .from('members')
    .select('id,name,login_id,role,position,department,auth_id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!member) throw new Error('승인된 Nexus 구성원 계정이 아닙니다.')
  const { data: workspaceMember, error: workspaceError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('member_id', member.id)
    .maybeSingle()
  if (workspaceError) throw workspaceError
  return { user, member, workspaceRole: workspaceMember?.role || 'member' }
}

export async function getUnreadNotificationCount() {
  try {
    const { data, error } = await supabase.rpc('nexus_unread_notification_count')
    if (error) throw error
    return Number(data || 0)
  } catch {
    return 0
  }
}

export async function getWorkHubData({ surface = 'work', tab = 'my' } = {}) {
  const identity = await getWorkIdentity()
  const isAdmin = ['owner', 'admin'].includes(identity.workspaceRole) || identity.member.role === 'admin'
  const today = seoulDate()
  if (surface === 'home') {
    const week = weekRange(today)
    const entries = await Promise.all([
      supabase.from('tasks').select('id,title,status,priority,due_date,requested_by_member_id,accepted_at')
        .eq('workspace_id', WORKSPACE_ID).eq('assignee_member_id', identity.member.id).is('deleted_at', null).neq('status', '완료').order('due_date').limit(101),
      supabase.from('notifications').select('id,title,body,entity_type,entity_id,action_url,read_at,created_at')
        .eq('workspace_id', WORKSPACE_ID).eq('recipient_member_id', identity.member.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('weekly_reports').select('id,status,updated_at').eq('workspace_id', WORKSPACE_ID).eq('member_id', identity.member.id).eq('week_start', week.start).maybeSingle(),
      supabase.from('ai_reviews').select('id,status', { count: 'exact', head: true }).eq('workspace_id', WORKSPACE_ID).eq('member_id', identity.member.id).in('status', ['queued','questions','awaiting_confirmation','failed']),
    ])
    entries.forEach((r, i) => ensureSuccess(['내 업무','알림','주간보고','비서몬 검토'][i], r))
    // 팀장 검토 대기 완료 점검 수 (04 SQL 적용 전이면 표시만 생략)
    const pendingChecks = isAdmin ? await supabase.from('task_completion_checks').select('id', { count: 'exact', head: true }).eq('workspace_id', WORKSPACE_ID).eq('status', 'submitted') : null
    return { identity, isAdmin, today, week, myTasks: entries[0].data.slice(0, 100), truncated: entries[0].data.length > 100, notifications: entries[1].data, report: entries[2].data, aiCount: entries[3].count, checkReviewCount: pendingChecks?.error ? null : pendingChecks?.count ?? null }
  }
  const adminSurface = surface === 'automation' || surface === 'governance'
  if (adminSurface && !isAdmin) throw new Error('관리자 권한이 필요합니다.')
  const common = adminSurface ? [] : [
    ['myTasks', supabase.from('tasks')
      .select('id,title,status,priority,assignee,due_date,start_date,content,project_id')
      .eq('assignee_member_id', identity.member.id).is('deleted_at', null)
      .neq('status', '완료').order('due_date', { ascending: true }).limit(100)],
    ['notifications', supabase.from('notifications')
      .select('id,kind,title,body,entity_type,entity_id,action_url,read_at,created_at,actor_member_id')
      .eq('recipient_member_id', identity.member.id).order('created_at', { ascending: false }).limit(50)]
  ]
  if (surface === 'work' && tab === 'templates') common.push(
    ['templates', supabase.from('task_templates')
      .select('id,name,description,default_priority,default_status,content,recurrence_rule,active,assignee_member_ids,due_offset_days,created_by_member_id,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('active', { ascending: false }).order('name').limit(100)],
    ['members', supabase.from('members').select('id,name,status').order('name').limit(500)],
    ['settingsRow', supabase.from('workspace_settings').select('holidays').eq('workspace_id', WORKSPACE_ID).maybeSingle()]
  )
  if (surface === 'work' && tab === 'files') common.push(
    ['files', supabase.from('workspace_files')
      .select('id,entity_type,entity_id,storage_path,file_name,mime_type,size_bytes,version,created_at,uploaded_by_member_id')
      .eq('workspace_id', WORKSPACE_ID).is('deleted_at', null).order('created_at', { ascending: false }).limit(100)]
  )
  if (surface === 'work' && tab === 'portfolio') common.push(
    ['goals', supabase.from('goals')
      .select('id,parent_goal_id,owner_member_id,title,description,status,progress,start_date,due_date,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('due_date', { ascending: true }).limit(200)]
  )
  const admin = surface === 'automation' ? [
    ['automations', supabase.from('automation_rules')
      .select('id,name,trigger_type,conditions,action_type,action_config,enabled,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).limit(100)],
    ['automationRuns', supabase.from('automation_runs')
      .select('id,rule_id,status,error_message,started_at,finished_at')
      .eq('workspace_id', WORKSPACE_ID).order('started_at', { ascending: false }).limit(50)],
    ['webhooks', supabase.from('webhook_endpoints')
      .select('id,name,endpoint_url,enabled,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).limit(50)],
    ['webhookDeliveries', supabase.from('webhook_deliveries')
      .select('id,endpoint_id,event_type,status,response_status,error_message,attempted_at,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).limit(30)],
    ['members', supabase.from('members').select('id,name,status').order('name').limit(500)]
  ] : surface === 'governance' ? [
    ['auditEvents', supabase.from('audit_events')
      .select('id,actor_member_id,entity_type,entity_id,action,changed_fields,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).limit(100)],
    ['settings', supabase.from('workspace_settings')
      .select('workspace_id,require_mfa,allowed_email_domains,session_timeout_minutes,data_retention_days,audit_retention_days,updated_at')
      .eq('workspace_id', WORKSPACE_ID).maybeSingle()]
  ] : []

  const entries = await Promise.all([...common, ...admin].map(async ([key, query]) => [key, await query]))
  const result = { identity, isAdmin, today }
  for (const [key, response] of entries) result[key] = ensureSuccess(key, response)
  if (surface === 'work' && tab === 'templates') {
    result.holidays = (entries.find(([key]) => key === 'settingsRow')?.[1]?.data?.holidays) || []
    delete result.settingsRow
  }
  if (surface === 'work' && tab === 'portfolio') {
    const goalIds = result.goals.map(goal => goal.id)
    result.goalLinks = goalIds.length ? ensureSuccess('goalLinks', await supabase.from('goal_links')
      .select('goal_id,entity_type,entity_id,weight').in('goal_id', goalIds).limit(500)) : []
  }
  return result
}

export async function globalSearch(query) {
  const term = sanitizeSearchTerm(query)
  if (term.length < 2) return []
  const { data, error } = await supabase.rpc('nexus_global_search', { query_text: term, per_type_limit: 10 })
  if (error) throw error
  const labels = { task: '업무', project: '프로젝트', post: '게시글', archive: '아카이브' }
  return (data || []).map(item => ({
    ...item,
    id: item.entity_id,
    type: item.entity_type,
    typeLabel: labels[item.entity_type] || item.entity_type,
    url: entityUrl(item.entity_type, item.entity_id)
  }))
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { member } = await getWorkIdentity()
  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_member_id', member.id).is('read_at', null)
  if (error) throw error
}

export async function uploadWorkspaceFile(file, { entityType = null, entityId = null } = {}) {
  const { member } = await getWorkIdentity()
  const safeName = safeStorageFileName(file.name)
  const path = `${WORKSPACE_ID}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`
  const upload = await supabase.storage.from('nexus-files').upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (upload.error) throw upload.error
  const metadata = await supabase.from('workspace_files').insert([{
    workspace_id: WORKSPACE_ID,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by_member_id: member.id
  }]).select('id').single()
  if (metadata.error) {
    await supabase.storage.from('nexus-files').remove([path])
    throw metadata.error
  }
  return metadata.data
}

export async function getWorkspaceFileUrl(path) {
  const { data, error } = await supabase.storage.from('nexus-files').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteWorkspaceFile(file) {
  const { user } = await getWorkIdentity()
  const { error } = await supabase.from('workspace_files')
    .update({ deleted_at: new Date().toISOString() }).eq('id', file.id)
  if (error) throw error
  return user.id
}

export async function saveTaskTemplate(template) {
  const recurrence = parseRecurrence(template.recurrenceRule)
  if (!recurrence.ok) throw new Error(recurrence.error)
  const name = String(template.name || '').trim()
  if (!name) throw new Error('템플릿 이름을 입력해 주세요.')
  const assigneeIds = [...new Set((template.assigneeIds || []).map(Number).filter(Number.isSafeInteger))]
  if (assigneeIds.length > 20) throw new Error('담당자는 20명까지 지정할 수 있습니다.')
  const offset = Number(template.dueOffsetDays || 0)
  if (!Number.isInteger(offset) || offset < 0 || offset > 30) throw new Error('마감은 0~30영업일 사이로 지정해 주세요.')
  const { member } = await getWorkIdentity()
  const row = {
    workspace_id: WORKSPACE_ID,
    name,
    description: template.description?.trim() || '',
    default_priority: template.defaultPriority || '보통',
    content: template.content?.trim() || '',
    recurrence_rule: template.recurrenceRule?.trim() || null,
    assignee_member_ids: assigneeIds,
    due_offset_days: offset,
    active: template.active !== false,
    updated_at: new Date().toISOString()
  }
  // 수정할 때는 처음 만든 사람(created_by)을 바꾸지 않는다.
  const query = template.id
    ? supabase.from('task_templates').update(row).eq('id', template.id)
    : supabase.from('task_templates').insert([{ ...row, created_by_member_id: member.id }])
  const { error } = await query
  if (error) {
    if (error.code === '23505') throw new Error('같은 이름의 템플릿이 이미 있습니다.')
    throw error
  }
}

export async function setTaskTemplateActive(id, active) {
  const { error } = await supabase.from('task_templates')
    .update({ active: Boolean(active), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteTaskTemplate(id) {
  const { error } = await supabase.from('task_templates').delete().eq('id', id)
  if (error) throw error
}

// 템플릿으로 업무를 만든다. assignees 를 생략하면 누른 사람 한 명, 여러 명이면 사람마다 1건씩 만든다.
export async function createTaskFromTemplate(template, dueDate, assignees = null) {
  const { member } = await getWorkIdentity()
  const targets = assignees?.length ? assignees : [{ id: member.id, name: member.name }]
  const today = seoulDate()
  for (const target of targets) {
    await createTask({
      제목: template.name,
      내용: template.content || template.description || '',
      우선순위: template.default_priority || '보통',
      담당자명: target.name,
      담당자ID: target.id,
      마감일: dueDate,
      시작일: today
    })
  }
  return targets.length
}

export async function saveView(view) {
  const { member } = await getWorkIdentity()
  const { error } = await supabase.from('saved_views').upsert([{
    workspace_id: WORKSPACE_ID,
    member_id: member.id,
    name: view.name,
    surface: view.surface || 'work',
    filters: view.filters || {},
    is_default: Boolean(view.isDefault)
  }], { onConflict: 'workspace_id,member_id,surface,name' })
  if (error) throw error
}

export async function saveGoal(goal) {
  const { member } = await getWorkIdentity()
  const row = {
    workspace_id: WORKSPACE_ID,
    parent_goal_id: goal.parentGoalId || null,
    owner_member_id: goal.ownerMemberId || member.id,
    title: goal.title.trim(),
    description: goal.description?.trim() || '',
    status: goal.status || 'on_track',
    progress: Number(goal.progress || 0),
    start_date: goal.startDate || null,
    due_date: goal.dueDate || null,
    updated_at: new Date().toISOString()
  }
  const query = goal.id ? supabase.from('goals').update(row).eq('id', goal.id) : supabase.from('goals').insert([row])
  const { error } = await query
  if (error) throw error
}

export async function saveAutomation(rule) {
  const { member } = await getWorkIdentity()
  const row = {
    workspace_id: WORKSPACE_ID,
    name: rule.name.trim(),
    trigger_type: rule.triggerType || 'manual',
    conditions: rule.conditions || {},
    action_type: rule.actionType || 'notify',
    action_config: rule.actionConfig || {},
    enabled: rule.enabled !== false,
    created_by_member_id: member.id,
    updated_at: new Date().toISOString()
  }
  const query = rule.id ? supabase.from('automation_rules').update(row).eq('id', rule.id) : supabase.from('automation_rules').insert([row])
  const { error } = await query
  if (error) throw error
}

export async function runAutomation(ruleId) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) throw error || new Error('로그인이 필요합니다.')
  const response = await fetch('/api/automations/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ruleId })
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '자동화 실행에 실패했습니다.')
  return body
}

export async function saveWebhook(endpoint) {
  const { member } = await getWorkIdentity()
  const name = String(endpoint.name || '').trim()
  const url = String(endpoint.url || '').trim()
  if (!name) throw new Error('연동 이름을 입력해 주세요.')
  if (!/^https:\/\//i.test(url)) throw new Error('웹훅 주소는 https:// 로 시작해야 합니다.')
  const row = {
    workspace_id: WORKSPACE_ID,
    name,
    endpoint_url: url,
    event_types: endpoint.eventTypes || ['manual'],
    enabled: endpoint.enabled !== false,
    created_by_member_id: member.id
  }
  const { data, error } = await supabase.from('webhook_endpoints').insert([row]).select('id').single()
  if (error) throw error
  return data
}

export async function setWebhookEnabled(id, enabled) {
  const { error } = await supabase.from('webhook_endpoints')
    .update({ enabled: Boolean(enabled), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteWebhook(id) {
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
  if (error) throw error
}

// 서버가 실제로 전송해 본다. 실패 사유(주소 오타·차단·시간 초과)가 Error 메시지로 온다.
export async function testWebhook(id) {
  return nexusApi('/api/automations/webhook-test', { endpointId: id })
}

export async function setAutomationEnabled(id, enabled) {
  const { error } = await supabase.from('automation_rules')
    .update({ enabled: Boolean(enabled), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteAutomation(id) {
  const { error } = await supabase.from('automation_rules').delete().eq('id', id)
  if (error) throw error
}

export async function getTrash() {
  await getWorkIdentity()
  const responses = await Promise.all(ENTITY_TABLES.slice(0, 6).map(table => supabase
    .from(table).select('id,deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(50)))
  return responses.flatMap((response, index) => ensureSuccess(ENTITY_TABLES[index], response).map(row => ({ ...row, table: ENTITY_TABLES[index] })))
}

export async function restoreTrashItem(table, id) {
  if (!ENTITY_TABLES.includes(table)) throw new Error('복구할 수 없는 대상입니다.')
  const { error } = await supabase.from(table).update({ deleted_at: null, deleted_by: null }).eq('id', id)
  if (error) throw error
}

export async function updateWorkspaceSettings(settings) {
  const { member } = await getWorkIdentity()
  const { error } = await supabase.from('workspace_settings').update({
    require_mfa: Boolean(settings.requireMfa),
    allowed_email_domains: settings.allowedEmailDomains || [],
    session_timeout_minutes: Number(settings.sessionTimeoutMinutes || 480),
    data_retention_days: Number(settings.dataRetentionDays || 3650),
    audit_retention_days: Number(settings.auditRetentionDays || 3650),
    updated_by_member_id: member.id,
    updated_at: new Date().toISOString()
  }).eq('workspace_id', WORKSPACE_ID)
  if (error) throw error
}
