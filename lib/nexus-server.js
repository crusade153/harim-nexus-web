import 'server-only'
import { getAdminClient } from '@/lib/supabase-admin'
import { assistantMessage } from '@/lib/ai/review-utils.mjs'

export const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'
export function checked(result) {
  if (result.error) throw result.error
  return result.data
}

export async function requireNexusMember(request) {
  const admin = getAdminClient()
  if (!admin) throw new Error('서버 DB 환경변수가 없습니다.')
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const auth = token ? await admin.auth.getUser(token) : null
  if (!auth?.data?.user || auth.error) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 })
  const member = checked(await admin.from('members').select('id,name,role,approved,status').eq('auth_id', auth.data.user.id).maybeSingle())
  if (!member || !member.approved || member.status === 'pending') throw Object.assign(new Error('구성원 권한이 필요합니다.'), { status: 403 })
  const membership = checked(await admin.from('workspace_members').select('role,active').eq('workspace_id', WORKSPACE_ID).eq('member_id', member.id).maybeSingle())
  if (!membership?.active || membership.role === 'guest') throw Object.assign(new Error('활성 팀원 권한이 필요합니다.'), { status: 403 })
  return { admin, member, isAdmin: member.role === 'admin' || ['owner', 'admin'].includes(membership.role) }
}

export function apiError(error) {
  const missing = /schema cache|does not exist|Could not find/.test(error.message || '')
  return { error: missing ? 'DB 업데이트가 필요합니다. supabase/bootstrap 의 02~05 SQL 적용 여부를 확인해 주세요.' : error.status ? assistantMessage(error.message) : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
}
