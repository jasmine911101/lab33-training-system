import 'server-only'

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null
const coachInviteCode = process.env.COACH_INVITE_CODE?.trim() || null

function parseEmailList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

const coachEmails = parseEmailList(process.env.COACH_EMAILS)
const headCoachEmails = parseEmailList(process.env.HEAD_COACH_EMAILS)

export const serverEnv = {
  supabaseServiceRoleKey,
  coachInviteCode,
  coachEmails,
  headCoachEmails,
} as const
