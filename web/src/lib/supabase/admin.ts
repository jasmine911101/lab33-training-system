import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'
import { serverEnv } from '@/lib/env.server'

export function createAdminClient() {
  if (!serverEnv.supabaseServiceRoleKey) {
    return null
  }

  return createSupabaseClient(env.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
