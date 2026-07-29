import { NextResponse } from 'next/server'

import {
  auditDeniedPasswordResetAttempt,
  type PasswordResetAuditTargetType,
} from '@/services/password-reset-audit'
import { shouldFailClosedForDeniedPasswordResetAudit } from '@/lib/auth/password-reset-denial-core'

type DeniedPasswordResetInput = {
  actorUserId: string | null | undefined
  reason: string
  response: NextResponse
  targetId: number
  targetType: PasswordResetAuditTargetType
}

export function passwordResetAuditFailureResponse() {
  return NextResponse.json({ error: '系統暫時無法處理此操作，請稍後再試。' }, { status: 500 })
}

/**
 * A basic authenticated actor is audited before returning a policy denial.
 * Missing/unbound targets remain opaque because the database audit schema does
 * not permit a fabricated target_user_id.
 */
export async function returnDeniedPasswordResetWithAudit(input: DeniedPasswordResetInput) {
  if (!input.actorUserId) return input.response

  const result = await auditDeniedPasswordResetAttempt({
    actorUserId: input.actorUserId,
    reason: input.reason,
    targetId: input.targetId,
    targetType: input.targetType,
  })

  return shouldFailClosedForDeniedPasswordResetAudit(result)
    ? passwordResetAuditFailureResponse()
    : input.response
}
