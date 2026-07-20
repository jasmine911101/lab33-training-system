import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ProductManagementSnapshot } from '@/lib/types/commerce'
import type {
  AssignProductVersionPayload,
  StudentTeamProgramDetail,
  StudentTeamProgramSession,
  StudentTeamProgramSummary,
  TeamEnrollmentRecord,
  TeamManagementSnapshot,
  TeamMembershipRecord,
  TeamMembershipStatus,
  TeamOption,
  TeamProgramRecord,
  TeamProgramSessionRecord,
  TeamProgramsSnapshot,
  TeamResultStatus,
  TeamSessionStatus,
  TeamProgramStatus,
  TeamEnrollmentStatus,
  TeamCoachRecord,
  TeamCoachRole,
  TeamCoachStatus,
  TeamRecord,
} from '@/lib/types/team-programs'
import type { CoachProfile } from '@/services/coach'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

type MutationResult<T> = { data?: T; error?: string; message?: string }

type TeamRow = {
  id: number
  name: string
  description: string | null
  sport_type: string | null
  created_by: number
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type AthleteRow = { id: number; name: string | null; email: string | null; sport?: string | null }
type CoachRow = { id: number; name: string | null; email: string | null; is_head_coach?: boolean | null }
type MembershipRow = { id: number; team_id: number; athlete_id: number; status: string; joined_at: string | null; left_at: string | null; created_at: string | null }
type TeamCoachRow = {
  id: number
  team_id: number
  coach_id: number
  role: string
  can_manage_roster: boolean | null
  can_manage_programs: boolean | null
  can_view_results: boolean | null
  status: string
  assigned_by: number | null
  created_at: string | null
  updated_at: string | null
  removed_at: string | null
}
type EnrollmentRow = {
  id: number
  team_id: number
  product_id: number
  product_version_id: number
  assigned_by: number
  start_date: string
  end_date: string | null
  seat_limit: number | null
  status: string
  access_mode: string | null
  created_at: string | null
  activated_at: string | null
  ended_at: string | null
  cancelled_at: string | null
}
type ProductRow = { id: number; name: string }
type VersionRow = { id: number; product_id: number; version_number: number; status: string | null; snapshot_name: string }
type ProgramRow = {
  id: number
  team_product_enrollment_id: number
  team_id: number
  product_version_id: number
  name: string
  start_date: string
  end_date: string | null
  timezone: string
  status: string
  source_snapshot_json: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}
type SessionRow = {
  id: number
  team_program_instance_id: number
  source_product_block_id: number
  source_block_id: number
  title: string
  scheduled_date: string | null
  week_number: number | null
  day_number: number | null
  sort_order: number | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}
type BlockRow = { id: number; block_code: string | null; block_name: string | null }
type ResultRow = {
  id: number
  team_program_session_id: number
  athlete_id: number
  status: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
  result_json: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

function ensureAdminClient() {
  const admin = createAdminClient()
  if (!admin) return { admin: null, error: '尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法執行團隊課表操作。' }
  return { admin, error: null }
}

function cleanText(value: unknown) {
  return String(value ?? '').trim()
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeMembershipStatus(value: unknown): TeamMembershipStatus {
  const text = cleanText(value).toLowerCase()
  return text === 'inactive' || text === 'removed' ? text : 'active'
}

function normalizeTeamCoachRole(value: unknown): TeamCoachRole {
  const text = cleanText(value).toLowerCase()
  if (text === 'owner' || text === 'manager' || text === 'viewer') return text
  return 'coach'
}

function normalizeTeamCoachStatus(value: unknown): TeamCoachStatus {
  const text = cleanText(value).toLowerCase()
  return text === 'inactive' || text === 'removed' ? text : 'active'
}

function normalizeEnrollmentStatus(value: unknown): TeamEnrollmentStatus {
  const text = cleanText(value).toLowerCase()
  if (text === 'draft' || text === 'ended' || text === 'cancelled') return text
  return 'active'
}

function normalizeProgramStatus(value: unknown): TeamProgramStatus {
  const text = cleanText(value).toLowerCase()
  if (text === 'scheduled' || text === 'completed' || text === 'cancelled') return text
  return 'active'
}

function normalizeSessionStatus(value: unknown): TeamSessionStatus {
  const text = cleanText(value).toLowerCase()
  if (text === 'available' || text === 'completed' || text === 'cancelled') return text
  return 'scheduled'
}

function normalizeResultStatus(value: unknown): TeamResultStatus {
  const text = cleanText(value).toLowerCase()
  if (text === 'in_progress' || text === 'completed' || text === 'skipped') return text
  return 'not_started'
}

function parseDate(value: unknown) {
  const text = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  return text
}

function parsePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isDateActive(startDate: string, endDate: string | null, compareDate = todayIsoDate()) {
  return startDate <= compareDate && (!endDate || endDate >= compareDate)
}

async function fetchManageableTeamRows(admin: AdminClient, coach: CoachProfile) {
  const baseSelect = 'id, name, description, sport_type, created_by, is_active, created_at, updated_at'
  if (coach.is_head_coach) {
    const { data, error } = await admin
      .from('teams')
      .select(baseSelect)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw error
    return (data ?? []) as TeamRow[]
  }

  const { data: coachLinks, error: coachLinkError } = await admin
    .from('team_coaches')
    .select('team_id')
    .eq('coach_id', coach.id)
    .eq('status', 'active')
  if (coachLinkError) throw coachLinkError
  const teamIds = Array.from(new Set((coachLinks ?? []).map((row) => Number(row.team_id)).filter(Number.isFinite)))
  if (teamIds.length === 0) return []

  const { data, error } = await admin
    .from('teams')
    .select(baseSelect)
    .eq('is_active', true)
    .in('id', teamIds)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as TeamRow[]
}

async function fetchTeamById(admin: AdminClient, teamId: number) {
  const { data, error } = await admin
    .from('teams')
    .select('id, name, description, sport_type, created_by, is_active, created_at, updated_at')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  return data as TeamRow | null
}

async function getActiveTeamCoachRow(admin: AdminClient, coachId: number, teamId: number) {
  const { data, error } = await admin
    .from('team_coaches')
    .select('id, team_id, coach_id, role, can_manage_roster, can_manage_programs, can_view_results, status, assigned_by, created_at, updated_at, removed_at')
    .eq('team_id', teamId)
    .eq('coach_id', coachId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw error
  return data as TeamCoachRow | null
}

function teamCoachHasPermission(row: TeamCoachRow | null, permission: 'access' | 'coaches' | 'roster' | 'programs' | 'results') {
  if (!row || row.status !== 'active') return false
  const role = normalizeTeamCoachRole(row.role)
  if (permission === 'access') return true
  if (role === 'owner') return true
  if (permission === 'coaches') return false
  if (permission === 'roster') return row.can_manage_roster === true
  if (permission === 'programs') return row.can_manage_programs === true
  return row.can_view_results === true
}

async function assertCanManageTeam(admin: AdminClient, coach: CoachProfile, teamId: number, permission: 'access' | 'coaches' | 'roster' | 'programs' | 'results' = 'access') {
  const team = await fetchTeamById(admin, teamId)
  if (!team || team.is_active === false) return { error: '找不到這支球隊。' }
  if (coach.is_head_coach) return { team }
  const teamCoach = await getActiveTeamCoachRow(admin, coach.id, teamId)
  if (!teamCoachHasPermission(teamCoach, permission)) return { error: '你沒有權限管理這支球隊。' }
  return { team }
}

async function assertCoachCanUseAthlete(admin: AdminClient, coach: CoachProfile, athleteId: number) {
  const { data: athlete, error: athleteError } = await admin
    .from('athletes')
    .select('id, name, email, sport')
    .eq('id', athleteId)
    .maybeSingle()
  if (athleteError) throw athleteError
  if (!athlete) return { error: '找不到這位學員。' }
  if (coach.is_head_coach) return { athlete: athlete as AthleteRow }

  const { data: link, error: linkError } = await admin
    .from('coach_athletes')
    .select('coach_id, athlete_id')
    .eq('coach_id', coach.id)
    .eq('athlete_id', athleteId)
    .limit(1)
    .maybeSingle()
  if (linkError) throw linkError
  if (!link) return { error: '你只能將自己負責的學員加入球隊。' }
  return { athlete: athlete as AthleteRow }
}

async function hydrateTeams(admin: AdminClient, teams: TeamRow[]): Promise<TeamRecord[]> {
  if (teams.length === 0) return []
  const teamIds = teams.map((team) => Number(team.id))

  const [teamCoachesResult, membershipsResult, enrollmentsResult] = await Promise.all([
    admin.from('team_coaches').select('id, team_id, coach_id, role, can_manage_roster, can_manage_programs, can_view_results, status, assigned_by, created_at, updated_at, removed_at').in('team_id', teamIds).order('created_at', { ascending: true }),
    admin.from('team_memberships').select('id, team_id, athlete_id, status, joined_at, left_at, created_at').in('team_id', teamIds).order('joined_at', { ascending: false }),
    admin.from('team_product_enrollments').select('id, team_id, seat_limit, status, start_date, end_date').in('team_id', teamIds),
  ])
  if (teamCoachesResult.error) throw teamCoachesResult.error
  if (membershipsResult.error) throw membershipsResult.error
  if (enrollmentsResult.error) throw enrollmentsResult.error

  const memberships = (membershipsResult.data ?? []) as MembershipRow[]
  const teamCoaches = (teamCoachesResult.data ?? []) as TeamCoachRow[]
  const athleteIds = Array.from(new Set(memberships.map((membership) => Number(membership.athlete_id))))
  const coachIds = Array.from(new Set([...teams.map((team) => Number(team.created_by)), ...teamCoaches.map((teamCoach) => Number(teamCoach.coach_id))].filter(Number.isFinite)))
  const { data: athleteRows, error: athleteError } = athleteIds.length > 0
    ? await admin.from('athletes').select('id, name, email, sport').in('id', athleteIds)
    : { data: [], error: null }
  if (athleteError) throw athleteError

  const { data: coachRows, error: coachError } = coachIds.length > 0
    ? await admin.from('coaches').select('id, name, email, is_head_coach').in('id', coachIds)
    : { data: [], error: null }
  if (coachError) throw coachError

  const coachesById = new Map(((coachRows ?? []) as CoachRow[]).map((coach) => [Number(coach.id), coach]))
  const athletesById = new Map(((athleteRows ?? []) as AthleteRow[]).map((athlete) => [Number(athlete.id), athlete]))
  const membershipsByTeam = new Map<number, TeamMembershipRecord[]>()
  const teamCoachesByTeam = new Map<number, TeamCoachRecord[]>()

  for (const membership of memberships) {
    const athlete = athletesById.get(Number(membership.athlete_id))
    const record: TeamMembershipRecord = {
      id: Number(membership.id),
      team_id: Number(membership.team_id),
      athlete_id: Number(membership.athlete_id),
      athlete_name: athlete?.name ?? null,
      athlete_email: athlete?.email ?? null,
      status: normalizeMembershipStatus(membership.status),
      joined_at: membership.joined_at,
      left_at: membership.left_at,
      created_at: membership.created_at,
    }
    const current = membershipsByTeam.get(record.team_id) ?? []
    current.push(record)
    membershipsByTeam.set(record.team_id, current)
  }

  for (const teamCoach of teamCoaches) {
    const linkedCoach = coachesById.get(Number(teamCoach.coach_id))
    const record: TeamCoachRecord = {
      id: Number(teamCoach.id),
      team_id: Number(teamCoach.team_id),
      coach_id: Number(teamCoach.coach_id),
      coach_name: linkedCoach?.name ?? null,
      coach_email: linkedCoach?.email ?? null,
      role: normalizeTeamCoachRole(teamCoach.role),
      can_manage_roster: teamCoach.can_manage_roster === true,
      can_manage_programs: teamCoach.can_manage_programs === true,
      can_view_results: teamCoach.can_view_results !== false,
      status: normalizeTeamCoachStatus(teamCoach.status),
      assigned_by: teamCoach.assigned_by == null ? null : Number(teamCoach.assigned_by),
      created_at: teamCoach.created_at,
      updated_at: teamCoach.updated_at,
      removed_at: teamCoach.removed_at,
    }
    const current = teamCoachesByTeam.get(record.team_id) ?? []
    current.push(record)
    teamCoachesByTeam.set(record.team_id, current)
  }

  const activeLimitByTeam = new Map<number, number | null>()
  for (const teamId of teamIds) {
    const limits = ((enrollmentsResult.data ?? []) as Array<{ team_id: number; seat_limit: number | null; status: string; start_date: string; end_date: string | null }>)
      .filter((row) => Number(row.team_id) === teamId && row.status === 'active' && row.seat_limit != null && isDateActive(String(row.start_date), row.end_date == null ? null : String(row.end_date)))
      .map((row) => Number(row.seat_limit))
    activeLimitByTeam.set(teamId, limits.length > 0 ? Math.min(...limits) : null)
  }

  return teams.map((team) => {
    const teamMemberships = membershipsByTeam.get(Number(team.id)) ?? []
    const author = coachesById.get(Number(team.created_by))
    return {
      id: Number(team.id),
      name: team.name,
      description: team.description,
      sport_type: team.sport_type,
      created_by: Number(team.created_by),
      created_by_name: author?.name ?? null,
      created_by_email: author?.email ?? null,
      is_active: team.is_active ?? true,
      created_at: team.created_at,
      updated_at: team.updated_at,
      activeRosterCount: teamMemberships.filter((membership) => membership.status === 'active').length,
      memberships: teamMemberships,
      coaches: teamCoachesByTeam.get(Number(team.id)) ?? [],
      activeSeatLimit: activeLimitByTeam.get(Number(team.id)) ?? null,
    }
  })
}

export async function getTeamManagementSnapshot(coach: CoachProfile): Promise<TeamManagementSnapshot> {
  const { admin, error } = ensureAdminClient()
  if (!admin) throw new Error(error ?? '無法讀取球隊資料。')

  const teams = await fetchManageableTeamRows(admin, coach)
  let athleteQuery = admin.from('athletes').select('id, name, email, sport').order('name', { ascending: true }).order('id', { ascending: true })

  if (!coach.is_head_coach) {
    const { data: links, error: linkError } = await admin.from('coach_athletes').select('athlete_id').eq('coach_id', coach.id)
    if (linkError) throw linkError
    const athleteIds = (links ?? []).map((row) => Number(row.athlete_id)).filter(Number.isFinite)
    if (athleteIds.length === 0) {
      const { data: coachOptions, error: coachOptionsError } = await admin.from('coaches').select('id, name, email, is_head_coach').order('name', { ascending: true }).order('id', { ascending: true })
      if (coachOptionsError) throw coachOptionsError
      return { teams: await hydrateTeams(admin, teams), athleteOptions: [], coachOptions: (coachOptions ?? []) as Array<{ id: number; name: string | null; email: string | null; is_head_coach: boolean | null }> }
    }
    athleteQuery = athleteQuery.in('id', athleteIds)
  }

  const [athleteResult, coachOptionsResult] = await Promise.all([
    athleteQuery,
    admin.from('coaches').select('id, name, email, is_head_coach').order('name', { ascending: true }).order('id', { ascending: true }),
  ])
  const { data: athleteOptions, error: athleteError } = athleteResult
  if (athleteError) throw athleteError
  if (coachOptionsResult.error) throw coachOptionsResult.error

  return {
    teams: await hydrateTeams(admin, teams),
    athleteOptions: (athleteOptions ?? []) as Array<{ id: number; name: string | null; email: string | null; sport: string | null }>,
    coachOptions: (coachOptionsResult.data ?? []) as Array<{ id: number; name: string | null; email: string | null; is_head_coach: boolean | null }>,
  }
}

export async function getTeamOptionsForCoach(coach: CoachProfile): Promise<TeamOption[]> {
  const { admin, error } = ensureAdminClient()
  if (!admin) throw new Error(error ?? '無法讀取球隊選項。')
  const teams = await fetchManageableTeamRows(admin, coach)
  const hydrated = await hydrateTeams(admin, teams)
  return hydrated.map((team) => ({ id: team.id, name: team.name, activeRosterCount: team.activeRosterCount, activeSeatLimit: team.activeSeatLimit }))
}

export async function createTeamForCoach(coach: CoachProfile, payload: { name: string; description?: string | null; sportType?: string | null }): Promise<MutationResult<TeamRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法建立球隊。' }
  const name = cleanText(payload.name)
  if (!name) return { error: '請輸入球隊名稱。' }

  const { data, error: insertError } = await admin
    .from('teams')
    .insert({ name, description: cleanText(payload.description) || null, sport_type: cleanText(payload.sportType) || null, created_by: coach.id, is_active: true })
    .select('id, name, description, sport_type, created_by, is_active, created_at, updated_at')
    .single()
  if (insertError || !data) return { error: insertError?.message ?? '建立球隊失敗。' }

  const hydrated = await hydrateTeams(admin, [data as TeamRow])
  return { data: hydrated[0], message: '已建立球隊。' }
}

function roleDefaults(role: TeamCoachRole) {
  if (role === 'owner') return { can_manage_roster: true, can_manage_programs: true, can_view_results: true }
  if (role === 'manager') return { can_manage_roster: true, can_manage_programs: true, can_view_results: true }
  if (role === 'coach') return { can_manage_roster: false, can_manage_programs: false, can_view_results: true }
  return { can_manage_roster: false, can_manage_programs: false, can_view_results: true }
}

export async function getTeamCoachesForCoach(coach: CoachProfile, teamId: number): Promise<MutationResult<{ team: TeamRecord }>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法讀取 Team 教練。' }
  const teamCheck = await assertCanManageTeam(admin, coach, teamId, 'access')
  if (teamCheck.error || !teamCheck.team) return { error: teamCheck.error ?? '你沒有權限查看這支球隊。' }
  const hydrated = await hydrateTeams(admin, [teamCheck.team])
  return { data: { team: hydrated[0] } }
}

export async function addTeamCoachForCoach(coach: CoachProfile, teamId: number, payload: { coachId: number; role?: string; canManageRoster?: boolean; canManagePrograms?: boolean; canViewResults?: boolean }): Promise<MutationResult<TeamRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法新增 Team 教練。' }
  const teamCheck = await assertCanManageTeam(admin, coach, teamId, 'coaches')
  if (teamCheck.error || !teamCheck.team) return { error: teamCheck.error ?? '你沒有權限管理 Team 教練。' }
  const targetCoachId = Number(payload.coachId)
  if (!Number.isFinite(targetCoachId)) return { error: '請選擇教練。' }

  const { data: targetCoach, error: targetError } = await admin.from('coaches').select('id').eq('id', targetCoachId).maybeSingle()
  if (targetError) return { error: targetError.message }
  if (!targetCoach) return { error: '找不到目標教練。' }

  const role = normalizeTeamCoachRole(payload.role)
  const defaults = roleDefaults(role)
  const record = {
    team_id: teamId,
    coach_id: targetCoachId,
    role,
    can_manage_roster: role === 'owner' ? true : payload.canManageRoster ?? defaults.can_manage_roster,
    can_manage_programs: role === 'owner' ? true : payload.canManagePrograms ?? defaults.can_manage_programs,
    can_view_results: role === 'owner' ? true : payload.canViewResults ?? defaults.can_view_results,
    status: 'active',
    assigned_by: coach.id,
  }
  const { error: insertError } = await admin.from('team_coaches').insert(record)
  if (insertError) return { error: insertError.message.includes('duplicate') ? '這位教練已經是 active Team Coach。' : insertError.message }

  const refreshed = await hydrateTeams(admin, [teamCheck.team])
  return { data: refreshed[0], message: '已新增 Team 教練。' }
}

export async function updateTeamCoachForCoach(coach: CoachProfile, teamId: number, teamCoachId: number, payload: { role?: string; canManageRoster?: boolean; canManagePrograms?: boolean; canViewResults?: boolean; status?: string }): Promise<MutationResult<TeamRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法更新 Team 教練。' }
  const teamCheck = await assertCanManageTeam(admin, coach, teamId, 'coaches')
  if (teamCheck.error || !teamCheck.team) return { error: teamCheck.error ?? '你沒有權限管理 Team 教練。' }

  const { data: current, error: currentError } = await admin.from('team_coaches').select('id, role, status').eq('id', teamCoachId).eq('team_id', teamId).maybeSingle()
  if (currentError) return { error: currentError.message }
  if (!current) return { error: '找不到 Team Coach。' }

  const nextRole = payload.role == null ? normalizeTeamCoachRole(current.role) : normalizeTeamCoachRole(payload.role)
  const nextStatus = payload.status == null ? normalizeTeamCoachStatus(current.status) : normalizeTeamCoachStatus(payload.status)
  const defaults = roleDefaults(nextRole)
  const update = {
    role: nextRole,
    can_manage_roster: nextRole === 'owner' ? true : payload.canManageRoster ?? defaults.can_manage_roster,
    can_manage_programs: nextRole === 'owner' ? true : payload.canManagePrograms ?? defaults.can_manage_programs,
    can_view_results: nextRole === 'owner' ? true : payload.canViewResults ?? defaults.can_view_results,
    status: nextStatus,
    removed_at: nextStatus === 'removed' ? new Date().toISOString() : null,
  }
  const { error: updateError } = await admin.from('team_coaches').update(update).eq('id', teamCoachId).eq('team_id', teamId)
  if (updateError) return { error: updateError.message }
  const refreshed = await hydrateTeams(admin, [teamCheck.team])
  return { data: refreshed[0], message: '已更新 Team 教練。' }
}

export async function removeTeamCoachForCoach(coach: CoachProfile, teamId: number, teamCoachId: number): Promise<MutationResult<TeamRecord>> {
  return updateTeamCoachForCoach(coach, teamId, teamCoachId, { status: 'removed' })
}

export async function addTeamMemberForCoach(coach: CoachProfile, teamId: number, athleteId: number): Promise<MutationResult<TeamRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法加入球員。' }

  const teamCheck = await assertCanManageTeam(admin, coach, teamId, 'roster')
  if (teamCheck.error || !teamCheck.team) return { error: teamCheck.error ?? '無法管理球隊。' }

  const athleteCheck = await assertCoachCanUseAthlete(admin, coach, athleteId)
  if (athleteCheck.error || !athleteCheck.athlete) return { error: athleteCheck.error ?? '無法加入球員。' }

  const { error: rpcError } = await admin.rpc('add_or_reactivate_team_member', {
    p_team_id: teamId,
    p_athlete_id: athleteId,
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
  })
  if (rpcError) return { error: rpcError.message }

  const refreshed = await hydrateTeams(admin, [teamCheck.team])
  return { data: refreshed[0], message: '已加入球員。' }
}

export async function updateTeamMembershipForCoach(coach: CoachProfile, teamId: number, membershipId: number, status: TeamMembershipStatus): Promise<MutationResult<TeamRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法更新球員狀態。' }
  const normalizedStatus = normalizeMembershipStatus(status)
  const teamCheck = await assertCanManageTeam(admin, coach, teamId, 'roster')
  if (teamCheck.error || !teamCheck.team) return { error: teamCheck.error ?? '無法管理球隊。' }

  if (normalizedStatus === 'active') {
    const { data: membership, error: membershipError } = await admin.from('team_memberships').select('athlete_id').eq('id', membershipId).eq('team_id', teamId).maybeSingle()
    if (membershipError) return { error: membershipError.message }
    if (!membership) return { error: '找不到 team member。' }
    return addTeamMemberForCoach(coach, teamId, Number(membership.athlete_id))
  }

  const { error: updateError } = await admin
    .from('team_memberships')
    .update({ status: normalizedStatus, left_at: new Date().toISOString() })
    .eq('id', membershipId)
    .eq('team_id', teamId)
  if (updateError) return { error: updateError.message }

  const refreshed = await hydrateTeams(admin, [teamCheck.team])
  return { data: refreshed[0], message: '已更新球員狀態。' }
}

async function hydrateEnrollments(admin: AdminClient, enrollments: EnrollmentRow[]): Promise<TeamEnrollmentRecord[]> {
  if (enrollments.length === 0) return []

  const teamIds = Array.from(new Set(enrollments.map((row) => Number(row.team_id))))
  const productIds = Array.from(new Set(enrollments.map((row) => Number(row.product_id))))
  const versionIds = Array.from(new Set(enrollments.map((row) => Number(row.product_version_id))))
  const coachIds = Array.from(new Set(enrollments.map((row) => Number(row.assigned_by))))

  const [teamsResult, productsResult, versionsResult, coachesResult, programsResult, membershipResult] = await Promise.all([
    admin.from('teams').select('id, name, description, sport_type, created_by, is_active, created_at, updated_at').in('id', teamIds),
    admin.from('training_products').select('id, name').in('id', productIds),
    admin.from('training_product_versions').select('id, product_id, version_number, status, snapshot_name').in('id', versionIds),
    admin.from('coaches').select('id, name, email').in('id', coachIds),
    admin.from('team_program_instances').select('id, team_product_enrollment_id, team_id, product_version_id, name, start_date, end_date, timezone, status, source_snapshot_json, created_at, updated_at').in('team_product_enrollment_id', enrollments.map((row) => Number(row.id))),
    admin.from('team_memberships').select('team_id, status').in('team_id', teamIds),
  ])
  if (teamsResult.error) throw teamsResult.error
  if (productsResult.error) throw productsResult.error
  if (versionsResult.error) throw versionsResult.error
  if (coachesResult.error) throw coachesResult.error
  if (programsResult.error) throw programsResult.error
  if (membershipResult.error) throw membershipResult.error

  const programRows = (programsResult.data ?? []) as ProgramRow[]
  const sessionResult = programRows.length > 0
    ? await admin.from('team_program_sessions').select('id, team_program_instance_id, source_product_block_id, source_block_id, title, scheduled_date, week_number, day_number, sort_order, status, created_at, updated_at').in('team_program_instance_id', programRows.map((program) => Number(program.id))).order('sort_order', { ascending: true })
    : { data: [], error: null }
  if (sessionResult.error) throw sessionResult.error

  const blockIds = Array.from(new Set(((sessionResult.data ?? []) as SessionRow[]).map((session) => Number(session.source_block_id))))
  const blockResult = blockIds.length > 0
    ? await admin.from('blocks').select('id, block_code, block_name').in('id', blockIds)
    : { data: [], error: null }
  if (blockResult.error) throw blockResult.error

  const teamsById = new Map(((teamsResult.data ?? []) as TeamRow[]).map((team) => [Number(team.id), team]))
  const productsById = new Map(((productsResult.data ?? []) as ProductRow[]).map((product) => [Number(product.id), product]))
  const versionsById = new Map(((versionsResult.data ?? []) as VersionRow[]).map((version) => [Number(version.id), version]))
  const coachesById = new Map(((coachesResult.data ?? []) as CoachRow[]).map((coach) => [Number(coach.id), coach]))
  const blocksById = new Map(((blockResult.data ?? []) as BlockRow[]).map((block) => [Number(block.id), block]))
  const sessionsByProgram = new Map<number, TeamProgramSessionRecord[]>()

  for (const session of (sessionResult.data ?? []) as SessionRow[]) {
    const block = blocksById.get(Number(session.source_block_id))
    const record: TeamProgramSessionRecord = {
      id: Number(session.id),
      team_program_instance_id: Number(session.team_program_instance_id),
      source_product_block_id: Number(session.source_product_block_id),
      source_block_id: Number(session.source_block_id),
      title: session.title,
      block_code: block?.block_code ?? null,
      block_name: block?.block_name ?? null,
      scheduled_date: session.scheduled_date,
      week_number: session.week_number == null ? null : Number(session.week_number),
      day_number: session.day_number == null ? null : Number(session.day_number),
      sort_order: Number(session.sort_order ?? 0),
      status: normalizeSessionStatus(session.status),
      created_at: session.created_at,
      updated_at: session.updated_at,
    }
    const current = sessionsByProgram.get(record.team_program_instance_id) ?? []
    current.push(record)
    sessionsByProgram.set(record.team_program_instance_id, current)
  }

  const activeRosterByTeam = new Map<number, number>()
  for (const membership of (membershipResult.data ?? []) as Array<{ team_id: number; status: string }>) {
    if (membership.status !== 'active') continue
    const teamId = Number(membership.team_id)
    activeRosterByTeam.set(teamId, (activeRosterByTeam.get(teamId) ?? 0) + 1)
  }

  const programsByEnrollment = new Map<number, TeamProgramRecord>()
  for (const program of programRows) {
    const team = teamsById.get(Number(program.team_id))
    const version = versionsById.get(Number(program.product_version_id))
    const product = version ? productsById.get(Number(version.product_id)) : null
    programsByEnrollment.set(Number(program.team_product_enrollment_id), {
      id: Number(program.id),
      team_product_enrollment_id: Number(program.team_product_enrollment_id),
      team_id: Number(program.team_id),
      team_name: team?.name ?? '未命名球隊',
      product_version_id: Number(program.product_version_id),
      product_version_number: Number(version?.version_number ?? 0),
      product_name: product?.name ?? version?.snapshot_name ?? '未命名商品',
      name: program.name,
      start_date: program.start_date,
      end_date: program.end_date,
      timezone: program.timezone,
      status: normalizeProgramStatus(program.status),
      source_snapshot_json: program.source_snapshot_json,
      created_at: program.created_at,
      updated_at: program.updated_at,
      sessions: sessionsByProgram.get(Number(program.id)) ?? [],
    })
  }

  return enrollments.map((enrollment) => {
    const team = teamsById.get(Number(enrollment.team_id))
    const product = productsById.get(Number(enrollment.product_id))
    const version = versionsById.get(Number(enrollment.product_version_id))
    const coach = coachesById.get(Number(enrollment.assigned_by))
    const program = programsByEnrollment.get(Number(enrollment.id)) ?? null
    return {
      id: Number(enrollment.id),
      team_id: Number(enrollment.team_id),
      team_name: team?.name ?? '未命名球隊',
      product_id: Number(enrollment.product_id),
      product_name: product?.name ?? version?.snapshot_name ?? '未命名商品',
      product_version_id: Number(enrollment.product_version_id),
      product_version_number: Number(version?.version_number ?? 0),
      assigned_by: Number(enrollment.assigned_by),
      assigned_by_name: coach?.name ?? coach?.email ?? null,
      start_date: enrollment.start_date,
      end_date: enrollment.end_date,
      seat_limit: enrollment.seat_limit == null ? null : Number(enrollment.seat_limit),
      status: normalizeEnrollmentStatus(enrollment.status),
      access_mode: 'dynamic_roster',
      created_at: enrollment.created_at,
      activated_at: enrollment.activated_at,
      ended_at: enrollment.ended_at,
      cancelled_at: enrollment.cancelled_at,
      program,
      activeRosterCount: activeRosterByTeam.get(Number(enrollment.team_id)) ?? 0,
      sessionsCount: program?.sessions.length ?? 0,
    }
  })
}

export async function getTeamProgramsSnapshot(coach: CoachProfile): Promise<TeamProgramsSnapshot> {
  const { admin, error } = ensureAdminClient()
  if (!admin) throw new Error(error ?? '無法讀取團隊課表。')
  const teams = await fetchManageableTeamRows(admin, coach)
  const teamIds = teams.map((team) => Number(team.id))
  if (teamIds.length === 0) return { enrollments: [] }

  const { data, error: enrollmentError } = await admin
    .from('team_product_enrollments')
    .select('id, team_id, product_id, product_version_id, assigned_by, start_date, end_date, seat_limit, status, access_mode, created_at, activated_at, ended_at, cancelled_at')
    .in('team_id', teamIds)
    .order('created_at', { ascending: false })
  if (enrollmentError) throw enrollmentError

  return { enrollments: await hydrateEnrollments(admin, (data ?? []) as EnrollmentRow[]) }
}

export async function assignProductVersionToTeamForCoach(coach: CoachProfile, payload: AssignProductVersionPayload): Promise<MutationResult<TeamEnrollmentRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法指派商品給球隊。' }
  const teamId = Number(payload.teamId)
  const versionId = Number(payload.productVersionId)
  const startDate = parseDate(payload.startDate)
  const endDate = payload.endDate ? parseDate(payload.endDate) : null
  const seatLimit = parsePositiveInteger(payload.seatLimit)
  const timezone = cleanText(payload.timezone) || 'Asia/Taipei'

  if (!Number.isFinite(teamId) || !Number.isFinite(versionId)) return { error: 'Team 或 Product Version 參數不正確。' }
  if (!startDate) return { error: '請輸入有效開始日期。' }
  if (payload.endDate && !endDate) return { error: '結束日期格式不正確。' }

  const { data, error: rpcError } = await admin.rpc('assign_product_version_to_team', {
    p_team_id: teamId,
    p_product_version_id: versionId,
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
    p_start_date: startDate,
    p_end_date: endDate,
    p_seat_limit: seatLimit,
    p_timezone: timezone,
  })
  if (rpcError) return { error: rpcError.message }

  const enrollmentId = Number(Array.isArray(data) ? data[0]?.enrollment_id : data?.enrollment_id)
  if (!Number.isFinite(enrollmentId)) return { error: '指派已完成，但無法讀取 enrollment id。' }

  const { data: enrollmentRows, error: enrollmentError } = await admin
    .from('team_product_enrollments')
    .select('id, team_id, product_id, product_version_id, assigned_by, start_date, end_date, seat_limit, status, access_mode, created_at, activated_at, ended_at, cancelled_at')
    .eq('id', enrollmentId)
  if (enrollmentError) return { error: enrollmentError.message }
  const hydrated = await hydrateEnrollments(admin, (enrollmentRows ?? []) as EnrollmentRow[])
  return { data: hydrated[0], message: '已將 Published Product Version 指派給球隊。' }
}

export async function getTeamEnrollmentForCoach(coach: CoachProfile, enrollmentId: number): Promise<MutationResult<TeamEnrollmentRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法讀取 enrollment。' }
  const { data, error: enrollmentError } = await admin
    .from('team_product_enrollments')
    .select('id, team_id, product_id, product_version_id, assigned_by, start_date, end_date, seat_limit, status, access_mode, created_at, activated_at, ended_at, cancelled_at')
    .eq('id', enrollmentId)
    .maybeSingle()
  if (enrollmentError) return { error: enrollmentError.message }
  if (!data) return { error: '找不到 enrollment。' }
  const teamCheck = await assertCanManageTeam(admin, coach, Number(data.team_id), 'programs')
  if (teamCheck.error) return { error: teamCheck.error }
  const hydrated = await hydrateEnrollments(admin, [data as EnrollmentRow])
  return { data: hydrated[0] }
}

export async function transitionTeamEnrollmentForCoach(coach: CoachProfile, enrollmentId: number, action: 'end' | 'cancel'): Promise<MutationResult<TeamEnrollmentRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法更新 enrollment。' }

  const { error: rpcError } = await admin.rpc('transition_team_enrollment', {
    p_enrollment_id: enrollmentId,
    p_action: action,
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
  })
  if (rpcError) return { error: rpcError.message }

  const refreshed = await getTeamEnrollmentForCoach(coach, enrollmentId)
  return { data: refreshed.data, message: action === 'end' ? '已結束團隊課表，歷史資料已保留。' : '已取消團隊課表，歷史資料已保留。' }
}

async function fetchStudentAccessiblePrograms(admin: AdminClient, athleteId: number) {
  const { data: memberships, error: membershipError } = await admin
    .from('team_memberships')
    .select('team_id')
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
  if (membershipError) throw membershipError
  const teamIds = (memberships ?? []).map((row) => Number(row.team_id)).filter(Number.isFinite)
  if (teamIds.length === 0) return [] as ProgramRow[]

  const today = todayIsoDate()
  const { data: enrollments, error: enrollmentError } = await admin
    .from('team_product_enrollments')
    .select('id')
    .in('team_id', teamIds)
    .eq('status', 'active')
    .lte('start_date', today)
  if (enrollmentError) throw enrollmentError
  const enrollmentIds = (enrollments ?? []).map((row) => Number(row.id)).filter(Number.isFinite)
  if (enrollmentIds.length === 0) return [] as ProgramRow[]

  const { data, error } = await admin
    .from('team_program_instances')
    .select('id, team_product_enrollment_id, team_id, product_version_id, name, start_date, end_date, timezone, status, source_snapshot_json, created_at, updated_at')
    .in('team_product_enrollment_id', enrollmentIds)
    .neq('status', 'cancelled')
    .order('start_date', { ascending: true })
  if (error) throw error
  return ((data ?? []) as ProgramRow[]).filter((program) => !program.end_date || program.end_date >= today)
}

async function hydrateStudentProgram(admin: AdminClient, athleteId: number, program: ProgramRow): Promise<StudentTeamProgramDetail> {
  const [teamResult, versionResult, enrollmentResult, sessionsResult] = await Promise.all([
    admin.from('teams').select('id, name').eq('id', program.team_id).maybeSingle(),
    admin.from('training_product_versions').select('id, product_id, version_number, snapshot_name').eq('id', program.product_version_id).maybeSingle(),
    admin.from('team_product_enrollments').select('id, product_id, start_date, end_date, status').eq('id', program.team_product_enrollment_id).maybeSingle(),
    admin.from('team_program_sessions').select('id, team_program_instance_id, source_product_block_id, source_block_id, title, scheduled_date, week_number, day_number, sort_order, status, created_at, updated_at').eq('team_program_instance_id', program.id).order('sort_order', { ascending: true }),
  ])
  if (teamResult.error) throw teamResult.error
  if (versionResult.error) throw versionResult.error
  if (enrollmentResult.error) throw enrollmentResult.error
  if (sessionsResult.error) throw sessionsResult.error

  const version = versionResult.data as VersionRow | null
  const productResult = version
    ? await admin.from('training_products').select('id, name').eq('id', version.product_id).maybeSingle()
    : { data: null, error: null }
  if (productResult.error) throw productResult.error

  const sessionRows = (sessionsResult.data ?? []) as SessionRow[]
  const sessionIds = sessionRows.map((session) => Number(session.id))
  const blockIds = Array.from(new Set(sessionRows.map((session) => Number(session.source_block_id))))
  const [resultsResult, blocksResult] = await Promise.all([
    sessionIds.length > 0 ? admin.from('athlete_team_session_results').select('id, team_program_session_id, athlete_id, status, started_at, completed_at, notes, result_json, created_at, updated_at').eq('athlete_id', athleteId).in('team_program_session_id', sessionIds) : Promise.resolve({ data: [], error: null }),
    blockIds.length > 0 ? admin.from('blocks').select('id, block_code, block_name').in('id', blockIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (resultsResult.error) throw resultsResult.error
  if (blocksResult.error) throw blocksResult.error

  const resultsBySession = new Map(((resultsResult.data ?? []) as ResultRow[]).map((result) => [Number(result.team_program_session_id), result]))
  const blocksById = new Map(((blocksResult.data ?? []) as BlockRow[]).map((block) => [Number(block.id), block]))
  const sessions: StudentTeamProgramSession[] = sessionRows.map((session) => {
    const block = blocksById.get(Number(session.source_block_id))
    const result = resultsBySession.get(Number(session.id))
    return {
      id: Number(session.id),
      team_program_instance_id: Number(session.team_program_instance_id),
      source_product_block_id: Number(session.source_product_block_id),
      source_block_id: Number(session.source_block_id),
      title: session.title,
      block_code: block?.block_code ?? null,
      block_name: block?.block_name ?? null,
      scheduled_date: session.scheduled_date,
      week_number: session.week_number == null ? null : Number(session.week_number),
      day_number: session.day_number == null ? null : Number(session.day_number),
      sort_order: Number(session.sort_order ?? 0),
      status: normalizeSessionStatus(session.status),
      created_at: session.created_at,
      updated_at: session.updated_at,
      result: result ? {
        id: Number(result.id),
        team_program_session_id: Number(result.team_program_session_id),
        athlete_id: Number(result.athlete_id),
        status: normalizeResultStatus(result.status),
        started_at: result.started_at,
        completed_at: result.completed_at,
        notes: result.notes,
        result_json: result.result_json,
        created_at: result.created_at,
        updated_at: result.updated_at,
      } : null,
    }
  })

  const completed = sessions.filter((session) => session.result?.status === 'completed').length
  const nextSession = sessions.find((session) => session.result?.status !== 'completed' && session.status !== 'cancelled') ?? null
  const product = productResult.data as ProductRow | null
  return {
    id: Number(program.id),
    teamName: String(teamResult.data?.name ?? '未命名球隊'),
    programName: program.name,
    productName: product?.name ?? version?.snapshot_name ?? '未命名商品',
    productVersionNumber: Number(version?.version_number ?? 0),
    startDate: program.start_date,
    endDate: program.end_date,
    status: normalizeProgramStatus(program.status),
    progress: { total: sessions.length, completed },
    nextSession,
    timezone: program.timezone,
    sessions,
  }
}

export async function getStudentTeamPrograms(athleteId: number): Promise<StudentTeamProgramSummary[]> {
  const { admin, error } = ensureAdminClient()
  if (!admin) throw new Error(error ?? '無法讀取我的團隊課表。')
  const programs = await fetchStudentAccessiblePrograms(admin, athleteId)
  const details = await Promise.all(programs.map((program) => hydrateStudentProgram(admin, athleteId, program)))
  return details.map((detail) => ({
    id: detail.id,
    teamName: detail.teamName,
    programName: detail.programName,
    productName: detail.productName,
    productVersionNumber: detail.productVersionNumber,
    startDate: detail.startDate,
    endDate: detail.endDate,
    status: detail.status,
    progress: detail.progress,
    nextSession: detail.nextSession,
  }))
}

export async function getStudentTeamProgramDetail(athleteId: number, programId: number): Promise<MutationResult<StudentTeamProgramDetail>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法讀取團隊課表。' }
  const programs = await fetchStudentAccessiblePrograms(admin, athleteId)
  const program = programs.find((entry) => Number(entry.id) === Number(programId))
  if (!program) return { error: '你沒有權限查看這個團隊課表。' }
  return { data: await hydrateStudentProgram(admin, athleteId, program) }
}

export async function updateStudentTeamSessionResult(athleteId: number, programId: number, sessionId: number, payload: { status?: string; notes?: string | null; resultJson?: Record<string, unknown> | null }): Promise<MutationResult<StudentTeamProgramDetail>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法儲存團隊課表結果。' }
  const detail = await getStudentTeamProgramDetail(athleteId, programId)
  if (detail.error || !detail.data) return { error: detail.error ?? '你沒有權限更新這個團隊課表。' }
  const session = detail.data.sessions.find((entry) => Number(entry.id) === Number(sessionId))
  if (!session) return { error: '找不到這個 session。' }
  if (detail.data.status === 'cancelled' || detail.data.status === 'completed' || detail.data.endDate && detail.data.endDate < todayIsoDate()) {
    return { error: '此團隊課表已結束或取消，不能新增回報。' }
  }

  const status = normalizeResultStatus(payload.status)
  const now = new Date().toISOString()
  const row = {
    team_program_session_id: sessionId,
    athlete_id: athleteId,
    status,
    notes: cleanText(payload.notes) || null,
    result_json: payload.resultJson ?? null,
    started_at: status === 'not_started' ? null : (session.result?.started_at ?? now),
    completed_at: status === 'completed' ? now : null,
    updated_at: now,
  }
  const { error: upsertError } = await admin
    .from('athlete_team_session_results')
    .upsert(row, { onConflict: 'team_program_session_id,athlete_id' })
  if (upsertError) return { error: upsertError.message }

  return getStudentTeamProgramDetail(athleteId, programId)
}

export async function getPublishedProductVersionOptions(snapshot: ProductManagementSnapshot) {
  return snapshot.products.flatMap((product) => product.versions
    .filter((version) => version.status === 'published')
    .map((version) => ({
      productId: product.id,
      productName: product.name,
      versionId: version.id,
      versionNumber: version.version_number,
      blocksCount: version.blocks.length,
    })))
}
