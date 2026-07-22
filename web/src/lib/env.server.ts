import 'server-only'

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null

export const serverEnv = {
  supabaseServiceRoleKey,
} as const
