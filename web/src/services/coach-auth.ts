import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { serverEnv } from '@/lib/env.server'
import { createAdminClient } from '@/lib/supabase/admin'

const MIN_PASSWORD_LENGTH = 6

type AdminMutationResult<T> = {
  data?: T
  error?: string
  message?: string
}

type RegisterCoachPayload = {
  name: string
  email: string
  password: string
  confirmPassword: string
  inviteCode: string
}

type CreatedCoach = {
  email: string
  userId: string
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function listAuthUsersByEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = normalizeEmail(email)

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error

    const users = data.users ?? []
    const matched = users.find((user) => (user.email ?? '').toLowerCase() === normalizedEmail)
    if (matched) return matched
    if (users.length < 100) break
  }

  return null
}

async function findCoachProfileByEmail(email: string) {
  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin
    .from('coaches')
    .select('id')
    .eq('email', normalizeEmail(email))
    .maybeSingle()

  if (error) throw error
  return data
}

export function getCoachRegistrationAvailability() {
  return {
    inviteCodeConfigured: Boolean(serverEnv.coachInviteCode),
    serviceRoleConfigured: Boolean(serverEnv.supabaseServiceRoleKey),
  }
}

export async function registerCoachAccount(payload: RegisterCoachPayload): Promise<AdminMutationResult<CreatedCoach>> {
  const availability = getCoachRegistrationAvailability()
  if (!availability.inviteCodeConfigured) {
    return { error: '目前未開放教練自助註冊。請先設定 COACH_INVITE_CODE。' }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: '尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法建立教練帳號。' }
  }

  const name = payload.name.trim()
  const email = normalizeEmail(payload.email)
  const password = payload.password
  const confirmPassword = payload.confirmPassword
  const inviteCode = payload.inviteCode.trim()

  if (!name || !email) {
    return { error: '請先輸入姓名和 Email。' }
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password 至少需要 ${MIN_PASSWORD_LENGTH} 碼。` }
  }

  if (password !== confirmPassword) {
    return { error: '兩次輸入的 Password 不一致。' }
  }

  if (inviteCode !== serverEnv.coachInviteCode) {
    return { error: '教練邀請碼不正確。' }
  }

  const existingCoach = await findCoachProfileByEmail(email)
  if (existingCoach) {
    return { error: '這個 Email 已經是教練帳號，請直接登入。' }
  }

  const existingAuthUser = await listAuthUsersByEmail(admin, email)
  if (existingAuthUser) {
    return { error: '這個 Email 已經註冊過 Auth 帳號，請直接登入。' }
  }

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (error) {
      return { error: error.message }
    }

    if (!data.user) {
      return { error: '註冊失敗，沒有收到使用者資料。' }
    }

    const { error: insertCoachError } = await admin.from('coaches').insert({
      name,
      email,
      user_id: data.user.id,
      is_head_coach: serverEnv.headCoachEmails.includes(email),
    })

    if (insertCoachError) {
      return { error: insertCoachError.message }
    }

    return {
      data: {
        email,
        userId: data.user.id,
      },
      message: '教練帳號已建立。',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (message.includes('duplicate') || message.includes('already')) {
      return { error: '這個 Email 已經註冊過，請直接登入。' }
    }

    return {
      error: error instanceof Error ? error.message : '建立教練帳號失敗。',
    }
  }
}
