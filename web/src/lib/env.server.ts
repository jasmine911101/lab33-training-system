import 'server-only'

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null
const headCoachRegistrationCode = process.env.HEAD_COACH_REGISTRATION_CODE?.trim() || null

export const serverEnv = {
  supabaseServiceRoleKey,
  headCoachRegistrationCode,
} as const
