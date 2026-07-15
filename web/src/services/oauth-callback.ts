import 'server-only'

import type { User } from '@supabase/supabase-js'

import type { OAuthErrorCode } from '@/lib/auth/oauth-errors'
import {
  resolveCoachAccessForUser,
  resolveStudentAccessForUser,
  summarizeCoachAccessRows,
  summarizeStudentAccessRows,
} from '@/services/role-access'

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

function getLoginPath(intent?: string | null) {
  return intent === 'student' ? '/student/login' : '/coach/login'
}

function logOAuthResolution(message: string, payload: Record<string, unknown>) {
  console.info('[LAB33][OAuthCallback]', message, payload)
}

export async function resolveOAuthCallbackUser(
  user: User | null,
  intent?: string | null,
): Promise<OAuthCallbackResolution> {
  const loginPath = getLoginPath(intent)
  const rawGoogleEmail = user?.email ?? null
  const loginIntent = intent === 'student' ? 'student' : 'coach'

  if (!user) {
    logOAuthResolution('callback failed: no user from Supabase session', {
      loginIntent,
      googleEmail: rawGoogleEmail,
      normalizedEmail: null,
      finalReason: 'callback-failed',
    })
    return {
      status: 'error',
      code: 'callback-failed',
      loginPath,
    }
  }

  if (loginIntent === 'student') {
    const result = await resolveStudentAccessForUser(user)

    logOAuthResolution(result.ok ? 'callback resolved as student' : 'callback failed during student access check', {
      loginIntent,
      googleEmail: rawGoogleEmail,
      normalizedEmail: result.ok ? result.matchedEmail : result.normalizedEmail,
      athleteQueryResults: summarizeStudentAccessRows(result.athleteRows),
      finalReason: result.ok ? `student:${result.source}` : result.code,
      redirectPath: result.ok ? '/student' : loginPath,
    })

    if (!result.ok) {
      return {
        status: 'error',
        code: result.code,
        loginPath,
      }
    }

    return {
      status: 'student',
      redirectPath: '/student',
      matchedEmail: result.matchedEmail,
    }
  }

  const result = await resolveCoachAccessForUser(user)

  logOAuthResolution(result.ok ? 'callback resolved as coach' : 'callback failed during coach access check', {
    loginIntent,
    googleEmail: rawGoogleEmail,
    normalizedEmail: result.ok ? result.matchedEmail : result.normalizedEmail,
    coachQueryResults: summarizeCoachAccessRows(result.coachRows),
    finalReason: result.ok ? `coach:${result.source}` : result.code,
    redirectPath: result.ok ? '/coach' : loginPath,
  })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      loginPath,
    }
  }

  return {
    status: 'coach',
    redirectPath: '/coach',
    matchedEmail: result.matchedEmail,
  }
}
