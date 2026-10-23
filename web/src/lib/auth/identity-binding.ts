export type IdentityBoundProfile = {
  user_id: string | null
}

export type IdentityBindingResolution<T extends IdentityBoundProfile> =
  | { status: 'matched'; profile: T }
  | { status: 'missing'; profile: null }
  | { status: 'conflict'; profile: null }

/**
 * 用登入系統提供的使用者 ID，找出對應的教練或學員資料。
 * T 代表「傳進來的資料型別」：回傳時保留資料原本的欄位。
 * 不使用 Email 配對，因為 Email 可以修改，不能拿來代替身分綁定。
 */
export function resolveIdentityBoundProfile<T extends IdentityBoundProfile>(
  profiles: readonly T[],
  authenticatedUserId: string | null | undefined,
): IdentityBindingResolution<T> {
  if (!authenticatedUserId) {
    return { status: 'missing', profile: null }
  }

  // filter 會建立新清單，只留下 user_id 相同的資料，不修改原清單。
  const matchingProfiles = profiles.filter((profile) => profile.user_id === authenticatedUserId)
  if (matchingProfiles.length === 1) {
    return { status: 'matched', profile: matchingProfiles[0] }
  }

  if (matchingProfiles.length === 0) {
    return { status: 'missing', profile: null }
  }

  // 超過一筆代表綁定衝突，不能任選一筆來授權。
  return { status: 'conflict', profile: null }
}
