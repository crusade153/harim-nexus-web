import { createClient } from '@supabase/supabase-js'
import { NEXUS_DB_SCHEMA } from '@/lib/db-config'

// Next.js 14 는 서버의 fetch 결과를 기본으로 캐시한다(POST 포함). DB 조회·상태 변경이 캐시되면
// 재발급한 토큰이 계속 통하거나 "오늘 이미 보냄" 확인이 무시되는 등 오동작하므로 항상 캐시하지 않는다.
const noStoreFetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

// 서버 라우트 전용 service_role 클라이언트. 브라우저 코드에서 import 하지 말 것.
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: NEXUS_DB_SCHEMA },
    global: { fetch: noStoreFetch },
  })
}
