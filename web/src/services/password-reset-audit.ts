import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createPasswordResetAuditRow, type PasswordResetAuditRowInput } from '@/lib/auth/password-reset-audit-row'
import type { DeniedPasswordResetAuditResult } from '@/lib/auth/password-reset-denial-core'
import { createAdminClient } from '@/lib/supabase/admin'

export type PasswordResetAuditInput = PasswordResetAuditRowInput
export type PasswordResetAuditTargetType = PasswordResetAuditInput['targetType']

type DeniedPasswordResetAuditInput = {
  actorUserId: string
  reason: string
  targetId: number
  targetType: PasswordResetAuditTargetType
}

export function normalizePasswordResetReason(reason: unknown) {
  const normalized = typeof reason === 'string' ? reason.trim().replace(/\s+/g, ' ') : ''
  return normalized.slice(0, 500) || 'coach-assisted-password-reset'
}

export async function recordPasswordResetAudit(
  admin: SupabaseClient,
  input: PasswordResetAuditInput,
) {
  const { error } = await admin.from('security_password_reset_audit').insert(createPasswordResetAuditRow(input))

  if (error) throw error
}

/**
 * Records a rejected request only when the target is safely resolvable to an
 * existing, bound Auth user. The audit table deliberately has a non-null
 * target_user_id, so a missing or unbound target cannot be represented without
 * inventing an identity. Callers must retain their opaque 403/404 response for
 * `target-unavailable` to avoid target enumeration.
 */
export async function auditDeniedPasswordResetAttempt(
  input: DeniedPasswordResetAuditInput,
): Promise<DeniedPasswordResetAuditResult> {
  const admin = createAdminClient()
  if (!admin) return 'failed'

  const table = input.targetType === 'athlete' ? 'athletes' : 'coaches'
  const { data: target, error: targetError } = await admin
    .from(table)
    .select('user_id')
    .eq('id', input.targetId)
    .maybeSingle()

  if (targetError) return 'failed'
  if (!target?.user_id) return 'target-unavailable'

  try {
    await recordPasswordResetAudit(admin, {
      action: 'temporary_password_reset_attempt',
      actorUserId: input.actorUserId,
      targetUserId: target.user_id,
      targetType: input.targetType,
      reason: input.reason,
      success: false,
    })
    return 'recorded'
  } catch {
    return 'failed'
  }
}
