import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { getSystemEmail, isValidPin, normalizeLoginId, PIN_RULE_MESSAGE } from '@/lib/auth-id'
import { SYSTEM_ADMIN_LOGIN_ID } from '@/lib/roles'

// 관리자 전용 회원 관리 API (목록·생성·수정·승인·비밀번호 재설정·삭제).
// 계정 생성/삭제에 service_role 키가 필요해 서버 라우트로 둔다. 키는 절대 NEXT_PUBLIC_ 로 노출하지 않는다.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

const json = (body, status = 200) => NextResponse.json(body, { status })
const text = value => String(value ?? '').trim() || null

export async function POST(request) {
  const admin = getAdminClient()
  if (!admin) return json({ error: '서버에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' }, 500)

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user } = {}, error: userError } = token ? await admin.auth.getUser(token) : { error: true }
  if (userError || !user) return json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, 401)

  const { data: caller, error: callerError } = await admin
    .from('members')
    .select('id, login_id, name, role, status, approved')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (callerError || !caller || caller.role !== 'admin' || caller.approved !== true || caller.status === 'pending') {
    return json({ error: '관리자만 사용할 수 있는 기능입니다.' }, 403)
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  const log = action => admin.from('activities').insert({ user_name: caller.name, action })

  try {
    if (action === 'list') {
      const { data: members, error } = await admin
        .from('members')
        .select('id, login_id, name, position, department, email, joined_at, status, approved, message, skills, role, auth_id')
        .order('joined_at', { ascending: true })
      if (error) throw error
      const { data: authPage, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authError) throw authError
      const authUsers = new Map((authPage.users || []).map(item => [item.id, item]))
      return json({
        members: (members || []).map(({ auth_id: authId, ...member }) => {
          const authUser = authId ? authUsers.get(authId) : null
          return {
            ...member,
            authLinked: Boolean(authUser),
            emailConfirmed: Boolean(authUser?.email_confirmed_at),
            lastSignInAt: authUser?.last_sign_in_at ?? null,
          }
        }),
      })
    }

    if (action === 'create') {
      const loginId = normalizeLoginId(body.loginId)
      const password = String(body.password ?? '')
      const name = String(body.name ?? '').trim()
      if (!LOGIN_ID_PATTERN.test(loginId)) return json({ error: '아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈으로 3~32자여야 합니다.' }, 400)
      if (!isValidPin(password)) return json({ error: PIN_RULE_MESSAGE }, 400)
      if (!name) return json({ error: '이름을 입력해 주세요.' }, 400)

      const { data: duplicate } = await admin.from('members').select('id').eq('login_id', loginId).maybeSingle()
      if (duplicate) return json({ error: '이미 사용 중인 아이디입니다.' }, 409)

      const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
        email: getSystemEmail(loginId), password, email_confirm: true, user_metadata: { name },
      })
      if (authError) throw authError

      const pending = body.status === 'pending'
      const { data: member, error: memberError } = await admin.from('members').insert({
        auth_id: createdAuth.user.id,
        login_id: loginId,
        name,
        position: text(body.position),
        department: text(body.department),
        email: text(body.email),
        joined_at: text(body.joinedAt),
        status: pending ? 'pending' : 'active',
        approved: !pending,
        role: body.role === 'admin' ? 'admin' : 'member',
        message: text(body.message),
      }).select('id, login_id, name').single()
      if (memberError) {
        await admin.auth.admin.deleteUser(createdAuth.user.id)
        throw memberError
      }

      // 모든 승인 회원은 기본 워크스페이스 구성원이다 (워크스페이스 RLS 가 이 행을 본다)
      const { error: wsError } = await admin.from('workspace_members').upsert({
        workspace_id: process.env.NEXUS_WORKSPACE_ID || '00000000-0000-4000-8000-000000000001',
        member_id: member.id,
        role: body.role === 'admin' ? 'admin' : 'member',
        active: !pending,
      }, { onConflict: 'workspace_id,member_id' })
      if (wsError) throw wsError

      await log(`님이 [${name}] 계정을 생성했습니다.`)
      return json({ member }, 201)
    }

    const memberId = Number(body.memberId)
    if (!Number.isInteger(memberId) || memberId <= 0) return json({ error: '대상 회원이 올바르지 않습니다.' }, 400)

    const { data: target, error: targetError } = await admin
      .from('members')
      .select('id, auth_id, login_id, name, role')
      .eq('id', memberId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return json({ error: '회원을 찾을 수 없습니다.' }, 404)

    const syncWorkspace = (role, active) => admin.from('workspace_members').upsert({
      workspace_id: process.env.NEXUS_WORKSPACE_ID || '00000000-0000-4000-8000-000000000001',
      member_id: memberId,
      role: target.login_id === SYSTEM_ADMIN_LOGIN_ID ? 'owner' : role === 'admin' ? 'admin' : 'member',
      active,
    }, { onConflict: 'workspace_id,member_id' })

    if (action === 'update') {
      const loginId = normalizeLoginId(body.loginId ?? target.login_id)
      const name = String(body.name ?? '').trim()
      if (!LOGIN_ID_PATTERN.test(loginId)) return json({ error: '아이디 형식이 올바르지 않습니다.' }, 400)
      if (!name) return json({ error: '이름을 입력해 주세요.' }, 400)
      if (target.login_id === SYSTEM_ADMIN_LOGIN_ID && loginId !== SYSTEM_ADMIN_LOGIN_ID) {
        return json({ error: '기본 관리자 아이디는 바꿀 수 없습니다.' }, 400)
      }

      if (loginId !== target.login_id) {
        const { data: duplicate } = await admin.from('members').select('id').eq('login_id', loginId).neq('id', memberId).maybeSingle()
        if (duplicate) return json({ error: '이미 사용 중인 아이디입니다.' }, 409)
        if (target.auth_id) {
          const { error } = await admin.auth.admin.updateUserById(target.auth_id, { email: getSystemEmail(loginId), email_confirm: true })
          if (error) throw error
        }
      }

      const nextRole = body.role === 'admin' ? 'admin' : 'member'
      if ((target.id === caller.id || target.login_id === SYSTEM_ADMIN_LOGIN_ID) && nextRole !== 'admin') {
        return json({ error: '이 계정의 관리자 권한은 해제할 수 없습니다.' }, 400)
      }
      const status = body.status === 'pending' ? 'pending' : String(body.status ?? 'active')
      const { error } = await admin.from('members').update({
        login_id: loginId,
        name,
        position: text(body.position),
        department: text(body.department),
        email: text(body.email),
        joined_at: text(body.joinedAt),
        status,
        approved: status !== 'pending',
        role: nextRole,
        message: text(body.message),
      }).eq('id', memberId)
      if (error) throw error
      const { error: wsError } = await syncWorkspace(nextRole, status !== 'pending')
      if (wsError) throw wsError
      await log(`님이 [${name}] 회원 정보를 수정했습니다.`)
      return json({ ok: true })
    }

    if (action === 'approve') {
      if (!target.auth_id) return json({ error: '로그인 계정 연결이 없습니다. 먼저 비밀번호 재설정으로 계정을 복구해 주세요.' }, 409)
      const { error } = await admin.from('members').update({ status: 'active', approved: true }).eq('id', memberId)
      if (error) throw error
      const { error: wsError } = await syncWorkspace(target.role, true)
      if (wsError) throw wsError
      await log(`님이 [${target.name}] 가입을 승인했습니다.`)
      return json({ ok: true })
    }

    if (action === 'reset-password') {
      const password = String(body.password ?? '')
      if (!isValidPin(password)) return json({ error: PIN_RULE_MESSAGE }, 400)
      let authId = target.auth_id
      if (!authId) {
        const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (listError) throw listError
        authId = page.users.find(item => item.email === getSystemEmail(target.login_id))?.id ?? null
      }
      if (authId) {
        const { error } = await admin.auth.admin.updateUserById(authId, { password })
        if (error) throw error
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: getSystemEmail(target.login_id), password, email_confirm: true, user_metadata: { name: target.name },
        })
        if (error) throw error
        authId = data.user.id
      }
      if (authId !== target.auth_id) {
        const { error } = await admin.from('members').update({ auth_id: authId, status: 'active', approved: true }).eq('id', memberId)
        if (error) throw error
      }
      await log(`님이 [${target.name}] 로그인 비밀번호를 재설정했습니다.`)
      return json({ ok: true, authLinked: true })
    }

    if (action === 'delete') {
      if (target.id === caller.id || target.login_id === SYSTEM_ADMIN_LOGIN_ID) {
        return json({ error: '현재 로그인한 계정과 기본 관리자 계정은 삭제할 수 없습니다.' }, 400)
      }
      if (target.auth_id) {
        const { error } = await admin.auth.admin.deleteUser(target.auth_id)
        if (error) throw error
      }
      const { error } = await admin.from('members').delete().eq('id', memberId)
      if (error) throw error
      await log(`님이 [${target.name}] 계정을 삭제했습니다.`)
      return json({ ok: true })
    }

    return json({ error: '알 수 없는 작업입니다.' }, 400)
  } catch (error) {
    console.error('admin members error', error)
    return json({ error: error?.message || '회원 관리 작업에 실패했습니다.' }, 500)
  }
}
