import { createClient } from '@supabase/supabase-js'
import { NEXUS_DB_SCHEMA } from '@/lib/db-config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: NEXUS_DB_SCHEMA } })
