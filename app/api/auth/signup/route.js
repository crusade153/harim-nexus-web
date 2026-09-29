import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { getSystemEmail, isValidPin, PIN_RULE_MESSAGE, validateLoginId } from '@/lib/auth-id'

// 셀프 가입: 아이디 + 이름 + 6자리 PIN 으로 가입하면 승인 대기 없이 바로 쓸 수 있다.
// 공유 Supabase 프로젝트의 공개 회원가입 설정을 켜지 않기 위해 service_role 로 서버에서 계정을 만든다.
// NEXUS_SIGNUP_CODE 를 설정하면 그 팀 가입코드를 아는 사람만 가입할 수 있다(비워 두면 누구나).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WORKSPACE_ID = process.env.NEXUS_WORKSPACE_ID || '00000000-0000-4000-8000-000000000001'
const json = (body, status = 200) => NextResponse.json(body, { status })
const text = value => String(value ?? '').trim() || null

export async function POST(request) {
  const admin = getAdminClient()
  if (!admin) return json({ error: '서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 없어 가입할 수 없습니다.' }, 500)

  const body = await request.json().catch(() => ({}))
  const requiredCode = process.env.NEXUS_SIGNUP_CODE
  if (requiredCode && String(body.signupCode ?? '').trim() !== requiredCode) {
    return json({ error: '팀 가입코드가 올바르지 않습니다.' }, 403)
  }

  const login = validateLoginId(body.loginId)
  if (!login.ok) return json({ error: login.message }, 400)
  const name = String(body.name ?? '').trim()
  if (!name) return json({ error: '이름을 입력해 주세요.' }, 400)
  const pin = String(body.pin ?? '')
  if (!isValidPin(pin)) return json({ error: PIN_RULE_MESSAGE }, 400)

  const { data: duplicate, error: duplicateError } = await admin
    .from('members').select('id').eq('login_id', login.loginId).maybeSingle()
  if (duplicateError) return json({ error: duplicateError.message }, 500)
  if (duplicate) return json({ error: '이미 사용 중인 아이디입니다.' }, 409)

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: getSystemEmail(login.loginId), password: pin, email_confirm: true, user_metadata: { name },
  })
  if (authError) {
    const exists = /already|registered|exists/i.test(authError.message || '')
    return json({ error: exists ? '이미 사용 중인 아이디입니다.' : authError.message }, exists ? 409 : 500)
  }

  const { data: member, error: memberError } = await admin.from('members').insert({
    auth_id: created.user.id,
    login_id: login.loginId,
    name,
    position: text(body.position),
    department: text(body.department),
    joined_at: new Date().toISOString().slice(0, 10),
    status: 'active',
    approved: true,
    role: 'member',
  }).select('id').single()
  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: memberError.message }, 500)
  }

  const { error: wsError } = await admin.from('workspace_members').upsert({
    workspace_id: WORKSPACE_ID, member_id: member.id, role: 'member', active: true,
  }, { onConflict: 'workspace_id,member_id' })
  if (wsError) {
    await admin.from('members').delete().eq('id', member.id)
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: wsError.message }, 500)
  }

  await admin.from('activities').insert({ user_name: name, action: '님이 Nexus에 가입했습니다.' })
  return json({ ok: true }, 201)
}
