// harim_nexus 스키마(supabase/bootstrap/01_nexus_schema.sql)를 적용한 뒤 기본 관리자 계정을 만든다.
// 여러 번 실행해도 안전하다 (있으면 비밀번호·역할만 갱신).
//
// 실행 (PowerShell):
//   $env:NEXUS_ADMIN_PASSWORD = '<비밀번호>'; node --env-file=.env.local scripts/seed-admin.mjs
//
// 필요한 값: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(.env.local), NEXUS_ADMIN_PASSWORD(실행 시에만)
// 비밀번호는 이 파일이나 git 에 적지 않는다.
import { createClient } from '@supabase/supabase-js'

const DB_SCHEMA = process.env.NEXT_PUBLIC_NEXUS_DB_SCHEMA || 'harim_nexus'
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'
const LOGIN_ID = 'admin'
const EMAIL = `${LOGIN_ID}@harim-nexus.com`

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = String(process.env.NEXUS_ADMIN_PASSWORD || '')

if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다.')
if (password.length < 6) throw new Error('NEXUS_ADMIN_PASSWORD 는 6자리 이상이어야 합니다.')

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: DB_SCHEMA },
})

// 1) 로그인 계정 (이미 있으면 비밀번호만 갱신)
const { data: page, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError
let authUser = (page.users || []).find(user => user.email === EMAIL)

if (authUser) {
  const { data, error } = await admin.auth.admin.updateUserById(authUser.id, { password, email_confirm: true })
  if (error) throw error
  authUser = data.user
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password, email_confirm: true, user_metadata: { name: '관리자' },
  })
  if (error) throw error
  authUser = data.user
}

// 2) 팀원 프로필
const { data: member, error: memberError } = await admin.from('members').upsert({
  login_id: LOGIN_ID,
  name: '관리자',
  position: '팀장',
  department: '원가관리',
  email: EMAIL,
  joined_at: new Date().toISOString().slice(0, 10),
  status: 'active',
  approved: true,
  role: 'admin',
  auth_id: authUser.id,
}, { onConflict: 'login_id' }).select('id').single()
if (memberError) throw memberError

// 3) 워크스페이스 소유자 (워크스페이스 RLS 는 이 행이 있어야 읽기·쓰기를 허용한다)
const { error: wsError } = await admin.from('workspace_members').upsert({
  workspace_id: WORKSPACE_ID, member_id: member.id, role: 'owner', active: true,
}, { onConflict: 'workspace_id,member_id' })
if (wsError) throw wsError

console.log(`관리자 계정 준비 완료: 아이디 ${LOGIN_ID} (member #${member.id})`)
