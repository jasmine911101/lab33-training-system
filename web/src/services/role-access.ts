import 'server-only'

import type { User } from '@supabase/supabase-js'

import { resolveIdentityBoundProfile } from '@/lib/auth/identity-binding'
import type { OAuthErrorCode } from '@/lib/auth/oauth-errors'
import { getAuthProviderNames } from '@/lib/auth/provider'
import { createAdminClient } from '@/lib/supabase/admin'

type CoachLookupRow = {
  id: number
  user_id: string | null
  is_head_coach?: boolean | null
  must_change_password?: boolean | null
}

type AthleteLookupRow = {
  id: number
  user_id: string | null
  must_change_password: boolean | null
}

type CoachAccessResult =
  | { ok: true; source: 'user_id'; coachRows: CoachLookupRow[] }
  | {
      ok: false
      code: Extract<OAuthErrorCode, 'not-registered' | 'coach-user-conflict' | 'binding-unavailable'>
      coachRows: CoachLookupRow[]
    }

type StudentAccessResult =
  | { ok: true; source: 'user_id'; athleteRows: AthleteLookupRow[] }
  | {
      ok: false
      code: Extract<OAuthErrorCode, 'not-registered' | 'athlete-user-conflict' | 'binding-unavailable'>
      athleteRows: AthleteLookupRow[]
    }

function summarizeProfileRows(rows: readonly { user_id: string | null }[]) {
  return {
    count: rows.length,
    boundCount: rows.filter((row) => Boolean(row.user_id)).length,
  }
}

export async function getAuthAccessDiagnosticSnapshot(user: User | null) {
  if (!user) {
    return {
      authenticated: false,
      authProviderCount: 0,
      coachProfiles: summarizeProfileRows([]),
      athleteProfiles: summarizeProfileRows([]),
    }
  }

  const [coachRows, athleteRows] = await Promise.all([
    findCoachRowsByUserId(user.id),
    findAthleteRowsByUserId(user.id),
  ])

  return {
    authenticated: true,
    authProviderCount: getAuthProviderNames(user).length,
    coachProfiles: summarizeProfileRows(coachRows),
    athleteProfiles: summarizeProfileRows(athleteRows),
  }
}

export function logAuthAccessDiagnostic(
  intent: 'coach' | 'student',
  finalReason: string,
  coachRows: CoachLookupRow[],
  athleteRows: AthleteLookupRow[],
) {
  console.info('[LAB33][AuthAccess]', {
    loginIntent: intent,
    finalReason,
    coachProfiles: summarizeProfileRows(coachRows),
    athleteProfiles: summarizeProfileRows(athleteRows),
  })
}

async function findCoachRowsByUserId(userId: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('coaches')
    .select('id, user_id, is_head_coach, must_change_password')
    .eq('user_id', userId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoachLookupRow[]
}

async function findAthleteRowsByUserId(userId: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing-admin-client')

  const { data, error } = await admin
    .from('athletes')
    .select('id, user_id, must_change_password')
    .eq('user_id', userId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteLookupRow[]
}

export async function resolveCoachAccessForUser(user: User | null): Promise<CoachAccessResult> {
  if (!user) {
    return { ok: false, code: 'not-registered', coachRows: [] }
  }

  try {
    const coachRows = await findCoachRowsByUserId(user.id)
    const resolution = resolveIdentityBoundProfile(coachRows, user.id)
    if (resolution.status === 'matched') {
      logAuthAccessDiagnostic('coach', 'matched-user-id', coachRows, [])
      return { ok: true, source: 'user_id', coachRows }
    }

    const code = resolution.status === 'conflict' ? 'coach-user-conflict' : 'not-registered'
    logAuthAccessDiagnostic('coach', code, coachRows, [])
    return { ok: false, code, coachRows }
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-admin-client') {
      return { ok: false, code: 'binding-unavailable', coachRows: [] }
    }

    throw error
  }
}

export async function resolveStudentAccessForUser(user: User | null): Promise<StudentAccessResult> {
  if (!user) {
    return { ok: false, code: 'not-registered', athleteRows: [] }
  }

  try {
    const athleteRows = await findAthleteRowsByUserId(user.id)
    const resolution = resolveIdentityBoundProfile(athleteRows, user.id)
    if (resolution.status === 'matched') {
      logAuthAccessDiagnostic('student', 'matched-user-id', [], athleteRows)
      return { ok: true, source: 'user_id', athleteRows }
    }

    const code = resolution.status === 'conflict' ? 'athlete-user-conflict' : 'not-registered'
    logAuthAccessDiagnostic('student', code, [], athleteRows)
    return { ok: false, code, athleteRows }
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-admin-client') {
      return { ok: false, code: 'binding-unavailable', athleteRows: [] }
    }

    throw error
  }
}

export function summarizeCoachAccessRows(rows: CoachLookupRow[]) {
  return summarizeProfileRows(rows)
}

export function summarizeStudentAccessRows(rows: AthleteLookupRow[]) {
  return summarizeProfileRows(rows)
}
