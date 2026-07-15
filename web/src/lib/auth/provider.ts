import type { User } from '@supabase/supabase-js'

export type AuthProvider = 'google' | 'email' | 'unknown'

export function normalizeAuthEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null
}

export function getAuthProviderForUser(user?: Pick<User, 'app_metadata' | 'identities'> | null): AuthProvider {
  const provider = typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider.trim().toLowerCase() : ''

  if (provider === 'google') {
    return 'google'
  }

  if (provider === 'email') {
    return 'email'
  }

  const identityProviders = Array.isArray(user?.identities)
    ? user.identities
        .map((identity) => String(identity.provider ?? '').trim().toLowerCase())
        .filter(Boolean)
    : []

  if (identityProviders.includes('google')) {
    return 'google'
  }

  if (identityProviders.includes('email')) {
    return 'email'
  }

  return 'unknown'
}

export function getAuthProviderNames(user?: Pick<User, 'app_metadata' | 'identities'> | null) {
  const providers = new Set<string>()
  const metadataProvider =
    typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider.trim().toLowerCase() : ''

  if (metadataProvider) {
    providers.add(metadataProvider)
  }

  if (Array.isArray(user?.identities)) {
    user.identities.forEach((identity) => {
      const provider = String(identity.provider ?? '').trim().toLowerCase()
      if (provider) {
        providers.add(provider)
      }
    })
  }

  return Array.from(providers)
}

export function isGoogleAuthUser(user?: Pick<User, 'app_metadata' | 'identities'> | null) {
  return getAuthProviderForUser(user) === 'google'
}
