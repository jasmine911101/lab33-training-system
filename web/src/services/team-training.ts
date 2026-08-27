import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { CoachProfile } from '@/services/coach'
import { createAthleteForCoach, getAccessibleManagedAthleteForCoach, getCoachManagementSnapshot } from '@/services/coach-management'
import { getBlockCatalog, type AthleteScheduleBundle, type BlockRecord, type ExerciseSection, type StudentDashboardSummary } from '@/services/schedule'
import { getTaxonomySelectionSnapshot } from '@/services/block-taxonomy'

type TeamRow = { id: number; name: string; description: string; created_by_coach_id: number }
type MembershipRow = { id: number; team_id: number; athlete_id: number; is_active: boolean }
type BatchAccountRow = { id: number; name: string | null; email: string | null; created_for_team_id: number | null }
type AssignmentRow = { id: number; team_id: number; block_id: number; title: string; start_date: string; end_date: string; notes: string }
type MembershipWithTeamRow = { team_id: number; shared_training_teams: { id: number; name: string | null }[] | null }
type ExerciseRow = { id: number; block_id: number; section_id: number | null; exercise_name: string | null; sets: string | null; reps_or_time: string | null; intensity: string | null; weight: string | null; rest: string | null; notes: string | null; order_num: number | null }
type SectionRow = { id: number; section_name: string | null; order_num: number | null }
type ReportRow = { team_assignment_id: number; block_exercise_id: number; actual_sets: string | null; actual_weight: string | null }
type TeamScheduleAssignmentRow = { id: number; block_id: number; title: string | null; start_date: string | null; end_date: string | null; notes: string | null; week_num?: number | null; day_num?: number | null; training_category?: string | null }
type TeamScheduleMarkerRow = { id: number; start_date: string | null; end_date: string | null; week_num: number | null; note: string | null; color_key: string | null }
type TeamScheduleEventRow = { id: number; title: string | null; event_type: string | null; start_date: string | null; end_date: string | null; notes: string | null }
type TeamSectionRow = { id: number; section_name: string | null; order_num: number | null }
type TeamBlockExerciseRow = { id: number; section_id: number | null; exercise_name: string | null; sets: string | null; reps_or_time: string | null; equipment: string | null; intensity: string | null; weight: string | null; rest: string | null; video_url: string | null; notes: string | null }
type SchedulePayload = Record<string, unknown>

export type TeamExercise = { id: number; exercise_name: string; sets: string; reps_or_time: string; intensity: string; weight: string; rest: string; notes: string; section_name: string; section_order: number; order_num: number; actual_sets: string; actual_weight: string }
export type StudentTeamAssignment = { id: number; teamId: number; teamName: string; title: string; blockName: string; blockCode: string; startDate: string; endDate: string; notes: string; exercises: TeamExercise[] }
export type CoachTeamAssignment = { id: number; title: string; startDate: string; endDate: string; notes: string; blockId: number }
export type TeamWeekMarker = { id: number; startDate: string; endDate: string; weekNum: number; note: string; colorKey: string }
export type TeamGeneralEvent = { id: number; title: string; eventType: string; startDate: string; endDate: string; notes: string }

function text(value: unknown) { return value == null ? '' : String(value).trim() }

function isMissingOptionalTeamTable(error: { code?: string | null; message?: string | null } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || /could not find the table|does not exist/i.test(error?.message ?? '')
}

function isMissingTeamScheduleColumn(error: { code?: string | null; message?: string | null } | null) {
  return error?.code === 'PGRST204' || error?.code === '42703' || /(could not find the ['"]?(week_num|day_num|training_category)['"]? column|column shared_training_assignments\.(week_num|day_num|training_category) does not exist)/i.test(error?.message ?? '')
}

async function admin() {
  const client = createAdminClient()
  if (!client) throw new Error('尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法管理團隊課表。')
  return client
}

async function managedTeam(coach: CoachProfile, teamId: number) {
  const supabase = await admin()
  const query = supabase.from('shared_training_teams').select('id, name, description, created_by_coach_id').eq('id', teamId)
  const { data, error } = coach.is_head_coach ? await query.maybeSingle() : await query.eq('created_by_coach_id', coach.id).maybeSingle()
  if (error) throw error
  return data as TeamRow | null
}

export async function getCoachTeamPageData(coach: CoachProfile) {
  const supabase = await admin()
  const teamsQuery = supabase.from('shared_training_teams').select('id, name, description, created_by_coach_id').order('name')
  const { data: teams, error } = coach.is_head_coach ? await teamsQuery : await teamsQuery.eq('created_by_coach_id', coach.id)
  if (error) throw error
  const teamRows = (teams ?? []) as TeamRow[]
  const ids = teamRows.map((team) => team.id)
  const { data: memberships, error: membershipsError } = ids.length ? await supabase.from('shared_training_memberships').select('id, team_id, athlete_id, is_active').in('team_id', ids) : { data: [], error: null }
  if (membershipsError) throw membershipsError
  const { data: batchAccountRows, error: batchAccountError } = ids.length
    ? await supabase.from('athletes').select('id, name, email, created_for_team_id').in('created_for_team_id', ids)
    : { data: [], error: null }
  if (batchAccountError) throw batchAccountError
  const batchAccountIds = (batchAccountRows ?? []).map((account) => Number(account.id)).filter(Number.isFinite)
  const { data: batchMemberships, error: batchMembershipError } = batchAccountIds.length
    ? await supabase.from('shared_training_memberships').select('team_id, athlete_id, is_active').in('athlete_id', batchAccountIds).eq('is_active', true)
    : { data: [], error: null }
  if (batchMembershipError) throw batchMembershipError
  const batchMembershipsByAthlete = new Map<number, number[]>()
  for (const membership of batchMemberships ?? []) {
    const athleteId = Number(membership.athlete_id)
    batchMembershipsByAthlete.set(athleteId, [...(batchMembershipsByAthlete.get(athleteId) ?? []), Number(membership.team_id)])
  }
  const snapshot = await getCoachManagementSnapshot(coach)
  const athleteById = new Map(snapshot.athletes.map((athlete) => [athlete.id, athlete]))
  return {
    teams: teamRows.map((team) => ({
      ...team,
      members: ((memberships ?? []) as MembershipRow[]).filter((m) => m.team_id === team.id && m.is_active).map((m) => athleteById.get(m.athlete_id)).filter((athlete): athlete is (typeof snapshot.athletes)[number] => Boolean(athlete)),
      batchAccounts: ((batchAccountRows ?? []) as BatchAccountRow[])
        .filter((account) => Number(account.created_for_team_id) === team.id)
        .filter((account) => (batchMembershipsByAthlete.get(Number(account.id)) ?? []).every((membershipTeamId) => membershipTeamId === team.id))
        .map((account) => ({ id: Number(account.id), name: account.name, email: account.email })),
    })),
    athletes: snapshot.athletes,
    blocks: await getBlockCatalog(),
  }
}

export async function createTeam(coach: CoachProfile, payload: { name: string; description: string }) {
  const name = text(payload.name)
  if (!name) return { error: '請輸入團隊名稱。' }
  const supabase = await admin()
  const { error } = await supabase.from('shared_training_teams').insert({ name, description: text(payload.description), created_by_coach_id: coach.id })
  return error ? { error: error.message } : { message: '已建立團隊。' }
}

export async function deleteTeam(coach: CoachProfile, teamId: number, confirmationName: string, selectedBatchAccountIds: number[] = []) {
  const team = await managedTeam(coach, teamId)
  if (!team) return { error: '找不到可管理的團隊。' }
  if (text(confirmationName) !== team.name) return { error: '請完整輸入團隊名稱後再刪除。' }

  const supabase = await admin()
  const selectedIds = [...new Set(selectedBatchAccountIds.filter(Number.isFinite))]
  let deletedAccountCount = 0

  if (selectedIds.length) {
    const { data: candidates, error: candidateError } = await supabase
      .from('athletes')
      .select('id')
      .eq('created_for_team_id', team.id)
      .in('id', selectedIds)
    if (candidateError) return { error: `讀取團隊批次帳號失敗：${candidateError.message}` }

    const candidateIds = (candidates ?? []).map((athlete) => Number(athlete.id)).filter(Number.isFinite)
    if (candidateIds.length !== selectedIds.length) return { error: '部分選取帳號已不屬於此團隊批次建立，無法刪除。請重新開啟確認視窗。' }
    const { data: otherMemberships, error: membershipError } = await supabase
      .from('shared_training_memberships')
      .select('athlete_id')
      .in('athlete_id', candidateIds)
      .eq('is_active', true)
      .neq('team_id', team.id)
    if (membershipError) return { error: `檢查批次帳號所屬團隊失敗：${membershipError.message}` }
    if ((otherMemberships ?? []).length) return { error: '部分選取帳號已加入其他團隊，系統已保護該帳號。請重新開啟確認視窗。' }

    for (const athleteId of candidateIds) {
      const result = await deleteTeamMemberAccount(coach, team.id, athleteId)
      if (result.error) return { error: `刪除團隊批次帳號失敗：${result.error}` }
      deletedAccountCount += 1
    }
  }

  // 子資料表皆以 team_id 設定 ON DELETE CASCADE；刪除團隊只會清理其共享資料，不會刪除運動員、帳號或板塊模板。
  const { error } = await supabase.from('shared_training_teams').delete().eq('id', team.id)
  if (error) return { error: error.message }
  const accountMessage = deletedAccountCount ? `已刪除 ${deletedAccountCount} 個選取的團隊批次帳號及其個人資料與訓練紀錄。` : '隊員帳號已保留。'
  return { message: `已刪除團隊「${team.name}」及其共享課表資料；${accountMessage}模板已保留。` }
}

export async function addTeamMembers(coach: CoachProfile, teamId: number, athleteIds: number[]) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  const ids = [...new Set(athleteIds.filter(Number.isFinite))]
  if (!ids.length) return { error: '請至少選擇 1 位運動員。' }
  for (const athleteId of ids) if (!await getAccessibleManagedAthleteForCoach(coach, athleteId)) return { error: '名單中包含你無法管理的運動員。' }
  const supabase = await admin()
  const { error } = await supabase.from('shared_training_memberships').upsert(ids.map((athlete_id) => ({ team_id: teamId, athlete_id, is_active: true })), { onConflict: 'team_id,athlete_id' })
  return error ? { error: error.message } : { message: `已加入 ${ids.length} 位團隊成員。` }
}

export async function removeTeamMember(coach: CoachProfile, teamId: number, athleteId: number) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  if (!Number.isFinite(athleteId)) return { error: '成員資料不正確。' }
  const supabase = await admin()
  // 保留運動員帳號，只移除其團隊成員身分，避免刪除個人資料與既有紀錄。
  const { error } = await supabase
    .from('shared_training_memberships')
    .update({ is_active: false })
    .eq('team_id', teamId)
    .eq('athlete_id', athleteId)
  return error ? { error: error.message } : { message: '已移出團隊；該帳號與個人資料仍會保留。' }
}

export async function permanentlyRemoveTeamMembership(coach: CoachProfile, teamId: number, athleteId: number) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  const supabase = await admin()
  const { error } = await supabase
    .from('shared_training_memberships')
    .delete()
    .eq('team_id', teamId)
    .eq('athlete_id', athleteId)
  return error ? { error: error.message } : { message: '已解除團隊成員關聯。' }
}

export async function deleteTeamMemberAccount(coach: CoachProfile, teamId: number, athleteId: number) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  const athlete = await getAccessibleManagedAthleteForCoach(coach, athleteId)
  if (!athlete) return { error: '找不到可刪除的隊員帳號。' }
  const supabase = await admin()

  try {
    const cleanupSteps = [
      ['團隊訓練回報', supabase.from('shared_training_exercise_reports').delete().eq('athlete_id', athlete.id)],
      ['團隊成員關聯', supabase.from('shared_training_memberships').delete().eq('athlete_id', athlete.id)],
      ['個人週期', supabase.from('athlete_week_markers').delete().eq('athlete_id', athlete.id)],
      ['個人事件', supabase.from('athlete_events').delete().eq('athlete_id', athlete.id)],
      ['個人課表', supabase.from('athlete_blocks').delete().eq('athlete_id', athlete.id)],
      ['教練指派', supabase.from('coach_athletes').delete().eq('athlete_id', athlete.id)],
    ] as const

    for (const [label, request] of cleanupSteps) {
      const { error } = await request
      if (error) return { error: `刪除${label}失敗：${error.message}` }
    }

    const { data: deletedAthlete, error: athleteError } = await supabase
      .from('athletes')
      .delete()
      .eq('id', athlete.id)
      .select('id')
      .maybeSingle()
    if (athleteError) return { error: `刪除學員資料失敗：${athleteError.message}` }
    if (!deletedAthlete) return { error: '帳號未被刪除，請稍後再試。' }

    if (athlete.user_id) {
      const { error: authError } = await supabase.auth.admin.deleteUser(athlete.user_id)
      if (authError) return { error: `學員資料已刪除，但登入帳號刪除失敗：${authError.message}` }
    }

    return { message: '已永久刪除隊員帳號與所有相關資料。', athleteId: athlete.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '刪除隊員帳號失敗。' }
  }
}

export type TeamAccountCredential = {
  athleteId: number
  name: string
  email: string
  temporaryPassword: string
}

export async function createTeamMemberAccounts(
  coach: CoachProfile,
  teamId: number,
  payload: { count: number; accountPrefix: string },
): Promise<{ message?: string; accounts?: TeamAccountCredential[]; error?: string }> {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  const count = Math.floor(Number(payload.count))
  const prefix = text(payload.accountPrefix).toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!Number.isFinite(count) || count < 1 || count > 100) return { error: '一次請建立 1～100 個帳號。' }
  if (prefix.length < 3) return { error: '請輸入至少 3 個英數或連字號的帳號前綴。' }

  const supabase = await admin()
  const { data: existingAccounts, error: existingAccountsError } = await supabase
    .from('athletes')
    .select('email')
    .ilike('email', `${prefix}-%@team.lab33.local`)
  if (existingAccountsError) return { error: `檢查既有隊員帳號失敗：${existingAccountsError.message}` }

  const serialPattern = new RegExp(`^${prefix}-(\\d+)@team\\.lab33\\.local$`)
  const usedSerials = new Set(
    (existingAccounts ?? [])
      .map((account) => String(account.email ?? '').match(serialPattern)?.[1])
      .filter((serial): serial is string => Boolean(serial))
      .map(Number),
  )

  const created: TeamAccountCredential[] = []
  const athleteIds: number[] = []
  let nextSerial = 1
  for (let index = 1; index <= count; index += 1) {
    while (usedSerials.has(nextSerial)) nextSerial += 1
    const serial = String(nextSerial).padStart(2, '0')
    usedSerials.add(nextSerial)
    nextSerial += 1
    const result = await createAthleteForCoach(coach, {
      name: `${prefix}-${serial}`,
      email: `${prefix}-${serial}@team.lab33.local`,
      sport: '',
      level: '',
      assignedCoachId: coach.id,
      createdForTeamId: teamId,
    })
    if (result.error || !result.data) {
      if (athleteIds.length) await addTeamMembers(coach, teamId, athleteIds)
      return { error: `建立到第 ${index} 位時失敗：${result.error ?? '無法建立帳號。'}。先前成功建立的帳號已加入團隊，可換一組前綴後補建剩餘人數。` }
    }
    athleteIds.push(result.data.id)
    if (!result.tempPassword) {
      if (athleteIds.length) await addTeamMembers(coach, teamId, athleteIds)
      return { error: `帳號 ${result.data.email ?? result.data.name} 已存在，因此未產生暫時密碼。先前成功建立的帳號已加入團隊，請改用新的帳號前綴。` }
    }
    created.push({ athleteId: result.data.id, name: result.data.name ?? `${prefix}-${serial}`, email: result.data.email ?? '', temporaryPassword: result.tempPassword })
  }

  const membership = await addTeamMembers(coach, teamId, athleteIds)
  if (membership.error) return { error: membership.error }
  return { accounts: created, message: `已建立並加入 ${created.length} 位團隊成員。請下載或複製帳密後提供給隊員。` }
}

export async function createTeamAssignment(coach: CoachProfile, teamId: number, payload: { blockId: number; title: string; startDate: string; endDate: string; notes: string }) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  if (!payload.startDate || !payload.endDate || payload.endDate < payload.startDate) return { error: '請輸入有效的課表日期。' }
  const supabase = await admin()
  const { data: block } = await supabase.from('blocks').select('id').eq('id', payload.blockId).maybeSingle()
  if (!block) return { error: '請選擇有效的訓練板塊。' }
  const { error } = await supabase.from('shared_training_assignments').insert({ team_id: teamId, block_id: payload.blockId, title: text(payload.title), start_date: payload.startDate, end_date: payload.endDate, notes: text(payload.notes), created_by_coach_id: coach.id })
  return error ? { error: error.message } : { message: '已發佈共享課表，所有現有與新加入的團隊成員都能查看。' }
}

export async function createTeamGeneralEvent(coach: CoachProfile, teamId: number, payload: { title: string; eventType: string; startDate: string; endDate: string; notes: string }) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  if (!payload.startDate || !payload.endDate || payload.endDate < payload.startDate) return { error: '請輸入有效的事件日期。' }
  const supabase = await admin()
  const eventType = text(payload.eventType) || '其他'
  const { error } = await supabase.from('shared_training_events').insert({ team_id: teamId, title: text(payload.title) || eventType, event_type: eventType, start_date: payload.startDate, end_date: payload.endDate, notes: text(payload.notes), created_by_coach_id: coach.id })
  return error ? { error: error.message } : { message: '已新增團隊一般事件。' }
}

export async function getCoachTeamSchedulePageData(coach: CoachProfile, teamId: number) {
  const team = await managedTeam(coach, teamId)
  if (!team) return null
  const supabase = await admin()
  const { data, error } = await supabase.from('shared_training_assignments').select('id, block_id, title, start_date, end_date, notes').eq('team_id', teamId).order('start_date')
  if (error) throw error
  const [{ data: markers, error: markerError }, { data: events, error: eventError }] = await Promise.all([supabase.from('shared_training_week_markers').select('id, start_date, end_date, week_num, note, color_key').eq('team_id', teamId).order('start_date'), supabase.from('shared_training_events').select('id, title, event_type, start_date, end_date, notes').eq('team_id', teamId).order('start_date')])
  if (markerError && !isMissingOptionalTeamTable(markerError)) throw markerError
  if (eventError && !isMissingOptionalTeamTable(eventError)) throw eventError
  const blocks = await getBlockCatalog()
  const schedule = await getTeamScheduleBundle(teamId, { rows: data ?? [], markers: markers ?? [], events: events ?? [], blocks })
  return { team, blocks, schedule, taxonomy: await getTaxonomySelectionSnapshot() }
}

async function getTeamScheduleBundle(teamId: number, provided?: { rows?: TeamScheduleAssignmentRow[]; markers?: TeamScheduleMarkerRow[]; events?: TeamScheduleEventRow[]; blocks?: BlockRecord[] }): Promise<AthleteScheduleBundle> {
  const supabase = await admin()
  const assignmentQuery = provided?.rows
    ? Promise.resolve({ data: provided.rows, error: null })
    : fetchTeamScheduleAssignments(supabase, teamId)
  const [assignmentResult, markerResult, eventResult, blocks] = await Promise.all([
    assignmentQuery,
    provided?.markers ? Promise.resolve({ data: provided.markers, error: null }) : supabase.from('shared_training_week_markers').select('id, start_date, end_date, week_num, note, color_key').eq('team_id', teamId).order('start_date'),
    provided?.events ? Promise.resolve({ data: provided.events, error: null }) : supabase.from('shared_training_events').select('id, title, event_type, start_date, end_date, notes').eq('team_id', teamId).order('start_date'),
    provided?.blocks ? Promise.resolve(provided.blocks) : getBlockCatalog(),
  ])
  if (assignmentResult.error) throw assignmentResult.error
  if (markerResult.error && !isMissingOptionalTeamTable(markerResult.error)) throw markerResult.error
  if (eventResult.error && !isMissingOptionalTeamTable(eventResult.error)) throw eventResult.error
  const byId = new Map(blocks.map((block) => [block.id, block]))
  const assignments = await Promise.all(((assignmentResult.data ?? []) as TeamScheduleAssignmentRow[]).map(async (row) => {
    const block = byId.get(Number(row.block_id))
    const sections = await buildTeamSections(Number(row.block_id))
    const blockName = text(block?.block_name) || '未命名板塊'
    const code = text(block?.block_code)
    const weekNum = Number(row.week_num ?? 1)
    const category = text(row.training_category) || '未分類'
    return { id: `assignment-${row.id}`, record_id: Number(row.id), kind: 'assignment' as const, block_id: Number(row.block_id), block_label: code ? `${code} | ${blockName}` : blockName, block_name: blockName, meta: [`Week ${weekNum}`, category, code].filter(Boolean).join('｜'), week_label: `Week ${weekNum}`, event_display_name: text(row.title) || blockName, category_label: category, block_code: code, event_name: text(row.title), date_range: text(row.start_date) === text(row.end_date) ? text(row.start_date) : `${text(row.start_date)} ~ ${text(row.end_date)}`, start_date: text(row.start_date), end_date: text(row.end_date), week_num: weekNum, day_num: Number(row.day_num ?? 1), training_category: category, cycle_name: '', cycle_goal: '', goal: text(block?.goal), training_element: text(block?.training_element), description: text(block?.description), coach_notes: text(row.notes), sections, empty_message: '這個板塊目前沒有詳細動作內容。' }
  }))
  return { assignments, generalEvents: ((eventResult.data ?? []) as TeamScheduleEventRow[]).map((row) => ({ id: `event-${row.id}`, record_id: Number(row.id), kind: 'general_event' as const, block_label: text(row.title) || text(row.event_type) || '一般事件', meta: [text(row.event_type) || '一般事件', text(row.start_date) === text(row.end_date) ? text(row.start_date) : `${text(row.start_date)} ~ ${text(row.end_date)}`].join('｜'), event_name: text(row.title) || text(row.event_type) || '一般事件', event_type: text(row.event_type) || '一般事件', start_date: text(row.start_date), end_date: text(row.end_date), date_range: text(row.start_date) === text(row.end_date) ? text(row.start_date) : `${text(row.start_date)} ~ ${text(row.end_date)}`, description: text(row.notes), empty_message: '這是一筆一般事件，沒有訓練動作內容。' })), weekMarkers: ((markerResult.data ?? []) as TeamScheduleMarkerRow[]).map((row) => ({ id: String(row.id), startDate: text(row.start_date), endDate: text(row.end_date), weekNum: String(row.week_num ?? 1), note: text(row.note), colorKey: text(row.color_key) || 'sky' })) }
}

async function fetchTeamScheduleAssignments(supabase: Awaited<ReturnType<typeof admin>>, teamId: number) {
  const extended = await supabase.from('shared_training_assignments').select('id, block_id, title, start_date, end_date, notes, week_num, day_num, training_category').eq('team_id', teamId).order('start_date')
  if (!extended.error || !isMissingTeamScheduleColumn(extended.error)) return extended
  return await supabase.from('shared_training_assignments').select('id, block_id, title, start_date, end_date, notes').eq('team_id', teamId).order('start_date')
}

async function buildTeamSections(blockId: number): Promise<ExerciseSection[]> {
  const supabase = await admin()
  const [{ data: sectionRows }, { data: exerciseRows, error }] = await Promise.all([supabase.from('block_sections').select('id, section_name, order_num').eq('block_id', blockId).order('order_num'), supabase.from('block_exercises').select('id, section_id, exercise_name, sets, reps_or_time, equipment, intensity, weight, rest, video_url, notes, order_num').eq('block_id', blockId).order('order_num')])
  if (error) throw error
  const sectionById = new Map(((sectionRows ?? []) as TeamSectionRow[]).map((row) => [Number(row.id), row]))
  const grouped = new Map<string, { order: number; rows: ExerciseSection['rows'] }>()
  for (const row of (exerciseRows ?? []) as TeamBlockExerciseRow[]) { const section = sectionById.get(Number(row.section_id)); const name = text(section?.section_name) || '訓練內容'; const current = grouped.get(name) ?? { order: Number(section?.order_num ?? 999), rows: [] }; current.rows.push({ id: String(row.id), exercise_name: text(row.exercise_name), sets: text(row.sets), reps_or_time: text(row.reps_or_time), equipment: text(row.equipment), intensity: text(row.intensity), weight: text(row.weight), actual_sets: '', actual_weight: '', rest: text(row.rest), video_url: text(row.video_url), notes: text(row.notes), can_report: false }); grouped.set(name, current) }
  return [...grouped.entries()].sort((a, b) => a[1].order - b[1].order).map(([name, value]) => ({ name, rows: value.rows }))
}

async function teamMutation(coach: CoachProfile, teamId: number, action: () => Promise<{ error: { message?: string } | null }>, message: string) {
  try {
    if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
    const result = await action()
    if (result.error) return { error: result.error.message ?? '操作失敗。' }
    return { message, schedule: await getTeamScheduleBundle(teamId) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '操作失敗，請稍後再試。' }
  }
}
export async function createTeamScheduleAssignment(coach: CoachProfile, teamId: number, payload: SchedulePayload) {
  const supabase = await admin()
  const base = { team_id: teamId, block_id: Number(payload.block_id), title: text(payload.event_name), start_date: text(payload.start_date), end_date: text(payload.end_date), notes: text(payload.notes), created_by_coach_id: coach.id }
  return teamMutation(coach, teamId, async () => {
    const extended = await supabase.from('shared_training_assignments').insert({ ...base, week_num: Number(payload.week_num || 1), day_num: Number(payload.day_num || 1), training_category: text(payload.training_category) })
    return extended.error && isMissingTeamScheduleColumn(extended.error)
      ? await supabase.from('shared_training_assignments').insert(base)
      : extended
  }, '已新增團隊共享課表。')
}
export async function deleteTeamScheduleAssignment(coach: CoachProfile, teamId: number, id: number) { const supabase = await admin(); return teamMutation(coach, teamId, async () => supabase.from('shared_training_assignments').delete().eq('id', id).eq('team_id', teamId), '已刪除團隊共享課表。') }
export async function updateTeamScheduleAssignment(coach: CoachProfile, teamId: number, id: number, payload: SchedulePayload) {
  const supabase = await admin()
  const startDate = text(payload.start_date)
  const endDate = text(payload.end_date)
  if (!startDate || !endDate || endDate < startDate) return { error: '請輸入有效的開始與結束日期。' }
  return teamMutation(coach, teamId, async () => supabase.from('shared_training_assignments').update({ title: text(payload.event_name), start_date: startDate, end_date: endDate, week_num: Number(payload.week_num || 1), day_num: Number(payload.day_num || 1), training_category: text(payload.training_category), notes: text(payload.notes) }).eq('id', id).eq('team_id', teamId), '已更新團隊課表安排。')
}
export async function updateTeamScheduleAssignmentContent(coach: CoachProfile, teamId: number, assignmentId: number, sections: Array<{ name?: unknown; rows?: Array<Record<string, unknown>> }>) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  const supabase = await admin()
  const { data: assignment, error: assignmentError } = await supabase.from('shared_training_assignments').select('id, block_id').eq('id', assignmentId).eq('team_id', teamId).maybeSingle()
  if (assignmentError || !assignment) return { error: '找不到這筆團隊課表。' }
  const copyCode = `TEAM-${teamId}-${assignmentId}`
  const { data: currentBlock, error: blockError } = await supabase.from('blocks').select('id, block_code, block_name, goal, training_element, description, training_category_id').eq('id', assignment.block_id).maybeSingle()
  if (blockError || !currentBlock) return { error: '找不到原始訓練板塊。' }

  let editableBlockId = Number(currentBlock.id)
  if (currentBlock.block_code !== copyCode) {
    const { data: copiedBlock, error: copyBlockError } = await supabase.from('blocks').insert({
      block_code: copyCode,
      block_name: currentBlock.block_name,
      goal: currentBlock.goal,
      training_element: currentBlock.training_element,
      description: currentBlock.description,
      training_category_id: currentBlock.training_category_id,
    }).select('id').single()
    if (copyBlockError || !copiedBlock) return { error: copyBlockError?.message ?? '建立團隊課表副本失敗。' }
    editableBlockId = Number(copiedBlock.id)
    const { error: assignmentUpdateError } = await supabase.from('shared_training_assignments').update({ block_id: editableBlockId }).eq('id', assignmentId).eq('team_id', teamId)
    if (assignmentUpdateError) return { error: assignmentUpdateError.message }
  }

  const { error: deleteError } = await supabase.from('block_exercises').delete().eq('block_id', editableBlockId)
  if (deleteError) return { error: deleteError.message }
  const { error: sectionDeleteError } = await supabase.from('block_sections').delete().eq('block_id', editableBlockId)
  if (sectionDeleteError) return { error: sectionDeleteError.message }
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]
    const { data: savedSection, error: sectionError } = await supabase.from('block_sections').insert({ block_id: editableBlockId, section_name: text(section.name) || '訓練內容', order_num: sectionIndex + 1 }).select('id').single()
    if (sectionError) return { error: sectionError.message }
    for (let rowIndex = 0; rowIndex < (section.rows ?? []).length; rowIndex += 1) {
      const row = section.rows?.[rowIndex] ?? {}
      if (!text(row.exercise_name)) continue
      const { error } = await supabase.from('block_exercises').insert({ block_id: editableBlockId, section_id: savedSection.id, exercise_name: text(row.exercise_name), sets: text(row.sets), reps_or_time: text(row.reps_or_time), equipment: text(row.equipment), intensity: text(row.intensity), weight: text(row.weight), rest: text(row.rest), video_url: text(row.video_url), notes: text(row.notes), order_num: rowIndex + 1 })
      if (error) return { error: error.message }
    }
  }
  return { message: '已更新團隊課表內容。', schedule: await getTeamScheduleBundle(teamId) }
}
export async function createTeamScheduleWeekMarker(coach: CoachProfile, teamId: number, payload: SchedulePayload) { const supabase = await admin(); return teamMutation(coach, teamId, async () => supabase.from('shared_training_week_markers').insert({ team_id: teamId, created_by_coach_id: coach.id, start_date: text(payload.start_date), end_date: text(payload.end_date), week_num: Number(payload.week_num), note: text(payload.note), color_key: text(payload.color_key) || 'sky' }), '已套用團隊週期。') }
export async function deleteTeamScheduleWeekMarker(coach: CoachProfile, teamId: number, id: number) { const supabase = await admin(); return teamMutation(coach, teamId, async () => supabase.from('shared_training_week_markers').delete().eq('id', id).eq('team_id', teamId), '已刪除團隊週期。') }
export async function createTeamScheduleEvent(coach: CoachProfile, teamId: number, payload: SchedulePayload) { const supabase = await admin(); return teamMutation(coach, teamId, async () => supabase.from('shared_training_events').insert({ team_id: teamId, created_by_coach_id: coach.id, title: text(payload.title) || text(payload.event_type), event_type: text(payload.event_type), start_date: text(payload.start_date), end_date: text(payload.end_date), notes: text(payload.notes) }), '已新增團隊一般事件。') }
export async function updateTeamScheduleEvent(coach: CoachProfile, teamId: number, id: number, payload: SchedulePayload) { const supabase = await admin(); return teamMutation(coach, teamId, async () => supabase.from('shared_training_events').update({ title: text(payload.title) || text(payload.event_type), event_type: text(payload.event_type), start_date: text(payload.start_date), end_date: text(payload.end_date), notes: text(payload.notes) }).eq('id', id).eq('team_id', teamId), '已更新團隊一般事件。') }
export async function deleteTeamScheduleEvent(coach: CoachProfile, teamId: number, id: number) { const supabase = await admin(); return teamMutation(coach, teamId, async () => supabase.from('shared_training_events').delete().eq('id', id).eq('team_id', teamId), '已刪除團隊一般事件。') }

export async function createTeamWeekMarker(coach: CoachProfile, teamId: number, payload: { startDate: string; endDate: string; weekNum: number; note: string; colorKey: string }) {
  if (!await managedTeam(coach, teamId)) return { error: '找不到可管理的團隊。' }
  if (!payload.startDate || !payload.endDate || payload.endDate < payload.startDate || !Number.isInteger(payload.weekNum) || payload.weekNum < 1) return { error: '請輸入有效的週期日期與 Week 編號。' }
  const colors = new Set(['sky', 'emerald', 'amber', 'violet', 'rose', 'slate'])
  const supabase = await admin()
  const { error } = await supabase.from('shared_training_week_markers').insert({ team_id: teamId, created_by_coach_id: coach.id, start_date: payload.startDate, end_date: payload.endDate, week_num: payload.weekNum, note: text(payload.note), color_key: colors.has(payload.colorKey) ? payload.colorKey : 'sky' })
  return error ? { error: error.message } : { message: '已套用團隊週期。' }
}

export async function getStudentTeamAssignments(athleteId: number): Promise<StudentTeamAssignment[]> {
  const supabase = await admin()
  const { data: memberships, error } = await supabase.from('shared_training_memberships').select('team_id, shared_training_teams(id, name)').eq('athlete_id', athleteId).eq('is_active', true)
  if (error) throw error
  const teamNames = new Map(((memberships ?? []) as unknown as MembershipWithTeamRow[]).map((row) => [Number(row.team_id), text(row.shared_training_teams?.[0]?.name)]))
  const teamIds = [...teamNames.keys()]
  if (!teamIds.length) return []
  const { data: assignments, error: assignmentError } = await supabase.from('shared_training_assignments').select('id, team_id, block_id, title, start_date, end_date, notes').in('team_id', teamIds).order('start_date', { ascending: false })
  if (assignmentError) throw assignmentError
  const rows = (assignments ?? []) as AssignmentRow[]
  const blockIds = [...new Set(rows.map((row) => row.block_id))]
  const blocksById = new Map((await getBlockCatalog()).map((block) => [block.id, block]))
  const { data: exercises, error: exerciseError } = blockIds.length ? await supabase.from('block_exercises').select('id, block_id, section_id, exercise_name, sets, reps_or_time, intensity, weight, rest, notes, order_num').in('block_id', blockIds).order('order_num') : { data: [], error: null }
  if (exerciseError) throw exerciseError
  const exerciseRows = (exercises ?? []) as ExerciseRow[]
  const sectionIds = [...new Set(exerciseRows.map((row) => Number(row.section_id)).filter(Number.isFinite))]
  const { data: sections } = sectionIds.length ? await supabase.from('block_sections').select('id, section_name, order_num').in('id', sectionIds).order('order_num', { ascending: true }) : { data: [] }
  const sectionsById = new Map(((sections ?? []) as SectionRow[]).map((row) => [Number(row.id), row]))
  const assignmentIds = rows.map((row) => row.id)
  const { data: reports, error: reportError } = assignmentIds.length ? await supabase.from('shared_training_exercise_reports').select('team_assignment_id, block_exercise_id, actual_sets, actual_weight').eq('athlete_id', athleteId).in('team_assignment_id', assignmentIds) : { data: [], error: null }
  if (reportError) throw reportError
  const reportMap = new Map(((reports ?? []) as ReportRow[]).map((row) => [`${row.team_assignment_id}:${row.block_exercise_id}`, row]))
  return rows.map((assignment) => {
    const block = blocksById.get(Number(assignment.block_id))
    return {
      id: assignment.id,
      teamId: Number(assignment.team_id),
      teamName: teamNames.get(assignment.team_id) || '團隊',
      title: assignment.title || text(block?.block_name) || '訓練課表',
      blockName: text(block?.block_name) || assignment.title || '訓練課表',
      blockCode: text(block?.block_code),
      startDate: assignment.start_date,
      endDate: assignment.end_date,
      notes: assignment.notes,
      exercises: exerciseRows.filter((exercise) => Number(exercise.block_id) === assignment.block_id).map((exercise) => {
        const report = reportMap.get(`${assignment.id}:${exercise.id}`)
        const section = sectionsById.get(Number(exercise.section_id))
        return { id: Number(exercise.id), exercise_name: text(exercise.exercise_name), sets: text(exercise.sets), reps_or_time: text(exercise.reps_or_time), intensity: text(exercise.intensity), weight: text(exercise.weight), rest: text(exercise.rest), notes: text(exercise.notes), section_name: text(section?.section_name) || '訓練內容', section_order: Number(section?.order_num ?? Number.MAX_SAFE_INTEGER), order_num: Number(exercise.order_num ?? Number.MAX_SAFE_INTEGER), actual_sets: text(report?.actual_sets), actual_weight: text(report?.actual_weight) }
      }),
    }
  })
}

export async function getStudentTeamScheduleBundle(athleteId: number): Promise<AthleteScheduleBundle> {
  const assignments = await getStudentTeamAssignments(athleteId)
  const teamIds = [...new Set(assignments.map((assignment) => assignment.teamId))]
  const supabase = await admin()
  const { data: markerRows, error: markerError } = teamIds.length
    ? await supabase.from('shared_training_week_markers').select('id, team_id, start_date, end_date, week_num, note, color_key').in('team_id', teamIds).order('start_date')
    : { data: [], error: null }
  if (markerError && !isMissingOptionalTeamTable(markerError)) throw markerError

  return {
    assignments: assignments.map((assignment) => {
      const sectionMap = new Map<string, { order: number; rows: TeamExercise[] }>()
      for (const exercise of assignment.exercises) {
        const sectionName = exercise.section_name || '訓練內容'
        const section = sectionMap.get(sectionName) ?? { order: exercise.section_order, rows: [] }
        section.rows.push(exercise)
        sectionMap.set(sectionName, section)
      }
      return {
        id: `team-assignment-${assignment.id}`,
        record_id: assignment.id,
        kind: 'assignment' as const,
        block_id: null,
        block_label: assignment.blockCode ? `${assignment.blockCode} | ${assignment.blockName}` : assignment.blockName,
        block_name: `團隊－${assignment.blockName}`,
        meta: `${assignment.teamName}｜${assignment.startDate} ~ ${assignment.endDate}`,
        week_label: '團隊課表',
        event_display_name: `團隊－${assignment.blockName}`,
        category_label: assignment.teamName,
        block_code: assignment.blockCode || 'TEAM',
        event_name: assignment.title,
        date_range: assignment.startDate === assignment.endDate ? assignment.startDate : `${assignment.startDate} ~ ${assignment.endDate}`,
        start_date: assignment.startDate,
        end_date: assignment.endDate,
        week_num: null,
        day_num: null,
        training_category: assignment.teamName,
        cycle_name: '',
        cycle_goal: '',
        goal: '',
        training_element: '',
        description: '',
        coach_notes: assignment.notes,
        sections: [...sectionMap.entries()]
          .sort((a, b) => a[1].order - b[1].order)
          .map(([name, section]) => ({
          name,
          rows: section.rows
            .sort((a, b) => a.order_num - b.order_num)
            .map((row) => ({ id: String(row.id), exercise_name: row.exercise_name, sets: row.sets, reps_or_time: row.reps_or_time, equipment: '', intensity: row.intensity, weight: row.weight, actual_sets: row.actual_sets, actual_weight: row.actual_weight, rest: row.rest, video_url: '', notes: row.notes, can_report: true })),
        })),
        empty_message: '這份團隊課表目前沒有動作內容。',
      }
    }),
    generalEvents: [],
    weekMarkers: (markerRows ?? []).map((marker) => ({ id: `team-${marker.id}`, startDate: text(marker.start_date), endDate: text(marker.end_date), weekNum: String(marker.week_num ?? 1), note: text(marker.note), colorKey: text(marker.color_key) || 'sky' })),
  }
}

export function getStudentTeamDashboardSummary(schedule: AthleteScheduleBundle): StudentDashboardSummary {
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const monthStart = `${month}-01`
  const monthEndDate = new Date(`${monthStart}T00:00:00`)
  monthEndDate.setMonth(monthEndDate.getMonth() + 1, 0)
  const monthEnd = monthEndDate.toISOString().slice(0, 10)
  const overlapsThisMonth = (startDate: string, endDate: string) => startDate <= monthEnd && endDate >= monthStart
  const upcoming = <T extends { start_date: string; end_date: string }>(items: T[]) =>
    items.filter((item) => item.end_date >= today).sort((left, right) => left.start_date.localeCompare(right.start_date))[0] ?? null

  return {
    monthlyAssignmentCount: schedule.assignments.filter((item) => overlapsThisMonth(item.start_date, item.end_date)).length,
    monthlyEventCount: schedule.generalEvents.filter((item) => overlapsThisMonth(item.start_date, item.end_date)).length,
    nextAssignment: upcoming(schedule.assignments),
    nextEvent: upcoming(schedule.generalEvents),
  }
}

export async function saveStudentTeamReport(athleteId: number, assignmentId: number, rows: Array<{ exerciseId: number; actualSets: string; actualWeight: string }>) {
  const supabase = await createClient()
  const { data: assignment } = await supabase.from('shared_training_assignments').select('id, team_id, block_id').eq('id', assignmentId).maybeSingle()
  if (!assignment) return { error: '找不到可回報的團隊課表。' }
  const { data: membership } = await supabase.from('shared_training_memberships').select('id').eq('team_id', assignment.team_id).eq('athlete_id', athleteId).eq('is_active', true).maybeSingle()
  if (!membership) return { error: '你目前不在這個團隊中。' }
  const { data: validRows } = await supabase.from('block_exercises').select('id').eq('block_id', assignment.block_id)
  const validIds = new Set((validRows ?? []).map((row) => Number(row.id)))
  if (!rows.length || rows.some((row) => !validIds.has(row.exerciseId))) return { error: '回報內容不正確。' }
  const { error } = await supabase.from('shared_training_exercise_reports').upsert(rows.map((row) => ({ team_assignment_id: assignmentId, block_exercise_id: row.exerciseId, athlete_id: athleteId, actual_sets: text(row.actualSets), actual_weight: text(row.actualWeight), updated_at: new Date().toISOString() })), { onConflict: 'team_assignment_id,block_exercise_id,athlete_id' })
  return error ? { error: error.message } : { message: '已儲存個人訓練紀錄。' }
}

export type { BlockRecord }
