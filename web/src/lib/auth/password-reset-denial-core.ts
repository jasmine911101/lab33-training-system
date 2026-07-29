export type DeniedPasswordResetAuditResult =
  | 'recorded'
  | 'target-unavailable'
  | 'failed'

export function shouldFailClosedForDeniedPasswordResetAudit(result: DeniedPasswordResetAuditResult) {
  return result === 'failed'
}
