import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.89.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  })

const normalizeLoginId = (value: unknown) => String(value ?? "").trim().toLowerCase()
const loginIdPattern = /^[a-z0-9][a-z0-9._-]{2,31}$/
const systemEmail = (loginId: string) => `${loginId}@harim-nexus.com`

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405)

  const url = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const authorization = req.headers.get("Authorization") ?? ""
  if (!url || !serviceKey) return json({ error: "회원 관리 서버 설정이 올바르지 않습니다." }, 500)

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const token = authorization.replace(/^Bearer\s+/i, "")
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) return json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." }, 401)

  const { data: caller, error: callerError } = await admin
    .from("members")
    .select("id, login_id, name, role, status, approved")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (callerError || !caller || caller.role !== "admin" || caller.approved !== true || caller.status === "pending") {
    return json({ error: "관리자만 사용할 수 있는 기능입니다." }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const action = String(body.action ?? "")

  try {
    if (action === "list") {
      const { data: members, error } = await admin
        .from("members")
        .select("id, login_id, name, position, department, email, joined_at, status, approved, message, skills, role, auth_id")
        .order("joined_at", { ascending: true })
      if (error) throw error

      const { data: authPage, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authError) throw authError
      const authUsers = new Map((authPage.users ?? []).map((item) => [item.id, item]))

      return json({
        members: (members ?? []).map((member) => {
          const authUser = member.auth_id ? authUsers.get(member.auth_id) : null
          const { auth_id: _authId, ...safeMember } = member
          return {
            ...safeMember,
            authLinked: Boolean(authUser),
            emailConfirmed: Boolean(authUser?.email_confirmed_at),
            lastSignInAt: authUser?.last_sign_in_at ?? null,
          }
        }),
      })
    }

    if (action === "create") {
      const loginId = normalizeLoginId(body.loginId)
      const password = String(body.password ?? "")
      const name = String(body.name ?? "").trim()
      if (!loginIdPattern.test(loginId)) return json({ error: "아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈으로 3~32자여야 합니다." }, 400)
      if (password.length < 8) return json({ error: "초기 비밀번호는 8자 이상이어야 합니다." }, 400)
      if (!name) return json({ error: "이름을 입력해 주세요." }, 400)

      const { data: duplicate } = await admin.from("members").select("id").eq("login_id", loginId).maybeSingle()
      if (duplicate) return json({ error: "이미 사용 중인 아이디입니다." }, 409)

      const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
        email: systemEmail(loginId),
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (authError) throw authError

      const { data: member, error: memberError } = await admin.from("members").insert({
        auth_id: createdAuth.user.id,
        login_id: loginId,
        name,
        position: String(body.position ?? "").trim() || null,
        department: String(body.department ?? "").trim() || null,
        email: String(body.email ?? "").trim() || null,
        joined_at: String(body.joinedAt ?? "").trim() || null,
        status: body.status === "pending" ? "pending" : "active",
        approved: body.status !== "pending",
        role: body.role === "admin" ? "admin" : "member",
        message: String(body.message ?? "").trim() || null,
      }).select("id, login_id, name").single()

      if (memberError) {
        await admin.auth.admin.deleteUser(createdAuth.user.id)
        throw memberError
      }
      await admin.from("activities").insert({ user_name: caller.name, action: `님이 [${name}] 계정을 생성했습니다.` })
      return json({ member }, 201)
    }

    const memberId = Number(body.memberId)
    if (!Number.isInteger(memberId) || memberId <= 0) return json({ error: "대상 회원이 올바르지 않습니다." }, 400)

    const { data: target, error: targetError } = await admin
      .from("members")
      .select("id, auth_id, login_id, name, role")
      .eq("id", memberId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return json({ error: "회원을 찾을 수 없습니다." }, 404)

    if (action === "update") {
      const loginId = normalizeLoginId(body.loginId ?? target.login_id)
      const name = String(body.name ?? "").trim()
      if (!loginIdPattern.test(loginId)) return json({ error: "아이디 형식이 올바르지 않습니다." }, 400)
      if (!name) return json({ error: "이름을 입력해 주세요." }, 400)

      if (loginId !== target.login_id) {
        const { data: duplicate } = await admin.from("members").select("id").eq("login_id", loginId).neq("id", memberId).maybeSingle()
        if (duplicate) return json({ error: "이미 사용 중인 아이디입니다." }, 409)
        if (target.auth_id) {
          const { error } = await admin.auth.admin.updateUserById(target.auth_id, { email: systemEmail(loginId), email_confirm: true })
          if (error) throw error
        }
      }

      const nextRole = body.role === "admin" ? "admin" : "member"
      if (target.id === caller.id && nextRole !== "admin") return json({ error: "본인의 관리자 권한은 해제할 수 없습니다." }, 400)
      const status = body.status === "pending" ? "pending" : String(body.status ?? "active")
      const { error } = await admin.from("members").update({
        login_id: loginId,
        name,
        position: String(body.position ?? "").trim() || null,
        department: String(body.department ?? "").trim() || null,
        email: String(body.email ?? "").trim() || null,
        joined_at: String(body.joinedAt ?? "").trim() || null,
        status,
        approved: status !== "pending",
        role: nextRole,
        message: String(body.message ?? "").trim() || null,
      }).eq("id", memberId)
      if (error) throw error
      await admin.from("activities").insert({ user_name: caller.name, action: `님이 [${name}] 회원 정보를 수정했습니다.` })
      return json({ ok: true })
    }

    if (action === "approve") {
      if (!target.auth_id) return json({ error: "로그인 계정 연결이 없습니다. 먼저 비밀번호 재설정으로 계정을 복구해 주세요." }, 409)
      const { error } = await admin.from("members").update({ status: "active", approved: true }).eq("id", memberId)
      if (error) throw error
      await admin.from("activities").insert({ user_name: caller.name, action: `님이 [${target.name}] 가입을 승인했습니다.` })
      return json({ ok: true })
    }

    if (action === "reset-password") {
      const password = String(body.password ?? "")
      if (password.length < 8) return json({ error: "새 비밀번호는 8자 이상이어야 합니다." }, 400)
      let authId = target.auth_id as string | null
      if (!authId) {
        const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        if (listError) throw listError
        authId = page.users.find((item) => item.email === systemEmail(target.login_id))?.id ?? null
      }
      if (authId) {
        const { error } = await admin.auth.admin.updateUserById(authId, { password })
        if (error) throw error
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: systemEmail(target.login_id), password, email_confirm: true, user_metadata: { name: target.name },
        })
        if (error) throw error
        authId = data.user.id
      }
      if (authId !== target.auth_id) {
        const { error } = await admin.from("members").update({ auth_id: authId, status: "active", approved: true }).eq("id", memberId)
        if (error) throw error
      }
      await admin.from("activities").insert({ user_name: caller.name, action: `님이 [${target.name}] 로그인 비밀번호를 재설정했습니다.` })
      return json({ ok: true, authLinked: true })
    }

    if (action === "delete") {
      if (target.id === caller.id || target.login_id === "crusade153") return json({ error: "현재 최고 관리자 계정은 삭제할 수 없습니다." }, 400)
      if (target.auth_id) {
        const { error } = await admin.auth.admin.deleteUser(target.auth_id)
        if (error) throw error
      }
      const { error } = await admin.from("members").delete().eq("id", memberId)
      if (error) throw error
      await admin.from("activities").insert({ user_name: caller.name, action: `님이 [${target.name}] 계정을 삭제했습니다.` })
      return json({ ok: true })
    }

    return json({ error: "알 수 없는 작업입니다." }, 400)
  } catch (error) {
    console.error("admin-members error", error)
    return json({ error: error instanceof Error ? error.message : "회원 관리 작업에 실패했습니다." }, 500)
  }
})
