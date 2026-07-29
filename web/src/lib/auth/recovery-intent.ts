import 'server-only'

import { serverEnv } from '@/lib/env.server'

import {
  RECOVERY_INTENT_MAX_AGE_SECONDS,
  createRecoveryIntentValue,
  hasValidRecoveryIntentValue,
} from './recovery-intent-core'

export const RECOVERY_INTENT_COOKIE = 'lab33_recovery_intent'

export const recoveryIntentCookieOptions = {
  httpOnly: true,
  maxAge: RECOVERY_INTENT_MAX_AGE_SECONDS,
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
}

export function createRecoveryIntent(userId: string) {
  if (!serverEnv.supabaseServiceRoleKey) return null
  return createRecoveryIntentValue(serverEnv.supabaseServiceRoleKey, userId)
}

export function hasValidRecoveryIntent(value: string | undefined, userId: string | undefined) {
  if (!serverEnv.supabaseServiceRoleKey) return false
  return hasValidRecoveryIntentValue(value, serverEnv.supabaseServiceRoleKey, userId)
}
