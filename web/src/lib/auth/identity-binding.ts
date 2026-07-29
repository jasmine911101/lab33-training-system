export type IdentityBoundProfile = {
  user_id: string | null
}

export type IdentityBindingResolution<T extends IdentityBoundProfile> =
  | { status: 'matched'; profile: T }
  | { status: 'missing'; profile: null }
  | { status: 'conflict'; profile: null }

/**
 * Resolves a profile exclusively from the authenticated user's immutable Auth
 * identifier. Email is deliberately not an input: it is mutable account data,
 * not an authorization binding.
 */
export function resolveIdentityBoundProfile<T extends IdentityBoundProfile>(
  profiles: readonly T[],
  authenticatedUserId: string | null | undefined,
): IdentityBindingResolution<T> {
  if (!authenticatedUserId) return { status: 'missing', profile: null }

  const matchingProfiles = profiles.filter((profile) => profile.user_id === authenticatedUserId)
  if (matchingProfiles.length === 1) {
    return { status: 'matched', profile: matchingProfiles[0] }
  }

  return matchingProfiles.length === 0
    ? { status: 'missing', profile: null }
    : { status: 'conflict', profile: null }
}
