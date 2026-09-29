'use client'

import { supabase } from '@/lib/supabase'
import { createTask, DEFAULT_WORKSPACE_ID } from '@/lib/sheets'
import { safeStorageFileName, sanitizeSearchTerm } from '@/lib/work-os-utils.mjs'
import { entityUrl } from '@/lib/links'

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

export async function getWorkHubData() {
  const identity = await getWorkIdentity()
  const isAdmin = ['owner', 'admin'].includes(identity.workspaceRole) || identity.member.role === 'admin'
  const today = new Date().toISOString().slice(0, 10)
  const common = [
    ['myTasks', supabase.from('tasks')
      .select('id,title,status,priority,assignee,due_date,start_date,content,project_id')
      .eq('assignee_member_id', identity.member.id).is('deleted_at', null)
      .neq('status', '완료').order('due_date', { ascending: true }).limit(100)],
    ['notifications', supabase.from('notifications')
      .select('id,kind,title,body,entity_type,entity_id,action_url,read_at,created_at,actor_member_id')
      .eq('recipient_member_id', identity.member.id).order('created_at', { ascending: false }).limit(50)],
    ['templates', supabase.from('task_templates')
      .select('id,name,description,default_priority,default_status,content,recurrence_rule,active,created_at')
      .eq('workspace_id', WORKSPACE_ID).eq('active', true).order('name').limit(100)],
    ['files', supabase.from('workspace_files')
      .select('id,entity_type,entity_id,storage_path,file_name,mime_type,size_bytes,version,created_at,uploaded_by_member_id')
      .eq('workspace_id', WORKSPACE_ID).is('deleted_at', null).order('created_at', { ascending: false }).limit(100)],
    ['savedViews', supabase.from('saved_views')
      .select('id,name,surface,filters,is_default,created_at')
      .eq('workspace_id', WORKSPACE_ID).eq('member_id', identity.member.id).order('name').limit(50)],
    ['goals', supabase.from('goals')
      .select('id,parent_goal_id,owner_member_id,title,description,status,progress,start_date,due_date,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('due_date', { ascending: true }).limit(200)],
    ['goalLinks', supabase.from('goal_links')
      .select('goal_id,entity_type,entity_id,weight').limit(500)]
  ]
  const admin = isAdmin ? [
    ['automations', supabase.from('automation_rules')
      .select('id,name,trigger_type,conditions,action_type,action_config,enabled,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).limit(100)],
    ['automationRuns', supabase.from('automation_runs')
      .select('id,rule_id,status,error_message,started_at,finished_at')
      .eq('workspace_id', WORKSPACE_ID).order('started_at', { ascending: false }).limit(50)],
    ['webhooks', supabase.from('webhook_endpoints')
      .select('id,name,endpoint_url,event_types,enabled,created_at')
      .eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).limit(50)],
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
  const { member } = await getWorkIdentity()
  const row = {
    workspace_id: WORKSPACE_ID,
    name: template.name.trim(),
    description: template.description?.trim() || '',
    default_priority: template.defaultPriority || '보통',
    content: template.content?.trim() || '',
    recurrence_rule: template.recurrenceRule?.trim() || null,
    created_by_member_id: member.id
  }
  const query = template.id
    ? supabase.from('task_templates').update(row).eq('id', template.id)
    : supabase.from('task_templates').insert([row])
  const { error } = await query
  if (error) throw error
}

export async function createTaskFromTemplate(template, dueDate) {
  const { member } = await getWorkIdentity()
  return createTask({
    제목: template.name,
    내용: template.content || template.description || '',
    우선순위: template.default_priority || '보통',
    담당자명: member.name,
    담당자ID: member.id,
    마감일: dueDate,
    시작일: new Date().toISOString().slice(0, 10)
  })
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
  const row = {
    workspace_id: WORKSPACE_ID,
    name: endpoint.name.trim(),
    endpoint_url: endpoint.url.trim(),
    event_types: endpoint.eventTypes || ['manual'],
    enabled: endpoint.enabled !== false,
    created_by_member_id: member.id
  }
  const { error } = await supabase.from('webhook_endpoints').insert([row])
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
