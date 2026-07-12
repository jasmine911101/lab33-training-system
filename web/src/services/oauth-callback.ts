import 'server-only'

import type { User } from '@supabase/supabase-js'

import type { OAuthErrorCode } from '@/lib/auth/oauth-errors'
import { normalizeAuthEmail } from '@/lib/auth/provider'
import { createAdminClient } from '@/lib/supabase/admin'

type CoachLookupRow = {
  id: number
  user_id: string | null
  email: string | null
}

type AthleteLookupRow = {
  id: number
  user_id: string | null
  email: string | null
  must_change_password: boolean | null
}

type OAuthCallbackResolution =
  | {
      status: 'coach'
      redirectPath: '/coach'
      matchedEmail: string
    }
  | {
      status: 'student'
      redirectPath: '/student'
      matchedEmail: string
    }
  | {
      status: 'error'
      code: OAuthErrorCode
      loginPath: '/coach/login' | '/student/login'
    }

type BindingResult =
  | { ok: true }
  | { ok: false; code: Extract<OAuthErrorCode, 'coach-user-conflict' | 'athlete-user-conflict' | 'binding-unavailable'> }

function logOAuthResolution(message: string, payload: Record<string, unknown>) {
  console.info('[LAB33][OAuthCallback]', message, payload)
}

function summarizeCoachRows(rows: CoachLookupRow[]) {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    hasUserId: Boolean(row.user_id),
  }))
}

function summarizeAthleteRows(rows: AthleteLookupRow[]) {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    hasUserId: Boolean(row.user_id),
    mustChangePassword: row.must_change_password ?? false,
  }))
}

function getLoginPath(intent?: string | null) {
  return intent === 'student' ? '/student/login' : '/coach/login'
}

async function findCoachRowsByEmail(email: string) {
  const admin = createAdminClient()
  if (!admin) {
    throw new Error('missing-admin-client')
  }

  const { data, error } = await admin
    .from('coaches')
    .select('id, user_id, email')
    .ilike('email', email)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoachLookupRow[]
}

async function findAthleteRowsByEmail(email: string) {
  const admin = createAdminClient()
  if (!admin) {
    throw new Error('missing-admin-client')
  }

  const { data, error } = await admin
    .from('athletes')
    .select('id, user_id, email, must_change_password')
    .ilike('email', email)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteLookupRow[]
}

async function bindCoachUserId(coach: CoachLookupRow, userId: string): Promise<BindingResult> {
  if (coach.user_id === userId) return { ok: true as const }
  if (coach.user_id && coach.user_id !== userId) {
    return { ok: false as const, code: 'coach-user-conflict' satisfies OAuthErrorCode }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: false as const, code: 'binding-unavailable' satisfies OAuthErrorCode }
  }

  const { data, error } = await admin
    .from('coaches')
    .update({ user_id: userId })
    .eq('id', coach.id)
    .is('user_id', null)
    .select('id, user_id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data?.user_id === userId) {
    return { ok: true as const }
  }

  const { data: latest, error: latestError } = await admin
    .from('coaches')
    .select('id, user_id')
    .eq('id', coach.id)
    .maybeSingle()

  if (latestError) {
    throw latestError
  }

  if (latest?.user_id === userId) {
    return { ok: true as const }
  }

  return { ok: false as const, code: 'coach-user-conflict' satisfies OAuthErrorCode }
}

async function bindAthleteUserId(athlete: AthleteLookupRow, userId: string): Promise<BindingResult> {
  if (athlete.user_id === userId) {
    if (athlete.must_change_password) {
      const admin = createAdminClient()
      if (admin) {
        await admin
          .from('athletes')
          .update({ must_change_password: false })
          .eq('id', athlete.id)
      }
    }

    return { ok: true as const }
  }

  if (athlete.user_id && athlete.user_id !== userId) {
    return { ok: false as const, code: 'athlete-user-conflict' satisfies OAuthErrorCode }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { ok: false as const, code: 'binding-unavailable' satisfies OAuthErrorCode }
  }

  const { data, error } = await admin
    .from('athletes')
    .update({
      user_id: userId,
      must_change_password: false,
    })
    .eq('id', athlete.id)
    .is('user_id', null)
    .select('id, user_id')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data?.user_id === userId) {
    return { ok: true as const }
  }

  const { data: latest, error: latestError } = await admin
    .from('athletes')
    .select('id, user_id')
    .eq('id', athlete.id)
    .maybeSingle()

  if (latestError) {
    throw latestError
  }

  if (latest?.user_id === userId) {
    return { ok: true as const }
  }

  return { ok: false as const, code: 'athlete-user-conflict' satisfies OAuthErrorCode }
}

export async function resolveOAuthCallbackUser(
  user: User | null,
  intent?: string | null,
): Promise<OAuthCallbackResolution> {
  const loginPath = getLoginPath(intent)
  const rawGoogleEmail = user?.email ?? null

  if (!user) {
    logOAuthResolution('callback failed: no user from Supabase session', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: null,
      coachQueryResults: [],
      athleteQueryResults: [],
      finalReason: 'callback-failed',
    })
    return {
      status: 'error',
      code: 'callback-failed',
      loginPath,
    }
  }

  const email = normalizeAuthEmail(user.email)
  if (!email) {
    logOAuthResolution('callback failed: missing email', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: [],
      athleteQueryResults: [],
      finalReason: 'missing-email',
    })
    return {
      status: 'error',
      code: 'missing-email',
      loginPath,
    }
  }

  if (!user.email_confirmed_at) {
    logOAuthResolution('callback failed: email not verified', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: [],
      athleteQueryResults: [],
      finalReason: 'email-not-verified',
    })
    return {
      status: 'error',
      code: 'email-not-verified',
      loginPath,
    }
  }

  let coachRows: CoachLookupRow[] = []
  let athleteRows: AthleteLookupRow[] = []

  try {
    ;[coachRows, athleteRows] = await Promise.all([findCoachRowsByEmail(email), findAthleteRowsByEmail(email)])
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-admin-client') {
      logOAuthResolution('callback failed: admin client unavailable during lookup', {
        googleEmail: rawGoogleEmail,
        normalizedEmail: email,
        coachQueryResults: [],
        athleteQueryResults: [],
        finalReason: 'binding-unavailable',
      })
      return {
        status: 'error',
        code: 'binding-unavailable',
        loginPath,
      }
    }

    throw error
  }

  logOAuthResolution('email lookup results', {
    googleEmail: rawGoogleEmail,
    normalizedEmail: email,
    coachQuery: "from('coaches').select('id, user_id, email').ilike('email', normalizedEmail).order('id', { ascending: true })",
    athleteQuery: "from('athletes').select('id, user_id, email, must_change_password').ilike('email', normalizedEmail).order('id', { ascending: true })",
    coachQueryResults: summarizeCoachRows(coachRows),
    athleteQueryResults: summarizeAthleteRows(athleteRows),
  })

  if (coachRows.length > 0 && athleteRows.length > 0) {
    logOAuthResolution('callback failed: role conflict', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: summarizeCoachRows(coachRows),
      athleteQueryResults: summarizeAthleteRows(athleteRows),
      finalReason: 'role-conflict',
    })
    return {
      status: 'error',
      code: 'role-conflict',
      loginPath,
    }
  }

  if (coachRows.length > 1 || athleteRows.length > 1) {
    logOAuthResolution('callback failed: duplicate role records', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: summarizeCoachRows(coachRows),
      athleteQueryResults: summarizeAthleteRows(athleteRows),
      finalReason: 'role-conflict',
    })
    return {
      status: 'error',
      code: 'role-conflict',
      loginPath,
    }
  }

  if (coachRows.length === 0 && athleteRows.length === 0) {
    logOAuthResolution('callback failed: email not registered in coaches or athletes', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: [],
      athleteQueryResults: [],
      finalReason: 'not-registered',
    })
    return {
      status: 'error',
      code: 'not-registered',
      loginPath,
    }
  }

  if (coachRows.length === 1) {
    const binding = await bindCoachUserId(coachRows[0], user.id)
    if (!binding.ok) {
      logOAuthResolution('callback failed during coach binding', {
        googleEmail: rawGoogleEmail,
        normalizedEmail: email,
        coachQueryResults: summarizeCoachRows(coachRows),
        athleteQueryResults: [],
        finalReason: binding.code,
      })
      return {
        status: 'error',
        code: binding.code,
        loginPath,
      }
    }

    logOAuthResolution('callback resolved as coach', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: summarizeCoachRows(coachRows),
      athleteQueryResults: [],
      finalReason: 'coach',
      redirectPath: '/coach',
    })
    return {
      status: 'coach',
      redirectPath: '/coach',
      matchedEmail: email,
    }
  }

  const binding = await bindAthleteUserId(athleteRows[0], user.id)
  if (!binding.ok) {
    logOAuthResolution('callback failed during athlete binding', {
      googleEmail: rawGoogleEmail,
      normalizedEmail: email,
      coachQueryResults: [],
      athleteQueryResults: summarizeAthleteRows(athleteRows),
      finalReason: binding.code,
    })
    return {
      status: 'error',
      code: binding.code,
      loginPath,
    }
  }

  logOAuthResolution('callback resolved as student', {
    googleEmail: rawGoogleEmail,
    normalizedEmail: email,
    coachQueryResults: [],
    athleteQueryResults: summarizeAthleteRows(athleteRows),
    finalReason: 'student',
    redirectPath: '/student',
  })
  return {
    status: 'student',
    redirectPath: '/student',
    matchedEmail: email,
  }
}
