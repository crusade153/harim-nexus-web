import { NextResponse } from 'next/server'
import { getRequiredAdminClient, executeRule } from '@/lib/automation-server'
import { WORKSPACE_ID } from '@/lib/nexus-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    const admin = getRequiredAdminClient()

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
      if (!['task_created', 'task_status_changed'].includes(triggerType)) {
        return NextResponse.json({ error: '지원되는 자동화 이벤트가 아닙니다. (마감 도래는 매일 아침 서버가 자동 실행합니다.)' }, { status: 400 })
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
