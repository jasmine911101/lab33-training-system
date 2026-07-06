import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { GENERAL_EVENT_TYPES, TRAINING_CATEGORIES } from '@/lib/types/schedule-management'
import { getAccessibleManagedAthleteForCoach } from '@/services/coach-management'
import type { CoachProfile } from '@/services/coach'
import { getAthleteScheduleBundle, getBlockCatalog, type AssignmentDetail, type BlockRecord, type GeneralEventDetail } from '@/services/schedule'

type MutationResult = {
  error?: string
  message?: string
  schedule?: Awaited<ReturnType<typeof getAthleteScheduleBundle>>
}

type BlockExerciseTemplateRow = {
  section_name: string
  section_order: number
  exercise_name: string
  sets: string
  reps_or_time: string
  equipment: string
  intensity: string
  weight: string
  rest: string
  video_url: string
  notes: string
  order_num: number
}

type AssignmentExerciseInputRow = {
  id?: number | null
  exercise_name: string
  sets: string
  reps_or_time: string
  equipment: string
  intensity: string
  weight: string
  rest: string
  video_url: string
  notes: string
  persisted?: boolean
}

type AssignmentExerciseInputSection = {
  name: string
  rows: AssignmentExerciseInputRow[]
}

type AthleteBlockExerciseExistingRow = {
  id: number
  actual_sets: string | null
  actual_weight: string | null
}

function text(value: unknown) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized.toLowerCase() === 'nan' ? '' : normalized
}

function toIsoDate(value: string) {
  return value
}

function normalizeTrainingCategory(value: string) {
  return TRAINING_CATEGORIES.includes(value as (typeof TRAINING_CATEGORIES)[number]) ? value : TRAINING_CATEGORIES[0]
}

function normalizeEventType(value: string) {
  return GENERAL_EVENT_TYPES.includes(value as (typeof GENERAL_EVENT_TYPES)[number]) ? value : GENERAL_EVENT_TYPES[GENERAL_EVENT_TYPES.length - 1]
}

async function ensureAdmin() {
  const admin = createAdminClient()
  if (!admin) {
    return { admin: null, error: '尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法執行課表安排操作。' }
  }
  return { admin, error: null }
}

async function ensureCoachCanManageAthlete(coach: CoachProfile, athleteId: number) {
  return await getAccessibleManagedAthleteForCoach(coach, athleteId)
}

async function ensureAssignmentBelongsToAthlete(athleteId: number, assignmentId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_blocks')
    .select('id, athlete_id, block_id')
    .eq('id', assignmentId)
    .eq('athlete_id', athleteId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function ensureEventBelongsToAthlete(athleteId: number, eventId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_events')
    .select('id, athlete_id')
    .eq('id', eventId)
    .eq('athlete_id', athleteId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function templateExerciseRowsForBlock(blockId: number): Promise<BlockExerciseTemplateRow[]> {
  const supabase = await createClient()
  const [{ data: sections, error: sectionsError }, { data: exercises, error: exercisesError }] = await Promise.all([
    supabase.from('block_sections').select('id, section_name, order_num').eq('block_id', blockId).order('order_num', { ascending: true }),
    supabase.from('block_exercises').select('id, section_id, exercise_name, sets, reps_or_time, equipment, intensity, weight, rest, video_url, notes, order_num').eq('block_id', blockId).order('order_num', { ascending: true }),
  ])

  if (sectionsError) throw sectionsError
  if (exercisesError) throw exercisesError

  const sectionById = new Map<number, { name: string; order: number }>()
  for (const section of sections ?? []) {
    sectionById.set(Number(section.id), {
      name: text(section.section_name) || '未命名區段',
      order: Number(section.order_num ?? Number.MAX_SAFE_INTEGER),
    })
  }

  let fallbackSectionOrder = 1
  const rows: BlockExerciseTemplateRow[] = []
  for (const exercise of exercises ?? []) {
    const section = exercise.section_id ? sectionById.get(Number(exercise.section_id)) : null
    rows.push({
      section_name: section?.name ?? '未命名區段',
      section_order: section?.order ?? fallbackSectionOrder,
      exercise_name: text(exercise.exercise_name),
      sets: text(exercise.sets),
      reps_or_time: text(exercise.reps_or_time),
      equipment: text(exercise.equipment),
      intensity: text(exercise.intensity),
      weight: text(exercise.weight),
      rest: text(exercise.rest),
      video_url: text(exercise.video_url),
      notes: text(exercise.notes),
      order_num: Number(exercise.order_num ?? 0),
    })
    fallbackSectionOrder += 1
  }

  return rows
}

async function createAssignmentExerciseSnapshot(athleteBlockId: number, blockId: number) {
  const { admin, error } = await ensureAdmin()
  if (!admin) {
    throw new Error(error ?? '缺少 service role。')
  }

  const rows = await templateExerciseRowsForBlock(blockId)
  const { error: deleteError } = await admin.from('athlete_block_exercises').delete().eq('athlete_block_id', athleteBlockId)
  if (deleteError) throw deleteError

  for (const row of rows) {
    const { error: insertError } = await admin.from('athlete_block_exercises').insert({
      athlete_block_id: athleteBlockId,
      ...row,
    })
    if (insertError) throw insertError
  }
}

async function fetchExistingAssignmentExerciseRows(athleteBlockId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_block_exercises')
    .select('id, actual_sets, actual_weight')
    .eq('athlete_block_id', athleteBlockId)

  if (error) throw error
  return (data ?? []) as AthleteBlockExerciseExistingRow[]
}

async function upsertAssignmentExerciseSnapshot(athleteBlockId: number, sections: AssignmentExerciseInputSection[]) {
  const { admin, error } = await ensureAdmin()
  if (!admin) {
    throw new Error(error ?? '缺少 service role。')
  }

  const existingRows = await fetchExistingAssignmentExerciseRows(athleteBlockId)
  const existingIds = new Set(existingRows.map((row) => Number(row.id)))
  const retainedIds = new Set<number>()

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]
    const sectionName = text(section.name) || '未命名區段'
    let orderNum = 0

    for (const inputRow of section.rows) {
      const exerciseName = text(inputRow.exercise_name)
      if (!exerciseName) continue

      orderNum += 1
      const payload = {
        athlete_block_id: athleteBlockId,
        section_name: sectionName,
        section_order: sectionIndex + 1,
        exercise_name: exerciseName,
        sets: text(inputRow.sets),
        reps_or_time: text(inputRow.reps_or_time),
        equipment: text(inputRow.equipment),
        intensity: text(inputRow.intensity),
        weight: text(inputRow.weight),
        rest: text(inputRow.rest),
        video_url: text(inputRow.video_url),
        notes: text(inputRow.notes),
        order_num: orderNum,
      }

      const rowId = Number(inputRow.id ?? 0)
      if (inputRow.persisted && existingIds.has(rowId)) {
        const { error: updateError } = await admin.from('athlete_block_exercises').update(payload).eq('id', rowId)
        if (updateError) throw updateError
        retainedIds.add(rowId)
      } else {
        const { data: inserted, error: insertError } = await admin
          .from('athlete_block_exercises')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw insertError
        retainedIds.add(Number(inserted.id))
      }
    }
  }

  const idsToDelete = existingRows
    .map((row) => Number(row.id))
    .filter((rowId) => !retainedIds.has(rowId))

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await admin.from('athlete_block_exercises').delete().in('id', idsToDelete)
    if (deleteError) throw deleteError
  }
}

async function refreshSchedule(athleteId: number) {
  return await getAthleteScheduleBundle(athleteId)
}

export async function createAssignmentForAthlete(
  coach: CoachProfile,
  athleteId: number,
  payload: {
    block_id: number
    event_name: string
    cycle_goal: string
    start_date: string
    end_date: string
    week_num: number
    day_num: number
    training_category: string
    notes: string
  },
): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const { admin, error: adminError } = await ensureAdmin()
  if (!admin) return { error: adminError }

  if (!payload.start_date || !payload.end_date) {
    return { error: '請先輸入開始與結束日期。' }
  }
  if (payload.end_date < payload.start_date) {
    return { error: '結束日期不能早於開始日期。' }
  }

  const { data: inserted, error: insertError } = await admin
    .from('athlete_blocks')
    .insert({
      athlete_id: athleteId,
      block_id: payload.block_id,
      event_name: text(payload.event_name),
      cycle_goal: text(payload.cycle_goal),
      scheduled_date: toIsoDate(payload.start_date),
      start_date: toIsoDate(payload.start_date),
      end_date: toIsoDate(payload.end_date),
      week_num: payload.week_num,
      day_num: payload.day_num,
      training_category: normalizeTrainingCategory(payload.training_category),
      notes: text(payload.notes),
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }

  try {
    await createAssignmentExerciseSnapshot(Number(inserted.id), payload.block_id)
  } catch (snapshotError) {
    return { error: snapshotError instanceof Error ? snapshotError.message : '建立課表快照失敗。' }
  }

  return {
    message: '已將板塊加入這位學員的課表。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function updateAssignmentForAthlete(
  coach: CoachProfile,
  athleteId: number,
  assignmentId: number,
  payload: {
    event_name: string
    cycle_goal: string
    start_date: string
    end_date: string
    week_num: number
    day_num: number
    training_category: string
    notes: string
  },
): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const assignment = await ensureAssignmentBelongsToAthlete(athleteId, assignmentId)
  if (!assignment) return { error: '找不到這筆課表安排。' }

  const { admin, error: adminError } = await ensureAdmin()
  if (!admin) return { error: adminError }

  if (!payload.start_date || !payload.end_date) {
    return { error: '請先輸入開始與結束日期。' }
  }
  if (payload.end_date < payload.start_date) {
    return { error: '結束日期不能早於開始日期。' }
  }

  const { error: updateError } = await admin
    .from('athlete_blocks')
    .update({
      event_name: text(payload.event_name),
      cycle_goal: text(payload.cycle_goal),
      scheduled_date: toIsoDate(payload.start_date),
      start_date: toIsoDate(payload.start_date),
      end_date: toIsoDate(payload.end_date),
      week_num: payload.week_num,
      day_num: payload.day_num,
      training_category: normalizeTrainingCategory(payload.training_category),
      notes: text(payload.notes),
    })
    .eq('id', assignmentId)

  if (updateError) return { error: updateError.message }

  return {
    message: '已更新這位學員的課表安排。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function deleteAssignmentForAthlete(coach: CoachProfile, athleteId: number, assignmentId: number): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const assignment = await ensureAssignmentBelongsToAthlete(athleteId, assignmentId)
  if (!assignment) return { error: '找不到這筆課表安排。' }

  const { admin, error: adminError } = await ensureAdmin()
  if (!admin) return { error: adminError }

  const { error: deleteRowsError } = await admin.from('athlete_block_exercises').delete().eq('athlete_block_id', assignmentId)
  if (deleteRowsError) return { error: deleteRowsError.message }

  const { error: deleteAssignmentError } = await admin.from('athlete_blocks').delete().eq('id', assignmentId)
  if (deleteAssignmentError) return { error: deleteAssignmentError.message }

  return {
    message: '已刪除這筆課表安排。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function updateAssignmentContentForAthlete(
  coach: CoachProfile,
  athleteId: number,
  assignmentId: number,
  payload: {
    sections: AssignmentExerciseInputSection[]
  },
): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const assignment = await ensureAssignmentBelongsToAthlete(athleteId, assignmentId)
  if (!assignment) return { error: '找不到這筆課表安排。' }

  const sections = Array.isArray(payload.sections) ? payload.sections : []

  try {
    await upsertAssignmentExerciseSnapshot(assignmentId, sections)
  } catch (saveError) {
    return { error: saveError instanceof Error ? saveError.message : '儲存學員課表內容失敗。' }
  }

  return {
    message: '已更新這次安排的課表內容。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function createGeneralEventForAthlete(
  coach: CoachProfile,
  athleteId: number,
  payload: {
    title: string
    event_type: string
    start_date: string
    end_date: string
    notes: string
  },
): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const { admin, error: adminError } = await ensureAdmin()
  if (!admin) return { error: adminError }

  if (!payload.start_date || !payload.end_date) {
    return { error: '請先輸入開始與結束日期。' }
  }
  if (payload.end_date < payload.start_date) {
    return { error: '結束日期不能早於開始日期。' }
  }

  const eventType = normalizeEventType(payload.event_type)
  const title = text(payload.title) || eventType || '一般事件'
  const { error: insertError } = await admin.from('athlete_events').insert({
    athlete_id: athleteId,
    title,
    event_type: eventType,
    start_date: toIsoDate(payload.start_date),
    end_date: toIsoDate(payload.end_date),
    notes: text(payload.notes),
  })

  if (insertError) return { error: insertError.message }

  return {
    message: '已新增一般事件。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function updateGeneralEventForAthlete(
  coach: CoachProfile,
  athleteId: number,
  eventId: number,
  payload: {
    title: string
    event_type: string
    start_date: string
    end_date: string
    notes: string
  },
): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const event = await ensureEventBelongsToAthlete(athleteId, eventId)
  if (!event) return { error: '找不到這筆一般事件。' }

  const { admin, error: adminError } = await ensureAdmin()
  if (!admin) return { error: adminError }

  if (!payload.start_date || !payload.end_date) {
    return { error: '請先輸入開始與結束日期。' }
  }
  if (payload.end_date < payload.start_date) {
    return { error: '結束日期不能早於開始日期。' }
  }

  const eventType = normalizeEventType(payload.event_type)
  const title = text(payload.title) || eventType || '一般事件'
  const { error: updateError } = await admin
    .from('athlete_events')
    .update({
      title,
      event_type: eventType,
      start_date: toIsoDate(payload.start_date),
      end_date: toIsoDate(payload.end_date),
      notes: text(payload.notes),
    })
    .eq('id', eventId)

  if (updateError) return { error: updateError.message }

  return {
    message: '已更新一般事件。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function deleteGeneralEventForAthlete(coach: CoachProfile, athleteId: number, eventId: number): Promise<MutationResult> {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) return { error: '找不到可管理的學員。' }

  const event = await ensureEventBelongsToAthlete(athleteId, eventId)
  if (!event) return { error: '找不到這筆一般事件。' }

  const { admin, error: adminError } = await ensureAdmin()
  if (!admin) return { error: adminError }

  const { error: deleteError } = await admin.from('athlete_events').delete().eq('id', eventId)
  if (deleteError) return { error: deleteError.message }

  return {
    message: '已刪除一般事件。',
    schedule: await refreshSchedule(athleteId),
  }
}

export async function getCoachSchedulingPageData(coach: CoachProfile, athleteId: number) {
  const athlete = await ensureCoachCanManageAthlete(coach, athleteId)
  if (!athlete) {
    return null
  }

  const [schedule, blocks] = await Promise.all([refreshSchedule(athleteId), getBlockCatalog()])
  return {
    athlete,
    schedule,
    blocks,
  }
}

export type { AssignmentDetail, BlockRecord, GeneralEventDetail }
