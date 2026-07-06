import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  coachDisplayName,
  type CoachDirectoryEntry,
  type CoachManagementSnapshot,
  type ManagedAthleteRecord,
} from '@/lib/types/coach-management'
import type { CoachProfile } from '@/services/coach'

const TEMP_PASSWORD_PREFIX = 'LAB33-'
const TEMP_PASSWORD_LENGTH = 12
const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

type CoachAthleteLink = {
  coach_id: number | null
  athlete_id: number | null
}

type AthleteRow = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  sport: string | null
  level: string | null
  must_change_password: boolean | null
}

type AdminMutationResult<T> = {
  data?: T
  error?: string
  message?: string
  tempPassword?: string
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function generateTempPassword() {
  const bytes = crypto.getRandomValues(new Uint32Array(TEMP_PASSWORD_LENGTH))
  const body = Array.from(bytes, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('')
  return `${TEMP_PASSWORD_PREFIX}${body}`
}

async function fetchCoachDirectory() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coaches')
    .select('id, user_id, name, email, is_head_coach')
    .order('name', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoachDirectoryEntry[]
}

async function fetchManagedAthleteRows(coach: CoachProfile) {
  const supabase = await createClient()

  if (coach.is_head_coach) {
    const { data, error } = await supabase
      .from('athletes')
      .select('id, user_id, name, email, sport, level, must_change_password')
      .order('name', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw error
    return (data ?? []) as AthleteRow[]
  }

  const { data: coachLinks, error: coachLinksError } = await supabase
    .from('coach_athletes')
    .select('athlete_id')
    .eq('coach_id', coach.id)

  if (coachLinksError) throw coachLinksError

  const athleteIds = (coachLinks ?? [])
    .map((row) => Number(row.athlete_id))
    .filter((value) => Number.isFinite(value))

  if (athleteIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('athletes')
    .select('id, user_id, name, email, sport, level, must_change_password')
    .in('id', athleteIds)
    .order('name', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteRow[]
}

async function fetchCoachAthleteLinks(athleteIds: number[]) {
  if (athleteIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_athletes')
    .select('coach_id, athlete_id')
    .in('athlete_id', athleteIds)

  if (error) throw error
  return (data ?? []) as CoachAthleteLink[]
}

function buildAssignmentLookup(athletes: AthleteRow[], coaches: CoachDirectoryEntry[], links: CoachAthleteLink[]) {
  const coachInfoById = new Map(
    coaches.map((coach) => [
      coach.id,
      {
        id: coach.id,
        label: coachDisplayName(coach),
        roleLabel: coach.is_head_coach ? '總教練' : '教練',
      } as const,
    ]),
  )

  return athletes.map((athlete) => {
    const assignedCoachIds: number[] = []
    const assignedCoachLabels: string[] = []
    const assignedCoachBadges: ManagedAthleteRecord['assignedCoachBadges'] = []

    for (const link of links) {
      if (Number(link.athlete_id) !== athlete.id) continue
      const coachId = Number(link.coach_id)
      if (!Number.isFinite(coachId) || assignedCoachIds.includes(coachId)) continue
      assignedCoachIds.push(coachId)
      const coachInfo = coachInfoById.get(coachId)
      if (!coachInfo) continue
      assignedCoachLabels.push(coachInfo.label)
      assignedCoachBadges.push(coachInfo)
    }

    return {
      ...athlete,
      assignedCoachIds,
      assignedCoachLabels,
      assignedCoachBadges,
    } satisfies ManagedAthleteRecord
  })
}

function prioritizeUnassignedAthletes(athletes: ManagedAthleteRecord[]) {
  return [...athletes].sort((left, right) => {
    const leftAssigned = left.assignedCoachIds.length > 0 ? 1 : 0
    const rightAssigned = right.assignedCoachIds.length > 0 ? 1 : 0
    if (leftAssigned !== rightAssigned) {
      return leftAssigned - rightAssigned
    }
    return left.id - right.id
  })
}

export async function getCoachManagementSnapshot(coach: CoachProfile): Promise<CoachManagementSnapshot> {
  const [coaches, athletes] = await Promise.all([fetchCoachDirectory(), fetchManagedAthleteRows(coach)])
  const athleteIds = athletes.map((athlete) => athlete.id)
  const links = await fetchCoachAthleteLinks(athleteIds)
  const hydratedAthletes = buildAssignmentLookup(athletes, coaches, links)

  return {
    athletes: coach.is_head_coach ? prioritizeUnassignedAthletes(hydratedAthletes) : hydratedAthletes,
    assignableCoaches: coaches.filter((entry) => entry.is_head_coach !== true),
  }
}

export async function getAssignableCoachDirectory() {
  const coaches = await fetchCoachDirectory()
  return coaches.filter((entry) => entry.is_head_coach !== true)
}

async function ensureServiceRoleClient() {
  const admin = createAdminClient()
  if (!admin) {
    return {
      admin: null,
      error: '尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法執行這個操作。',
    }
  }

  return { admin, error: null }
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

async function createAuthUserForAthlete(admin: SupabaseClient, name: string, email: string, tempPassword: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name },
  })

  if (error) throw error
  if (!data.user) {
    throw new Error('新增學員失敗，沒有收到 Auth user。')
  }

  return data.user
}

async function resetAthleteTempPassword(admin: SupabaseClient, userId: string, tempPassword: string) {
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  })

  if (error) throw error
  return data.user
}

async function createOrLinkAuthUserForAthlete(admin: SupabaseClient, name: string, email: string, tempPassword: string) {
  const existingAuthUser = await listAuthUsersByEmail(admin, email)
  if (existingAuthUser) {
    await resetAthleteTempPassword(admin, existingAuthUser.id, tempPassword)
    return {
      authUser: existingAuthUser,
      message: 'Supabase Authentication 裡已有此 Email，已連結並重設臨時密碼。',
    }
  }

  try {
    const authUser = await createAuthUserForAthlete(admin, name, email, tempPassword)
    return {
      authUser,
      message: '已建立新的 Supabase Auth 帳號，並產生臨時密碼。',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('already') && !message.includes('registered')) {
      throw error
    }

    const authUser = await listAuthUsersByEmail(admin, email)
    if (!authUser) {
      throw error
    }

    await resetAthleteTempPassword(admin, authUser.id, tempPassword)
    return {
      authUser,
      message: 'Supabase Authentication 裡已有此 Email，已連結並重設臨時密碼。',
    }
  }
}

async function hydrateSingleAthlete(athleteId: number) {
  const supabase = await createClient()
  const { data: athlete, error } = await supabase
    .from('athletes')
    .select('id, user_id, name, email, sport, level, must_change_password')
    .eq('id', athleteId)
    .maybeSingle()

  if (error) throw error
  if (!athlete) return null

  const [coaches, links] = await Promise.all([fetchCoachDirectory(), fetchCoachAthleteLinks([athleteId])])
  return buildAssignmentLookup([athlete as AthleteRow], coaches, links)[0] ?? null
}

export async function createAthleteForCoach(
  coach: CoachProfile,
  payload: {
    name: string
    email: string
    sport?: string
    level?: string
    assignedCoachIds?: number[]
  },
): Promise<AdminMutationResult<ManagedAthleteRecord>> {
  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const name = payload.name.trim()
  const email = normalizeEmail(payload.email)
  const sport = payload.sport?.trim() ?? ''
  const level = payload.level?.trim() ?? ''

  if (!name || !email) {
    return { error: '請先輸入學員姓名和 Email。' }
  }

  const { data: duplicateRows, error: duplicateError } = await admin
    .from('athletes')
    .select('id')
    .ilike('email', email)
    .limit(1)

  if (duplicateError) return { error: duplicateError.message }
  if ((duplicateRows ?? []).length > 0) {
    return { error: '這個 Email 已經存在，不能重複建立學員帳號。' }
  }

  const tempPassword = generateTempPassword()

  try {
    const { authUser, message } = await createOrLinkAuthUserForAthlete(admin, name, email, tempPassword)

    const { data: insertedAthlete, error: insertError } = await admin
      .from('athletes')
      .insert({
        name,
        email,
        sport,
        level,
        user_id: authUser.id,
        must_change_password: true,
      })
      .select('id')
      .single()

    if (insertError) {
      return { error: insertError.message }
    }

    const athleteId = Number(insertedAthlete.id)
    const requestedCoachIds = coach.is_head_coach
      ? Array.from(new Set((payload.assignedCoachIds ?? []).map(Number).filter((value) => Number.isFinite(value))))
      : [coach.id]

    if (requestedCoachIds.length > 0) {
      const assignableCoaches = await getAssignableCoachDirectory()
      const assignableCoachIds = new Set(assignableCoaches.map((entry) => entry.id))
      const validCoachIds = requestedCoachIds.filter((id) => assignableCoachIds.has(id))

      if (validCoachIds.length > 0) {
        const { error: assignmentError } = await admin.from('coach_athletes').insert(
          validCoachIds.map((coachId) => ({ coach_id: coachId, athlete_id: athleteId })),
        )

        if (assignmentError) {
          return { error: assignmentError.message }
        }
      }
    }

    const hydratedAthlete = await hydrateSingleAthlete(athleteId)
    if (!hydratedAthlete) {
      return { error: '學員已建立，但無法重新讀取資料。' }
    }

    return {
      data: hydratedAthlete,
      message: `${message} 已新增學員。`,
      tempPassword,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '新增學員失敗。',
    }
  }
}

export async function resetTemporaryPasswordForAthlete(
  athlete: ManagedAthleteRecord,
): Promise<AdminMutationResult<ManagedAthleteRecord>> {
  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const tempPassword = generateTempPassword()

  try {
    let authUserId = athlete.user_id
    let message = '已重設臨時密碼。'

    if (authUserId) {
      try {
        await resetAthleteTempPassword(admin, authUserId, tempPassword)
      } catch (error) {
        const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
        if (!text.includes('user not found')) {
          throw error
        }
        authUserId = null
      }
    }

    if (!authUserId) {
      const existingAuthUser = athlete.email ? await listAuthUsersByEmail(admin, athlete.email) : null
      if (existingAuthUser) {
        await resetAthleteTempPassword(admin, existingAuthUser.id, tempPassword)
        authUserId = existingAuthUser.id
        message = '已連結既有 Auth 帳號，並重設臨時密碼。'
      } else {
        if (!athlete.email) {
          return { error: '這位學員沒有 Email，無法建立或重設登入帳號。' }
        }
        const authUser = await createAuthUserForAthlete(admin, athlete.name ?? '', athlete.email, tempPassword)
        authUserId = authUser.id
        message = '已建立 Auth 帳號，並產生臨時密碼。'
      }
    }

    const { error: athleteUpdateError } = await admin
      .from('athletes')
      .update({ user_id: authUserId, must_change_password: true })
      .eq('id', athlete.id)

    if (athleteUpdateError) {
      return { error: athleteUpdateError.message }
    }

    const hydratedAthlete = await hydrateSingleAthlete(athlete.id)
    if (!hydratedAthlete) {
      return { error: '密碼已重設，但無法重新讀取學員資料。' }
    }

    return {
      data: hydratedAthlete,
      message,
      tempPassword,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '重設失敗。',
    }
  }
}

export async function deleteAthleteForCoach(
  athlete: ManagedAthleteRecord,
): Promise<AdminMutationResult<{ athleteId: number }>> {
  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  try {
    const { error: blocksDeleteError } = await admin.from('athlete_blocks').delete().eq('athlete_id', athlete.id)
    if (blocksDeleteError) {
      return { error: blocksDeleteError.message }
    }

    const { error: athleteDeleteError } = await admin.from('athletes').delete().eq('id', athlete.id)
    if (athleteDeleteError) {
      return { error: athleteDeleteError.message }
    }

    if (athlete.user_id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(athlete.user_id)
      if (authDeleteError) {
        const text = authDeleteError.message.toLowerCase()
        if (!text.includes('user not found')) {
          return { error: authDeleteError.message }
        }
        return {
          data: { athleteId: athlete.id },
          message: '學員資料已刪除；Supabase Auth 帳號原本就不存在，所以已略過 Auth 刪除。',
        }
      }
    }

    return {
      data: { athleteId: athlete.id },
      message: '已刪除學員。',
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '刪除學員失敗。',
    }
  }
}

export async function replaceAthleteCoachAssignments(
  athleteId: number,
  selectedCoachIds: number[],
): Promise<AdminMutationResult<ManagedAthleteRecord>> {
  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const assignableCoaches = await getAssignableCoachDirectory()
  const assignableCoachIds = new Set(assignableCoaches.map((entry) => entry.id))
  const validCoachIds = Array.from(new Set(selectedCoachIds.map(Number).filter((value) => assignableCoachIds.has(value))))

  const { error: deleteError } = await admin.from('coach_athletes').delete().eq('athlete_id', athleteId)
  if (deleteError) {
    return { error: deleteError.message }
  }

  if (validCoachIds.length > 0) {
    const { error: insertError } = await admin.from('coach_athletes').insert(
      validCoachIds.map((coachId) => ({ coach_id: coachId, athlete_id: athleteId })),
    )

    if (insertError) {
      return { error: insertError.message }
    }
  }

  const hydratedAthlete = await hydrateSingleAthlete(athleteId)
  if (!hydratedAthlete) {
    return { error: '已更新指派，但無法重新讀取學員資料。' }
  }

  return {
    data: hydratedAthlete,
    message: '已更新教練指派。',
  }
}

export async function getAccessibleManagedAthleteForCoach(coach: CoachProfile, athleteId: number) {
  const snapshot = await getCoachManagementSnapshot(coach)
  return snapshot.athletes.find((athlete) => athlete.id === athleteId) ?? null
}
