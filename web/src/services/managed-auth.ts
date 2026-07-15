import 'server-only'

import type { SupabaseClient, User } from '@supabase/supabase-js'

const TEMP_PASSWORD_PREFIX = 'LAB33-'
const TEMP_PASSWORD_BODY_LENGTH = 14
const PASSWORD_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const PASSWORD_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const PASSWORD_DIGITS = '0123456789'
const PASSWORD_SYMBOLS = '!@#$%^&*'
const PASSWORD_ALPHABET = `${PASSWORD_UPPERCASE}${PASSWORD_LOWERCASE}${PASSWORD_DIGITS}${PASSWORD_SYMBOLS}`

export function normalizeManagedEmail(email: string) {
  return email.trim().toLowerCase()
}

export function generateTemporaryPassword() {
  const requiredCharacters = [
    randomCharacter(PASSWORD_UPPERCASE),
    randomCharacter(PASSWORD_LOWERCASE),
    randomCharacter(PASSWORD_DIGITS),
    randomCharacter(PASSWORD_SYMBOLS),
  ]
  const remainingCharacters = Array.from(
    crypto.getRandomValues(new Uint32Array(TEMP_PASSWORD_BODY_LENGTH - requiredCharacters.length)),
    (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length],
  )
  const body = shuffleCharacters([...requiredCharacters, ...remainingCharacters]).join('')
  return `${TEMP_PASSWORD_PREFIX}${body}`
}

function randomCharacter(alphabet: string) {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return alphabet[value % alphabet.length]
}

function shuffleCharacters(characters: string[]) {
  const randomValues = crypto.getRandomValues(new Uint32Array(characters.length))
  return characters
    .map((character, index) => ({ character, sort: randomValues[index] }))
    .sort((left, right) => left.sort - right.sort)
    .map((entry) => entry.character)
}

export async function listAuthUsersByEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeManagedEmail(email)

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const users = data.users ?? []
    const matched = users.find((user) => (user.email ?? '').trim().toLowerCase() === normalizedEmail)
    if (matched) return matched
    if (users.length < 100) break
  }

  return null
}

export async function listAllAuthUsersByEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeManagedEmail(email)
  const matchedUsers: User[] = []

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const users = data.users ?? []
    matchedUsers.push(...users.filter((user) => (user.email ?? '').trim().toLowerCase() === normalizedEmail))
    if (users.length < 100) break
  }

  return matchedUsers
}

export async function createPasswordAuthUser(
  admin: SupabaseClient,
  payload: {
    name: string
    email: string
    password: string
  },
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: normalizeManagedEmail(payload.email),
    password: payload.password,
    email_confirm: true,
    user_metadata: { name: payload.name },
  })

  if (error) throw error
  if (!data.user) {
    throw new Error('Auth user 建立失敗，沒有收到使用者資料。')
  }

  return data.user
}

export async function updatePasswordAuthUser(
  admin: SupabaseClient,
  userId: string,
  payload: {
    name?: string
    password: string
  },
) {
  const updatePayload: Parameters<typeof admin.auth.admin.updateUserById>[1] = {
    password: payload.password,
  }

  if (payload.name) {
    updatePayload.user_metadata = { name: payload.name }
  }

  const { data, error } = await admin.auth.admin.updateUserById(userId, updatePayload)

  if (error) throw error
  if (!data.user) {
    throw new Error('Auth user 更新失敗，沒有收到使用者資料。')
  }

  return data.user
}

export async function findAuthUserById(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId)

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('not found') || message.includes('user not found')) {
      return null
    }
    throw error
  }

  return data.user ?? null
}

export async function updateManagedAuthPassword(admin: SupabaseClient, userId: string, temporaryPassword: string) {
  const user = await findAuthUserById(admin, userId)
  if (!user) {
    throw new Error('找不到對應的 Supabase Auth user。')
  }

  return updatePasswordAuthUser(admin, userId, {
    password: temporaryPassword,
  })
}

export async function createOrReusePasswordAuthUser(
  admin: SupabaseClient,
  payload: {
    name: string
    email: string
    password: string
  },
): Promise<{ user: User; reusedExistingAuthUser: boolean }> {
  const existingAuthUser = await listAuthUsersByEmail(admin, payload.email)

  if (existingAuthUser) {
    return {
      user: existingAuthUser,
      reusedExistingAuthUser: true,
    }
  }

  const createdUser = await createPasswordAuthUser(admin, payload)
  return {
    user: createdUser,
    reusedExistingAuthUser: false,
  }
}
