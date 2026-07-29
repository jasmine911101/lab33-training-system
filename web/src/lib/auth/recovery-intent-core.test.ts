import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSafeCallbackNext } from './callback-redirect.js'
import {
  RECOVERY_INTENT_MAX_AGE_SECONDS,
  createRecoveryIntentValue,
  hasValidRecoveryIntentValue,
} from './recovery-intent-core.js'

const secret = 'test-only-signing-secret'
const userId = '11111111-1111-1111-1111-111111111111'
const now = Date.UTC(2026, 6, 23, 0, 0, 0)

test('PKCE callback-created intent makes reset page ready for its authenticated user', () => {
  const intent = createRecoveryIntentValue(secret, userId, now, 'callback-nonce')
  assert.equal(hasValidRecoveryIntentValue(intent, secret, userId, now), true)
})

test('intent without an authenticated session is denied', () => {
  const intent = createRecoveryIntentValue(secret, userId, now, 'no-session')
  assert.equal(hasValidRecoveryIntentValue(intent, secret, undefined, now), false)
})

test('an authenticated session without recovery intent is denied', () => {
  assert.equal(hasValidRecoveryIntentValue(undefined, secret, userId, now), false)
})

test('expired or tampered recovery values are denied', () => {
  const intent = createRecoveryIntentValue(secret, userId, now, 'expired')
  assert.equal(
    hasValidRecoveryIntentValue(intent, secret, userId, now + (RECOVERY_INTENT_MAX_AGE_SECONDS + 1) * 1000),
    false,
  )
  assert.equal(hasValidRecoveryIntentValue(`${intent}x`, secret, userId, now), false)
})

test('cleared intent cannot be reused after a successful password update', () => {
  const intent = createRecoveryIntentValue(secret, userId, now, 'one-time')
  assert.equal(hasValidRecoveryIntentValue(intent, secret, userId, now), true)
  assert.equal(hasValidRecoveryIntentValue(undefined, secret, userId, now), false)
})

test('arbitrary callback redirects are rejected', () => {
  assert.equal(resolveSafeCallbackNext('https://attacker.example'), '/coach/login')
  assert.equal(resolveSafeCallbackNext('//attacker.example'), '/coach/login')
  assert.equal(resolveSafeCallbackNext('/student'), '/student')
})
