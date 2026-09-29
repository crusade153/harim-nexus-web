import { createClient } from '@supabase/supabase-js'
import { NEXUS_DB_SCHEMA } from '@/lib/db-config'

// 서버 라우트 전용 service_role 클라이언트. 브라우저 코드에서 import 하지 말 것.
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: NEXUS_DB_SCHEMA },
  })
}
