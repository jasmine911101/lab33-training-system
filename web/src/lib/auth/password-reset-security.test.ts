import assert from 'node:assert/strict'
import test from 'node:test'

import { passwordChangeRequiredError, requiresPasswordChange } from './password-gate.js'
import {
  canCoachResetManagedAthlete,
  canHeadCoachResetCoach,
  mustRevokeTargetSessionsAfterPasswordReset,
} from './password-reset-authorization.js'
import { shouldFailClosedForDeniedPasswordResetAudit } from './password-reset-denial-core.js'
import { createPasswordResetAuditRow } from './password-reset-audit-row.js'

const baseContext = {
  user: {} as never,
  role: 'coach' as const,
  coachProfile: {
    id: 1,
    user_id: 'coach-user',
    name: 'Coach',
    email: 'coach@example.test',
    is_head_coach: false,
    must_change_password: false,
  },
  studentProfile: null,
  hasCoachAccess: true,
  hasStudentAccess: false,
  authProvider: 'email' as const,
  isGoogleSession: false,
}

test('coach can reset only an assigned athlete', () => {
  assert.equal(canCoachResetManagedAthlete({ hasCoachAccess: true, targetIsManaged: true }), true)
  assert.equal(canCoachResetManagedAthlete({ hasCoachAccess: true, targetIsManaged: false }), false)
})

test('student-equivalent caller cannot reset an athlete password', () => {
  assert.equal(canCoachResetManagedAthlete({ hasCoachAccess: false, targetIsManaged: true }), false)
})

test('only a head coach can reset another coach password', () => {
  assert.equal(canHeadCoachResetCoach({ actorIsHeadCoach: true, actorCoachId: 1, targetCoachId: 2 }), true)
  assert.equal(canHeadCoachResetCoach({ actorIsHeadCoach: false, actorCoachId: 1, targetCoachId: 2 }), false)
  assert.equal(canHeadCoachResetCoach({ actorIsHeadCoach: true, actorCoachId: 1, targetCoachId: 1 }), false)
})

test('a successful temporary reset requires target session revocation', () => {
  assert.equal(mustRevokeTargetSessionsAfterPasswordReset(true), true)
  assert.equal(mustRevokeTargetSessionsAfterPasswordReset(false), false)
})

test('must-change-password blocks protected API access until it is cleared', () => {
  assert.equal(requiresPasswordChange({ ...baseContext, coachProfile: { ...baseContext.coachProfile, must_change_password: true } }), true)
  assert.equal(requiresPasswordChange(baseContext), false)
  assert.equal(passwordChangeRequiredError().code, 'password-change-required')
})

test('audit row has required metadata and never includes a password field', () => {
  const row = createPasswordResetAuditRow({
    action: 'temporary_password_reset',
    actorUserId: 'actor',
    targetUserId: 'target',
    targetType: 'athlete',
    reason: 'coach-assisted-password-reset',
    success: true,
  })
  assert.deepEqual(Object.keys(row).sort(), ['action', 'actor_user_id', 'reason', 'success', 'target_type', 'target_user_id'])
  assert.equal('password' in row, false)
})

test('denied reset attempt audit uses success=false and the attempt action', () => {
  const row = createPasswordResetAuditRow({
    action: 'temporary_password_reset_attempt',
    actorUserId: 'actor',
    targetUserId: 'target',
    targetType: 'coach',
    reason: 'authorization-denied',
    success: false,
  })
  assert.equal(row.success, false)
  assert.equal(row.action, 'temporary_password_reset_attempt')
  assert.equal('password' in row, false)
})

test('audit failure fails closed, while an unavailable target keeps the opaque denial response', () => {
  assert.equal(shouldFailClosedForDeniedPasswordResetAudit('failed'), true)
  assert.equal(shouldFailClosedForDeniedPasswordResetAudit('recorded'), false)
  assert.equal(shouldFailClosedForDeniedPasswordResetAudit('target-unavailable'), false)

  let resetExecuted = false
  if (!shouldFailClosedForDeniedPasswordResetAudit('failed')) {
    resetExecuted = true
  }
  assert.equal(resetExecuted, false)
})
