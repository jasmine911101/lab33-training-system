import { createClient } from '@/lib/supabase/server'

export type BlockRecord = {
  id: number
  block_code: string | null
  block_name: string | null
  goal: string | null
  training_element: string | null
  description: string | null
}

export type AthleteBlockRecord = {
  id: number
  athlete_id: number
  block_id: number | null
  event_name: string | null
  cycle_goal: string | null
  scheduled_date: string | null
  start_date: string | null
  end_date: string | null
  week_num: number | null
  day_num: number | null
  training_category: string | null
  notes: string | null
  created_at: string | null
}

export type AthleteEventRecord = {
  id: number
  athlete_id: number
  title: string | null
  event_type: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string | null
}

export type ExerciseRow = {
  id: string
  exercise_name: string
  sets: string
  reps_or_time: string
  equipment: string
  intensity: string
  weight: string
  actual_sets: string
  actual_weight: string
  rest: string
  video_url: string
  notes: string
  can_report: boolean
}

export type ExerciseSection = {
  name: string
  rows: ExerciseRow[]
}

export type AssignmentDetail = {
  id: string
  record_id: number
  kind: 'assignment'
  block_id: number | null
  block_label: string
  meta: string
  event_name: string
  date_range: string
  start_date: string
  end_date: string
  week_num: number | null
  day_num: number | null
  training_category: string
  cycle_goal: string
  goal: string
  training_element: string
  description: string
  coach_notes: string
  sections: ExerciseSection[]
  empty_message: string
}

export type GeneralEventDetail = {
  id: string
  record_id: number
  kind: 'general_event'
  block_label: string
  meta: string
  event_name: string
  event_type: string
  start_date: string
  end_date: string
  date_range: string
  description: string
  empty_message: string
}

export type AthleteScheduleBundle = {
  assignments: AssignmentDetail[]
  generalEvents: GeneralEventDetail[]
}

type BlockSectionRecord = {
  id: number
  block_id: number
  section_name: string | null
  order_num: number | null
}

type BlockExerciseRecord = {
  id: number
  block_id: number
  section_id: number | null
  exercise_name: string | null
  sets: string | null
  reps_or_time: string | null
  equipment: string | null
  intensity: string | null
  weight: string | null
  rest: string | null
  video_url: string | null
  order_num: number | null
  notes: string | null
}

type AthleteBlockExerciseRecord = {
  id: number
  athlete_block_id: number
  section_name: string | null
  section_order: number | null
  exercise_name: string | null
  sets: string | null
  reps_or_time: string | null
  equipment: string | null
  intensity: string | null
  weight: string | null
  actual_sets: string | null
  actual_weight: string | null
  rest: string | null
  video_url: string | null
  notes: string | null
  order_num: number | null
}

function text(value: unknown) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized.toLowerCase() === 'nan' ? '' : normalized
}

function blockLabel(block: Partial<BlockRecord> | null | undefined, fallbackBlockId?: number | null) {
  const code = text(block?.block_code)
  const name = text(block?.block_name)
  if (code && name) return `${code} | ${name}`
  if (name) return name
  if (code) return code
  return fallbackBlockId ? `Block ${fallbackBlockId}` : '未命名板塊'
}

function dateRangeLabel(row: {
  start_date?: string | null
  end_date?: string | null
  scheduled_date?: string | null
}) {
  let startDate = row.start_date
  let endDate = row.end_date

  if (!startDate) startDate = row.scheduled_date ?? null
  if (!endDate) endDate = startDate

  if (!startDate) return ''
  if (!endDate || String(startDate) === String(endDate)) return String(startDate)
  return `${startDate} ~ ${endDate}`
}

function athleteEventTitle(row: Partial<AthleteEventRecord>) {
  return text(row.title) || text(row.event_type) || '一般事件'
}

async function fetchBlocks() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blocks')
    .select('id, block_code, block_name, goal, training_element, description')
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as BlockRecord[]
}

async function fetchAthleteBlocks(athleteId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_blocks')
    .select('id, athlete_id, block_id, event_name, cycle_goal, scheduled_date, start_date, end_date, week_num, day_num, training_category, notes, created_at')
    .eq('athlete_id', athleteId)
    .order('id', { ascending: false })

  if (error) throw error
  return (data ?? []) as AthleteBlockRecord[]
}

async function fetchAthleteEvents(athleteId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_events')
    .select('id, athlete_id, title, event_type, start_date, end_date, notes, created_at')
    .eq('athlete_id', athleteId)
    .order('start_date', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteEventRecord[]
}

async function fetchAthleteBlockExercises(athleteBlockId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_block_exercises')
.select('id, athlete_block_id, section_name, section_order, exercise_name, sets, reps_or_time, equipment, intensity, weight, actual_sets, actual_weight, rest, video_url, notes, order_num')
    .eq('athlete_block_id', athleteBlockId)
    .order('section_order', { ascending: true })
    .order('order_num', { ascending: true })

  if (error) throw error
  return (data ?? []) as AthleteBlockExerciseRecord[]
}

async function fetchBlockSections(blockId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('block_sections')
    .select('id, block_id, section_name, order_num')
    .eq('block_id', blockId)
    .order('order_num', { ascending: true })

  if (error) throw error
  return (data ?? []) as BlockSectionRecord[]
}

async function fetchBlockExercises(blockId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('block_exercises')
    .select('id, block_id, section_id, exercise_name, sets, reps_or_time, equipment, intensity, weight, rest, video_url, order_num, notes')
    .eq('block_id', blockId)
    .order('order_num', { ascending: true })

  if (error) throw error
  return (data ?? []) as BlockExerciseRecord[]
}

function buildSectionsFromAssignmentRows(rows: AthleteBlockExerciseRecord[]): ExerciseSection[] {
  if (rows.length === 0) return []

  const grouped = new Map<string, { order: number; rows: ExerciseRow[] }>()

  for (const row of rows) {
    const sectionName = text(row.section_name) || '未命名區段'
    const sectionOrder = row.section_order ?? Number.MAX_SAFE_INTEGER
    const current = grouped.get(sectionName) ?? { order: sectionOrder, rows: [] }

    current.rows.push({
      id: String(row.id ?? ''),
      exercise_name: text(row.exercise_name),
      sets: text(row.sets),
      reps_or_time: text(row.reps_or_time),
      equipment: text(row.equipment),
      intensity: text(row.intensity),
      weight: text(row.weight),
      actual_sets: text(row.actual_sets),
      actual_weight: text(row.actual_weight),
      rest: text(row.rest),
      video_url: text(row.video_url),
      notes: text(row.notes),
      can_report: true,
    })

    grouped.set(sectionName, current)
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, value]) => ({ name, rows: value.rows }))
}

async function buildSectionsFromTemplate(blockId: number): Promise<ExerciseSection[]> {
  const [sections, exercises] = await Promise.all([fetchBlockSections(blockId), fetchBlockExercises(blockId)])
  if (exercises.length === 0) return []

  const sectionById = new Map<number, BlockSectionRecord>()
  const sectionOrderByName = new Map<string, number>()

  for (const section of sections) {
    sectionById.set(section.id, section)
    sectionOrderByName.set(text(section.section_name) || '未命名區段', section.order_num ?? Number.MAX_SAFE_INTEGER)
  }

  const grouped = new Map<string, { order: number; rows: ExerciseRow[] }>()

  for (const exercise of exercises) {
    const section = exercise.section_id ? sectionById.get(exercise.section_id) : null
    const sectionName = text(section?.section_name) || '未命名區段'
    const sectionOrder = section?.order_num ?? sectionOrderByName.get(sectionName) ?? Number.MAX_SAFE_INTEGER
    const current = grouped.get(sectionName) ?? { order: sectionOrder, rows: [] }

    current.rows.push({
      id: String(exercise.id ?? ''),
      exercise_name: text(exercise.exercise_name),
      sets: text(exercise.sets),
      reps_or_time: text(exercise.reps_or_time),
      equipment: text(exercise.equipment),
      intensity: text(exercise.intensity),
      weight: text(exercise.weight),
      actual_sets: '',
      actual_weight: '',
      rest: text(exercise.rest),
      video_url: text(exercise.video_url),
      notes: text(exercise.notes),
      can_report: false,
    })

    grouped.set(sectionName, current)
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name, value]) => ({ name, rows: value.rows }))
}

async function buildAssignmentDetail(row: AthleteBlockRecord, blocksById: Map<number, BlockRecord>): Promise<AssignmentDetail> {
  const block = row.block_id ? blocksById.get(row.block_id) ?? null : null
  const label = blockLabel(block, row.block_id)
  const assignmentRows = await fetchAthleteBlockExercises(row.id)
  const sections = assignmentRows.length > 0 || !row.block_id ? buildSectionsFromAssignmentRows(assignmentRows) : await buildSectionsFromTemplate(row.block_id)

  return {
    id: `assignment-${row.id}`,
    record_id: row.id,
    kind: 'assignment',
    block_id: row.block_id,
    block_label: label,
    meta: [`Week ${row.week_num ?? '-'} / Day ${row.day_num ?? '-'}`, dateRangeLabel(row), text(row.training_category) || '未分類', label]
      .filter(Boolean)
      .join('｜'),
    event_name: text(row.event_name),
    date_range: dateRangeLabel(row),
    start_date: text(row.start_date || row.scheduled_date),
    end_date: text(row.end_date || row.start_date || row.scheduled_date),
    week_num: row.week_num,
    day_num: row.day_num,
    training_category: text(row.training_category),
    cycle_goal: text(row.cycle_goal),
    goal: text(block?.goal),
    training_element: text(block?.training_element),
    description: text(block?.description),
    coach_notes: text(row.notes),
    sections,
    empty_message: '這個板塊目前沒有詳細動作內容。',
  }
}

function buildGeneralEventDetail(row: AthleteEventRecord): GeneralEventDetail {
  const title = athleteEventTitle(row)
  return {
    id: `event-${row.id}`,
    record_id: row.id,
    kind: 'general_event',
    block_label: title,
    meta: [text(row.event_type) || '一般事件', dateRangeLabel(row)].filter(Boolean).join('｜'),
    event_name: title,
    event_type: text(row.event_type) || '一般事件',
    start_date: text(row.start_date),
    end_date: text(row.end_date || row.start_date),
    date_range: dateRangeLabel(row),
    description: text(row.notes),
    empty_message: '這是一筆一般事件，沒有訓練動作內容。',
  }
}

export async function getBlockCatalog() {
  return await fetchBlocks()
}

export async function getAthleteScheduleBundle(athleteId: number): Promise<AthleteScheduleBundle> {
  const [blocks, athleteBlocks, athleteEvents] = await Promise.all([
    fetchBlocks(),
    fetchAthleteBlocks(athleteId),
    fetchAthleteEvents(athleteId),
  ])

  const blocksById = new Map<number, BlockRecord>(blocks.map((block) => [block.id, block]))
  const assignments = await Promise.all(athleteBlocks.map((row) => buildAssignmentDetail(row, blocksById)))
  const generalEvents = athleteEvents.map(buildGeneralEventDetail)

  return {
    assignments,
    generalEvents,
  }
}
