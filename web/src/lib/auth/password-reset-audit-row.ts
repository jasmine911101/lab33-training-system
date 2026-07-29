export type PasswordResetAuditRowInput = {
  action: 'temporary_password_reset' | 'temporary_password_reset_attempt'
  actorUserId: string
  reason: string
  success: boolean
  targetType: 'athlete' | 'coach'
  targetUserId: string
}

export function createPasswordResetAuditRow(input: PasswordResetAuditRowInput) {
  return {
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId,
    target_type: input.targetType,
    action: input.action,
    reason: input.reason,
    success: input.success,
  }
}
