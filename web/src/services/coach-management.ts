import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  coachDisplayName,
  type CoachDirectoryEntry,
  type CoachManagementSnapshot,
  type ManagedAthleteRecord,
  type ManagedCoachRecord,
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

type CoachDeleteResult = {
  coachId: number
  unassignedAthleteCount: number
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
    .select('id, user_id, name, email, is_head_coach, created_at')
    .order('name', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as CoachDirectoryEntry[]
}

async function fetchAllCoachAthleteLinks() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coach_athletes')
    .select('coach_id, athlete_id')

  if (error) throw error
  return (data ?? []) as CoachAthleteLink[]
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

function buildManagedCoachRecords(coaches: CoachDirectoryEntry[], links: CoachAthleteLink[]) {
  const managedAthleteCountByCoachId = new Map<number, number>()

  for (const link of links) {
    const coachId = Number(link.coach_id)
    const athleteId = Number(link.athlete_id)
    if (!Number.isFinite(coachId) || !Number.isFinite(athleteId)) continue
    managedAthleteCountByCoachId.set(coachId, (managedAthleteCountByCoachId.get(coachId) ?? 0) + 1)
  }

  return [...coaches]
    .map(
      (coach) =>
        ({
          ...coach,
          managedAthleteCount: managedAthleteCountByCoachId.get(coach.id) ?? 0,
        }) satisfies ManagedCoachRecord,
    )
    .sort((left, right) => {
      if (left.is_head_coach !== right.is_head_coach) {
        return left.is_head_coach ? -1 : 1
      }

      return coachDisplayName(left).localeCompare(coachDisplayName(right), 'zh-Hant')
    })
}

export async function getCoachManagementSnapshot(coach: CoachProfile): Promise<CoachManagementSnapshot> {
  const [coaches, athletes] = await Promise.all([fetchCoachDirectory(), fetchManagedAthleteRows(coach)])
  const athleteIds = athletes.map((athlete) => athlete.id)
  const [links, allLinks] = await Promise.all([fetchCoachAthleteLinks(athleteIds), fetchAllCoachAthleteLinks()])
  const hydratedAthletes = buildAssignmentLookup(athletes, coaches, links)

  return {
    athletes: coach.is_head_coach ? prioritizeUnassignedAthletes(hydratedAthletes) : hydratedAthletes,
    assignableCoaches: coaches.filter((entry) => entry.is_head_coach !== true),
    coaches: coach.is_head_coach ? buildManagedCoachRecords(coaches, allLinks) : [],
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

async function resetAthleteTempPassword(admin: SupabaseClient, userId: string, tempPassword: string) {
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  })

  if (error) throw error
  return data.user
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
    assignedCoachId?: number | null
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

  try {
    const { data: insertedAthlete, error: insertError } = await admin
      .from('athletes')
      .insert({
        name,
        email,
        sport,
        level,
        user_id: null,
        must_change_password: false,
      })
      .select('id')
      .single()

    if (insertError) {
      return { error: insertError.message }
    }

    const athleteId = Number(insertedAthlete.id)
    const requestedCoachId = coach.is_head_coach
      ? (payload.assignedCoachId != null && Number.isFinite(Number(payload.assignedCoachId)) ? Number(payload.assignedCoachId) : null)
      : coach.id

    if (requestedCoachId != null) {
      const assignableCoaches = await getAssignableCoachDirectory()
      const assignableCoachIds = new Set(assignableCoaches.map((entry) => entry.id))
      const validCoachId = assignableCoachIds.has(requestedCoachId) ? requestedCoachId : null

      if (validCoachId != null) {
        const { error: assignmentError } = await admin.from('coach_athletes').insert({
          coach_id: validCoachId,
          athlete_id: athleteId,
        })

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
      message: '已新增學員。學員之後請直接使用這個 Email 透過 Google 登入，系統會在第一次登入時自動綁定帳號。',
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
        return {
          error: '這位學員目前沒有可重設的 password 帳號。Google 登入學員不會自動建立臨時密碼帳號。',
        }
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

    return {
      data: { athleteId: athlete.id },
      message: '已刪除學員資料；既有 Supabase Auth user 會保留，不會被系統自動刪除。',
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '刪除學員失敗。',
    }
  }
}

export async function replaceAthleteCoachAssignments(
  athleteId: number,
  selectedCoachId: number | null,
): Promise<AdminMutationResult<ManagedAthleteRecord>> {
  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const assignableCoaches = await getAssignableCoachDirectory()
  const assignableCoachIds = new Set(assignableCoaches.map((entry) => entry.id))
  const normalizedCoachId =
    selectedCoachId != null && Number.isFinite(Number(selectedCoachId)) && assignableCoachIds.has(Number(selectedCoachId))
      ? Number(selectedCoachId)
      : null

  const { error: deleteError } = await admin.from('coach_athletes').delete().eq('athlete_id', athleteId)
  if (deleteError) {
    return { error: deleteError.message }
  }

  if (normalizedCoachId != null) {
    const { error: insertError } = await admin.from('coach_athletes').insert({
      coach_id: normalizedCoachId,
      athlete_id: athleteId,
    })

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

export async function createCoachForHeadCoach(
  actor: CoachProfile,
  payload: {
    name: string
    email: string
  },
): Promise<AdminMutationResult<ManagedCoachRecord>> {
  if (!actor.is_head_coach) {
    return { error: '只有總教練可以新增教練。' }
  }

  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const name = payload.name.trim()
  const email = normalizeEmail(payload.email)

  if (!name || !email) {
    return { error: '請先輸入教練姓名和 Google Email。' }
  }

  const { data: duplicateRows, error: duplicateError } = await admin
    .from('coaches')
    .select('id')
    .ilike('email', email)
    .limit(1)

  if (duplicateError) return { error: duplicateError.message }
  if ((duplicateRows ?? []).length > 0) {
    return { error: '這個 Email 已經存在，不能重複建立教練。' }
  }

  const { data: insertedCoach, error: insertError } = await admin
    .from('coaches')
    .insert({
      name,
      email,
      user_id: null,
      is_head_coach: false,
    })
    .select('id, user_id, name, email, is_head_coach, created_at')
    .single()

  if (insertError) {
    return { error: insertError.message }
  }

  return {
    data: {
      ...(insertedCoach as CoachDirectoryEntry),
      managedAthleteCount: 0,
    },
    message: '已新增教練。這位教練之後請使用這個 Google Email 登入，系統會在第一次登入時自動綁定 user_id。',
  }
}

export async function updateCoachForHeadCoach(
  actor: CoachProfile,
  coachId: number,
  payload: {
    name: string
    email: string
  },
): Promise<AdminMutationResult<ManagedCoachRecord>> {
  if (!actor.is_head_coach) {
    return { error: '只有總教練可以編輯教練資料。' }
  }

  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const name = payload.name.trim()
  const email = normalizeEmail(payload.email)

  if (!name || !email) {
    return { error: '請先輸入教練姓名和 Google Email。' }
  }

  const { data: currentCoach, error: currentCoachError } = await admin
    .from('coaches')
    .select('id, user_id, name, email, is_head_coach, created_at')
    .eq('id', coachId)
    .maybeSingle()

  if (currentCoachError) return { error: currentCoachError.message }
  if (!currentCoach) return { error: '找不到這位教練。' }

  const { data: duplicateRows, error: duplicateError } = await admin
    .from('coaches')
    .select('id')
    .ilike('email', email)
    .neq('id', coachId)
    .limit(1)

  if (duplicateError) return { error: duplicateError.message }
  if ((duplicateRows ?? []).length > 0) {
    return { error: '這個 Email 已經被其他教練使用。' }
  }

  const { data: updatedCoach, error: updateError } = await admin
    .from('coaches')
    .update({
      name,
      email,
    })
    .eq('id', coachId)
    .select('id, user_id, name, email, is_head_coach, created_at')
    .single()

  if (updateError) {
    return { error: updateError.message }
  }

  const { count, error: countError } = await admin
    .from('coach_athletes')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)

  if (countError) {
    return { error: countError.message }
  }

  const needsRebindNotice = Boolean(currentCoach.user_id) && normalizeEmail(currentCoach.email ?? '') !== email

  return {
    data: {
      ...(updatedCoach as CoachDirectoryEntry),
      managedAthleteCount: count ?? 0,
    },
    message: needsRebindNotice
      ? '已更新教練資料。由於這位教練已綁定 Google，之後需要使用新的 Google Email 重新登入。'
      : '已更新教練資料。',
  }
}

export async function deleteCoachForHeadCoach(
  actor: CoachProfile,
  coachId: number,
): Promise<AdminMutationResult<CoachDeleteResult>> {
  if (!actor.is_head_coach) {
    return { error: '只有總教練可以刪除教練。' }
  }

  if (actor.id === coachId) {
    return { error: '目前不支援刪除正在登入的總教練帳號。' }
  }

  const { admin, error: adminError } = await ensureServiceRoleClient()
  if (!admin) return { error: adminError ?? '缺少 service role。' }

  const { data: targetCoach, error: coachLookupError } = await admin
    .from('coaches')
    .select('id, user_id, email, is_head_coach')
    .eq('id', coachId)
    .maybeSingle()

  if (coachLookupError) {
    return { error: coachLookupError.message }
  }

  if (!targetCoach) {
    return { error: '找不到這位教練。' }
  }

  if (Number(targetCoach.id) === actor.id) {
    return { error: '不能刪除目前登入中的自己。' }
  }

  const { data: assignmentLinks, error: assignmentLookupError } = await admin
    .from('coach_athletes')
    .select('id, athlete_id')
    .eq('coach_id', coachId)

  if (assignmentLookupError) {
    return { error: assignmentLookupError.message }
  }

  const assignedAthleteIds = (assignmentLinks ?? [])
    .map((link) => Number(link.athlete_id))
    .filter((value) => Number.isFinite(value))

  const assignedAthleteCount = assignedAthleteIds.length

  let authDeletionSkippedMissingUser = false

  if (targetCoach.user_id) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(targetCoach.user_id)

    if (authDeleteError) {
      const normalizedMessage = authDeleteError.message.toLowerCase()
      const canContinue =
        normalizedMessage.includes('not found') ||
        normalizedMessage.includes('user not found') ||
        normalizedMessage.includes('already been deleted')

      if (!canContinue) {
        console.error('[LAB33][CoachDelete] auth user deletion failed', {
          coachId: targetCoach.id,
          email: targetCoach.email,
          userId: targetCoach.user_id,
          assignedAthleteCount,
          completedSteps: [],
          error: authDeleteError.message,
        })
        return { error: `刪除登入帳號失敗：${authDeleteError.message}` }
      }

      authDeletionSkippedMissingUser = true
      console.info('[LAB33][CoachDelete] auth user already missing, continue cleanup', {
        coachId: targetCoach.id,
        email: targetCoach.email,
        userId: targetCoach.user_id,
      })
    }
  }

  const { error: relationDeleteError } = await admin
    .from('coach_athletes')
    .delete()
    .eq('coach_id', coachId)

  if (relationDeleteError) {
    console.error('[LAB33][CoachDelete] failed after auth deletion while removing coach_athletes', {
      coachId: targetCoach.id,
      email: targetCoach.email,
      userId: targetCoach.user_id,
      assignedAthleteIds,
      completedSteps: ['auth:user:deleted-or-missing'],
      error: relationDeleteError.message,
    })
    return {
      error:
        '登入帳號已處理，但移除學員指派失敗。請保留這位教練資料並檢查 server log 後再人工處理。',
    }
  }

  const { error: deleteError } = await admin.from('coaches').delete().eq('id', coachId)
  if (deleteError) {
    console.error('[LAB33][CoachDelete] failed after auth deletion and unassignment while deleting coach row', {
      coachId: targetCoach.id,
      email: targetCoach.email,
      userId: targetCoach.user_id,
      assignedAthleteIds,
      completedSteps: ['auth:user:deleted-or-missing', 'coach_athletes:deleted'],
      error: deleteError.message,
    })
    return {
      error:
        '登入帳號與學員指派已處理，但刪除教練資料失敗。請查看 server log，確認 `public.coaches` 是否需要人工清理。',
    }
  }

  return {
    data: {
      coachId,
      unassignedAthleteCount: assignedAthleteCount,
    },
    message: authDeletionSkippedMissingUser
      ? `教練已刪除，${assignedAthleteCount} 位學員已改為未指派。原登入帳號原本已不存在，系統已完成 public 資料清理。`
      : `教練已刪除，${assignedAthleteCount} 位學員已改為未指派。`,
  }
}
