import 'server-only'

import type { User } from '@supabase/supabase-js'

import type { OAuthErrorCode } from '@/lib/auth/oauth-errors'
import { getAuthProviderNames, normalizeAuthEmail } from '@/lib/auth/provider'
import { createAdminClient } from '@/lib/supabase/admin'
import { listAllAuthUsersByEmail } from '@/services/managed-auth'

type CoachLookupRow = {
  id: number
  user_id: string | null
  email: string | null
  is_head_coach?: boolean | null
}

type AthleteLookupRow = {
  id: number
  user_id: string | null
  email: string | null
  must_change_password: boolean | null
}

type CoachAccessResult =
  | {
      ok: true
      matchedEmail: string
      source: 'user_id' | 'email_bind'
      coachRows: CoachLookupRow[]
    }
  | {
      ok: false
      code: Extract<OAuthErrorCode, 'missing-email' | 'email-not-verified' | 'not-registered' | 'coach-user-conflict' | 'binding-unavailable'>
      normalizedEmail: string | null
      coachRows: CoachLookupRow[]
    }

type StudentAccessResult =
  | {
      ok: true
      matchedEmail: string
      source: 'user_id' | 'email_bind'
      athleteRows: AthleteLookupRow[]
    }
  | {
      ok: false
      code: Extract<OAuthErrorCode, 'missing-email' | 'email-not-verified' | 'not-registered' | 'athlete-user-conflict' | 'binding-unavailable'>
      normalizedEmail: string | null
      athleteRows: AthleteLookupRow[]
    }

function summarizeCoachRows(rows: CoachLookupRow[]) {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    hasUserId: Boolean(row.user_id),
    userId: row.user_id,
  }))
}

function summarizeAthleteRows(rows: AthleteLookupRow[]) {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    hasUserId: Boolean(row.user_id),
    userId: row.user_id,
    mustChangePassword: row.must_change_password ?? false,
  }))
}

function getCrossRoleWarningPayload(
  authUserId: string,
  normalizedEmail: string | null,
  coachRows: CoachLookupRow[],
  athleteRows: AthleteLookupRow[],
) {
  const coachUserId = coachRows.find((row) => row.user_id)?.user_id ?? null
  const athleteUserId = athleteRows.find((row) => row.user_id)?.user_id ?? null

  if (!coachUserId || !athleteUserId || coachUserId === athleteUserId) {
    return null
  }

  return {
    currentAuthUserId: authUserId,
    coachUserId,
    athleteUserId,
    normalizedEmail,
  }
}

function logCrossRoleWarning(
  intent: 'coach' | 'student',
  authUserId: string,
  normalizedEmail: string | null,
  coachRows: CoachLookupRow[],
  athleteRows: AthleteLookupRow[],
) {
  const payload = getCrossRoleWarningPayload(authUserId, normalizedEmail, coachRows, athleteRows)
  if (!payload) return

  console.warn('[LAB33][CrossRoleWarning]', {
    loginIntent: intent,
    ...payload,
  })
}

export async function getAuthAccessDiagnosticSnapshot(user: User | null) {
  const normalizedEmail = normalizeAuthEmail(user?.email)
  const admin = createAdminClient()
  const [coachRows, athleteRows, authUsers] = normalizedEmail
    ? await Promise.all([
        findCoachRowsByEmail(normalizedEmail),
        findAthleteRowsByEmail(normalizedEmail),
        admin ? listAllAuthUsersByEmail(admin, normalizedEmail) : Promise.resolve([]),
      ])
    : [[], [], []]

  return {
    normalizedEmail,
    authUserId: user?.id ?? null,
    authProviders: getAuthProviderNames(user),
    coachRows,
    athleteRows,
    authUsers,
  }
}

export function logAuthAccessDiagnostic(
  intent: 'coach' | 'student',
  user: User | null,
  payload: {
    finalReason: string
    coachRows: CoachLookupRow[]
    athleteRows: AthleteLookupRow[]
    authUsers?: User[]
    normalizedEmail?: string | null
  },
) {
  console.info('[LAB33][AuthAccess]', {
    loginIntent: intent,
    normalizedEmail: payload.normalizedEmail ?? normalizeAuthEmail(user?.email),
    currentAuthUserId: user?.id ?? null,
    authUserIdentityProviders: getAuthProviderNames(user),
    coachProfileUserIds: payload.coachRows.map((row) => row.user_id).filter(Boolean),
    athleteProfileUserIds: payload.athleteRows.map((row) => row.user_id).filter(Boolean),
    matchingAuthUsers: payload.authUsers?.map((authUser) => ({
      id: authUser.id,
      email: authUser.email,
      providers: getAuthProviderNames(authUser),
    })) ?? [],
    coachQueryResults: summarizeCoachRows(payload.coachRows),
    athleteQueryResults: summarizeAthleteRows(payload.athleteRows),
    finalReason: payload.finalReason,
  })
}

async function findCoachRowsByUserId(userId: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('coaches')
    .select('id, user_id, email, is_head_coach')
    .eq('user_id', userId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoachLookupRow[]
}

async function findCoachRowsByEmail(email: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('coaches')
    .select('id, user_id, email, is_head_coach')
    .ilike('email', email)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoachLookupRow[]
}

async function findAthleteRowsByUserId(userId: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('athletes')
    .select('id, user_id, email, must_change_password')
    .eq('user_id', userId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteLookupRow[]
}

async function findAthleteRowsByEmail(email: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('athletes')
    .select('id, user_id, email, must_change_password')
    .ilike('email', email)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteLookupRow[]
}

async function bindCoachUserId(coach: CoachLookupRow, userId: string) {
  if (coach.user_id === userId) return true
  if (coach.user_id && coach.user_id !== userId) return false

  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('coaches')
    .update({ user_id: userId })
    .eq('id', coach.id)
    .is('user_id', null)
    .select('id, user_id')
    .maybeSingle()

  if (error) throw error
  if (data?.user_id === userId) return true

  const { data: latest, error: latestError } = await admin
    .from('coaches')
    .select('id, user_id')
    .eq('id', coach.id)
    .maybeSingle()

  if (latestError) throw latestError
  return latest?.user_id === userId
}

async function bindAthleteUserId(athlete: AthleteLookupRow, userId: string) {
  if (athlete.user_id === userId) return true
  if (athlete.user_id && athlete.user_id !== userId) return false

  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('athletes')
    .update({ user_id: userId })
    .eq('id', athlete.id)
    .is('user_id', null)
    .select('id, user_id')
    .maybeSingle()

  if (error) throw error
  if (data?.user_id === userId) return true

  const { data: latest, error: latestError } = await admin
    .from('athletes')
    .select('id, user_id')
    .eq('id', athlete.id)
    .maybeSingle()

  if (latestError) throw latestError
  return latest?.user_id === userId
}

export async function resolveCoachAccessForUser(user: User | null): Promise<CoachAccessResult> {
  const email = normalizeAuthEmail(user?.email)

  if (!email) {
    return {
      ok: false,
      code: 'missing-email',
      normalizedEmail: email,
      coachRows: [],
    }
  }

  if (!user?.email_confirmed_at) {
    return {
      ok: false,
      code: 'email-not-verified',
      normalizedEmail: email,
      coachRows: [],
    }
  }

  try {
    const coachRowsByUserId = await findCoachRowsByUserId(user.id)
    const athleteRowsByEmail = await findAthleteRowsByEmail(email)

    if (coachRowsByUserId.length > 1) {
      return {
        ok: false,
        code: 'coach-user-conflict',
        normalizedEmail: email,
        coachRows: coachRowsByUserId,
      }
    }

    if (coachRowsByUserId.length === 1) {
      logCrossRoleWarning('coach', user.id, email, coachRowsByUserId, athleteRowsByEmail)
      return {
        ok: true,
        matchedEmail: email,
        source: 'user_id',
        coachRows: coachRowsByUserId,
      }
    }

    const coachRowsByEmail = await findCoachRowsByEmail(email)
    if (coachRowsByEmail.length === 0) {
      return {
        ok: false,
        code: 'not-registered',
        normalizedEmail: email,
        coachRows: [],
      }
    }

    if (coachRowsByEmail.length > 1) {
      return {
        ok: false,
        code: 'coach-user-conflict',
        normalizedEmail: email,
        coachRows: coachRowsByEmail,
      }
    }

    const bound = await bindCoachUserId(coachRowsByEmail[0], user.id)
    if (!bound) {
      return {
        ok: false,
        code: 'coach-user-conflict',
        normalizedEmail: email,
        coachRows: coachRowsByEmail,
      }
    }

    logCrossRoleWarning('coach', user.id, email, coachRowsByEmail, athleteRowsByEmail)
    return {
      ok: true,
      matchedEmail: email,
      source: 'email_bind',
      coachRows: coachRowsByEmail,
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-admin-client') {
      return {
        ok: false,
        code: 'binding-unavailable',
        normalizedEmail: email,
        coachRows: [],
      }
    }

    throw error
  }
}

export async function resolveStudentAccessForUser(user: User | null): Promise<StudentAccessResult> {
  const email = normalizeAuthEmail(user?.email)

  if (!email) {
    return {
      ok: false,
      code: 'missing-email',
      normalizedEmail: email,
      athleteRows: [],
    }
  }

  if (!user?.email_confirmed_at) {
    return {
      ok: false,
      code: 'email-not-verified',
      normalizedEmail: email,
      athleteRows: [],
    }
  }

  try {
    const athleteRowsByUserId = await findAthleteRowsByUserId(user.id)
    const coachRowsByEmail = await findCoachRowsByEmail(email)

    if (athleteRowsByUserId.length > 1) {
      return {
        ok: false,
        code: 'athlete-user-conflict',
        normalizedEmail: email,
        athleteRows: athleteRowsByUserId,
      }
    }

    if (athleteRowsByUserId.length === 1) {
      logCrossRoleWarning('student', user.id, email, coachRowsByEmail, athleteRowsByUserId)
      return {
        ok: true,
        matchedEmail: email,
        source: 'user_id',
        athleteRows: athleteRowsByUserId,
      }
    }

    const athleteRowsByEmail = await findAthleteRowsByEmail(email)
    if (athleteRowsByEmail.length === 0) {
      return {
        ok: false,
        code: 'not-registered',
        normalizedEmail: email,
        athleteRows: [],
      }
    }

    if (athleteRowsByEmail.length > 1) {
      return {
        ok: false,
        code: 'athlete-user-conflict',
        normalizedEmail: email,
        athleteRows: athleteRowsByEmail,
      }
    }

    const bound = await bindAthleteUserId(athleteRowsByEmail[0], user.id)
    if (!bound) {
      return {
        ok: false,
        code: 'athlete-user-conflict',
        normalizedEmail: email,
        athleteRows: athleteRowsByEmail,
      }
    }

    logCrossRoleWarning('student', user.id, email, coachRowsByEmail, athleteRowsByEmail)
    return {
      ok: true,
      matchedEmail: email,
      source: 'email_bind',
      athleteRows: athleteRowsByEmail,
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-admin-client') {
      return {
        ok: false,
        code: 'binding-unavailable',
        normalizedEmail: email,
        athleteRows: [],
      }
    }

    throw error
  }
}

export function summarizeCoachAccessRows(rows: CoachLookupRow[]) {
  return summarizeCoachRows(rows)
}

export function summarizeStudentAccessRows(rows: AthleteLookupRow[]) {
  return summarizeAthleteRows(rows)
}
