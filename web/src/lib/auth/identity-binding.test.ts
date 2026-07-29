import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveIdentityBoundProfile } from './identity-binding'

type Profile = {
  email: string
  id: number
  user_id: string | null
}

const authenticatedUserId = 'auth-user-a'

test('a profile bound to the authenticated user id is accepted', () => {
  const profile: Profile = { id: 1, email: 'test@example.invalid', user_id: authenticatedUserId }

  assert.deepEqual(resolveIdentityBoundProfile([profile], authenticatedUserId), {
    status: 'matched',
    profile,
  })
})

test('a matching email with a different user id is not an authorization fallback', () => {
  const sameEmailDifferentUser: Profile = {
    id: 1,
    email: 'test@example.invalid',
    user_id: 'auth-user-b',
  }

  assert.deepEqual(resolveIdentityBoundProfile([sameEmailDifferentUser], authenticatedUserId), {
    status: 'missing',
    profile: null,
  })
})

test('an unbound profile is denied and is never mutated during resolution', () => {
  const unboundProfile: Profile = { id: 1, email: 'test@example.invalid', user_id: null }

  assert.deepEqual(resolveIdentityBoundProfile([unboundProfile], authenticatedUserId), {
    status: 'missing',
    profile: null,
  })
  assert.equal(unboundProfile.user_id, null)
})

test('a missing profile fails closed', () => {
  assert.deepEqual(resolveIdentityBoundProfile<Profile>([], authenticatedUserId), {
    status: 'missing',
    profile: null,
  })
})
