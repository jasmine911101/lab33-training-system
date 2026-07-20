import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  BlockExerciseDetail,
  BlockExerciseTemplateInput,
  ImportedBlockTemplate,
  BlockSectionDetail,
  BlockTemplatePayload,
  BlockTemplateRecord,
} from '@/lib/types/block-management'
import type { CoachProfile } from '@/services/coach'
import { toTemplatePayload } from '@/services/block-import'

type BlockRow = {
  id: number
  block_code: string | null
  block_name: string | null
  goal: string | null
  training_element: string | null
  description: string | null
  training_category_id: number | null
}

type BlockSectionRow = {
  id: number
  block_id: number
  section_name: string | null
  order_num: number | null
}

type BlockExerciseRow = BlockExerciseDetail

type AdminMutationResult<T> = {
  data?: T
  error?: string
  message?: string
}

type SupabaseLikeError = {
  code?: string
  message?: string
}

function cleanText(value: string | null | undefined) {
  return String(value ?? '').trim()
}

function normalizeUniqueValue(value: string | null | undefined) {
  return cleanText(value).toLocaleLowerCase('en-US')
}

function hasExerciseContent(row: BlockExerciseTemplateInput) {
  return cleanText(row.exercise_name).length > 0
}

function isMissingTrainingCategoryColumnError(error: unknown) {
  const maybeError = error as SupabaseLikeError | null | undefined
  return maybeError?.code === '42703' && String(maybeError?.message ?? '').includes('training_category_id')
}

async function ensureAdminClient() {
  const admin = createAdminClient()
  if (!admin) {
    return {
      admin: null,
      error: '尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法執行這個操作。',
    }
  }

  return { admin, error: null }
}

async function fetchBlockRowsByCategory(
  options?: {
    trainingCategoryId?: number
    uncategorizedOnly?: boolean
    blockIds?: number[]
  },
) {
  if (options?.blockIds && options.blockIds.length === 0) {
    return [] as BlockRow[]
  }

  if (options?.blockIds && options.blockIds.length > 0) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('blocks')
      .select('id, block_code, block_name, goal, training_element, description, training_category_id')
      .in('id', options.blockIds)
      .order('id', { ascending: true })

    if (error) throw error
    return (data ?? []) as BlockRow[]
  }

  if (options?.uncategorizedOnly || typeof options?.trainingCategoryId === 'number') {
    const supabase = await createClient()
    let query = supabase
      .from('blocks')
      .select('id, block_code, block_name, goal, training_element, description, training_category_id')
      .order('id', { ascending: true })

    if (options.uncategorizedOnly) {
      query = query.is('training_category_id', null)
    } else if (typeof options.trainingCategoryId === 'number') {
      query = query.eq('training_category_id', options.trainingCategoryId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as BlockRow[]
  }

  const supabase = await createClient()
  const query = supabase
    .from('blocks')
    .select('id, block_code, block_name, goal, training_element, description, training_category_id')
    .order('id', { ascending: true })

  const { data, error } = await query

  if (!error) {
    return (data ?? []) as BlockRow[]
  }

  if (!isMissingTrainingCategoryColumnError(error)) {
    throw error
  }

  const fallback = await supabase
    .from('blocks')
    .select('id, block_code, block_name, goal, training_element, description')
    .order('id', { ascending: true })

  if (fallback.error) throw fallback.error

  return (fallback.data ?? []).map((row) => ({
    ...row,
    training_category_id: null,
  })) as BlockRow[]
}

async function fetchBlockSections(blockIds?: number[]) {
  if (blockIds && blockIds.length === 0) return [] as BlockSectionRow[]

  const supabase = await createClient()
  let query = supabase
    .from('block_sections')
    .select('id, block_id, section_name, order_num')
    .order('block_id', { ascending: true })
    .order('order_num', { ascending: true })
    .order('id', { ascending: true })

  if (blockIds && blockIds.length > 0) {
    query = query.in('block_id', blockIds)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as BlockSectionRow[]
}

async function fetchBlockExercises(blockIds?: number[]) {
  if (blockIds && blockIds.length === 0) return [] as BlockExerciseRow[]

  const supabase = await createClient()
  let query = supabase
    .from('block_exercises')
    .select('id, block_id, section_id, exercise_name, sets, reps_or_time, equipment, intensity, weight, rest, video_url, notes, order_num')
    .order('block_id', { ascending: true })
    .order('order_num', { ascending: true })
    .order('id', { ascending: true })

  if (blockIds && blockIds.length > 0) {
    query = query.in('block_id', blockIds)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as BlockExerciseRow[]
}

function hydrateBlocks(
  blocks: BlockRow[],
  sections: BlockSectionRow[],
  exercises: BlockExerciseRow[],
): BlockTemplateRecord[] {
  return blocks.map((block) => {
    const sectionDetails: BlockSectionDetail[] = sections
      .filter((section) => section.block_id === block.id)
      .map((section) => ({
        ...section,
        exercises: exercises
          .filter((exercise) => exercise.block_id === block.id && exercise.section_id === section.id)
          .sort((left, right) => (left.order_num ?? 0) - (right.order_num ?? 0)),
      }))

    return {
      ...block,
      sectionCount: sectionDetails.length,
      exerciseCount: sectionDetails.reduce((sum, section) => sum + section.exercises.length, 0),
      sections: sectionDetails,
    }
  })
}

export async function fetchBlockIdentityRows() {
  return await fetchBlockIdentityRowsByCategory()
}

export async function fetchBlockIdentityRowsByCategory(
  options?: {
    trainingCategoryId?: number
    uncategorizedOnly?: boolean
  },
) {
  if (options?.uncategorizedOnly || typeof options?.trainingCategoryId === 'number') {
    const supabase = await createClient()
    let query = supabase
      .from('blocks')
      .select('id, block_code, block_name, training_category_id')
      .order('id', { ascending: true })

    if (options.uncategorizedOnly) {
      query = query.is('training_category_id', null)
    } else if (typeof options.trainingCategoryId === 'number') {
      query = query.eq('training_category_id', options.trainingCategoryId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as Array<{ id: number; block_code: string | null; block_name: string | null; training_category_id: number | null }>
  }

  const supabase = await createClient()
  const query = supabase
    .from('blocks')
    .select('id, block_code, block_name, training_category_id')
    .order('id', { ascending: true })

  const { data, error } = await query

  if (!error) {
    return (data ?? []) as Array<{ id: number; block_code: string | null; block_name: string | null; training_category_id: number | null }>
  }

  if (!isMissingTrainingCategoryColumnError(error)) {
    throw error
  }

  const fallback = await supabase
    .from('blocks')
    .select('id, block_code, block_name')
    .order('id', { ascending: true })

  if (fallback.error) throw fallback.error

  return (fallback.data ?? []).map((row) => ({
    ...row,
    training_category_id: null,
  })) as Array<{ id: number; block_code: string | null; block_name: string | null; training_category_id: number | null }>
}

function validateBlockIdentity(
  payload: BlockTemplatePayload,
  existingBlocks: Array<{ id: number; block_code: string | null; block_name: string | null }>,
  options?: { ignoreBlockId?: number },
) {
  const blockCode = cleanText(payload.blockCode || payload.blockName)
  const blockName = cleanText(payload.blockName || payload.blockCode)

  if (!blockCode || !blockName) {
    return '請先輸入 Block Code 與顯示名稱。'
  }

  const normalizedCode = normalizeUniqueValue(blockCode)
  const normalizedName = normalizeUniqueValue(blockName)
  const comparableBlocks = existingBlocks.filter((block) => block.id !== options?.ignoreBlockId)

  if (comparableBlocks.some((block) => normalizeUniqueValue(block.block_code) === normalizedCode)) {
    return `資料庫已存在相同 Block Code：${blockCode}`
  }

  if (comparableBlocks.some((block) => normalizeUniqueValue(block.block_name) === normalizedName)) {
    return `資料庫已存在相同顯示名稱：${blockName}`
  }

  return null
}

function sanitizeSections(payload: BlockTemplatePayload) {
  return payload.sections
    .map((section) => ({
      section_name: cleanText(section.section_name),
      exercises: section.exercises
        .filter(hasExerciseContent)
        .map((exercise) => ({
          exercise_name: cleanText(exercise.exercise_name),
          sets: cleanText(exercise.sets),
          reps_or_time: cleanText(exercise.reps_or_time),
          equipment: cleanText(exercise.equipment),
          intensity: cleanText(exercise.intensity),
          weight: cleanText(exercise.weight),
          rest: cleanText(exercise.rest),
          video_url: cleanText(exercise.video_url),
          notes: cleanText(exercise.notes),
        })),
    }))
    .filter((section) => section.section_name && section.exercises.length > 0)
}

async function getBlockSnapshotById(blockId: number) {
  const snapshot = await getBlockManagementSnapshot({ blockIds: [blockId] })
  return snapshot.blocks.find((block) => block.id === blockId) ?? null
}

async function writeTemplateSectionsAndExercises(
  admin: NonNullable<Awaited<ReturnType<typeof ensureAdminClient>>['admin']>,
  blockId: number,
  payload: BlockTemplatePayload,
) {
  const sanitizedSections = sanitizeSections(payload)
  const exerciseCount = sanitizedSections.reduce((sum, section) => sum + section.exercises.length, 0)
  if (exerciseCount === 0) {
    return { error: '請至少填入一個動作名稱。', exerciseCount: 0 }
  }

  const { error: deleteExercisesError } = await admin.from('block_exercises').delete().eq('block_id', blockId)
  if (deleteExercisesError) {
    return { error: deleteExercisesError.message, exerciseCount: 0 }
  }

  const { error: deleteSectionsError } = await admin.from('block_sections').delete().eq('block_id', blockId)
  if (deleteSectionsError) {
    return { error: deleteSectionsError.message, exerciseCount: 0 }
  }

  for (const [sectionIndex, section] of sanitizedSections.entries()) {
    const { data: insertedSection, error: insertSectionError } = await admin
      .from('block_sections')
      .insert({
        block_id: blockId,
        section_name: section.section_name,
        order_num: sectionIndex + 1,
      })
      .select('id')
      .single()

    if (insertSectionError || !insertedSection) {
      return { error: insertSectionError?.message ?? '建立板塊區段失敗。', exerciseCount: 0 }
    }

    const exerciseRows = section.exercises.map((exercise, exerciseIndex) => ({
      block_id: blockId,
      section_id: insertedSection.id,
      exercise_name: exercise.exercise_name,
      sets: exercise.sets,
      reps_or_time: exercise.reps_or_time,
      equipment: exercise.equipment,
      intensity: exercise.intensity,
      weight: exercise.weight,
      rest: exercise.rest,
      video_url: exercise.video_url,
      notes: exercise.notes,
      order_num: exerciseIndex + 1,
    }))

    const { error: insertExerciseError } = await admin.from('block_exercises').insert(exerciseRows)
    if (insertExerciseError) {
      return { error: insertExerciseError.message, exerciseCount: 0 }
    }
  }

  return { error: null, exerciseCount }
}

export async function getBlockManagementSnapshot(options?: { trainingCategoryId?: number; uncategorizedOnly?: boolean; blockIds?: number[] }) {
  const blocks = await fetchBlockRowsByCategory(options)
  const blockIds = blocks.map((block) => block.id)
  const [sections, exercises] = await Promise.all([
    fetchBlockSections(blockIds),
    fetchBlockExercises(blockIds),
  ])

  return {
    blocks: hydrateBlocks(blocks, sections, exercises),
  }
}

export async function getBlocksByTrainingCategoryId(trainingCategoryId: number) {
  return await getBlockManagementSnapshot({ trainingCategoryId })
}

export async function getUncategorizedBlocks() {
  return await getBlockManagementSnapshot({ uncategorizedOnly: true })
}

export async function createBlockTemplateForCoach(
  coachProfile: CoachProfile,
  payload: BlockTemplatePayload,
): Promise<AdminMutationResult<BlockTemplateRecord>> {
  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法執行板塊建立。' }

  const existingBlocks = await fetchBlockIdentityRows()
  const identityError = validateBlockIdentity(payload, existingBlocks)
  if (identityError) {
    return { error: identityError }
  }

  const blockCode = cleanText(payload.blockCode || payload.blockName)
  const blockName = cleanText(payload.blockName || payload.blockCode)

  const { data: insertedBlock, error: insertBlockError } = await admin
    .from('blocks')
    .insert({
      block_code: blockCode,
      block_name: blockName,
      goal: cleanText(payload.goal),
      training_element: cleanText(payload.trainingElement),
      description: cleanText(payload.description) || '由手動模板建立',
      ...(typeof payload.trainingCategoryId === 'number' ? { training_category_id: payload.trainingCategoryId } : {}),
    })
    .select('id')
    .single()

  if (insertBlockError || !insertedBlock) {
    return { error: insertBlockError?.message ?? '建立板塊失敗。' }
  }

  const writeResult = await writeTemplateSectionsAndExercises(admin, insertedBlock.id, payload)
  if (writeResult.error) {
    return { error: writeResult.error }
  }

  const createdBlock = await getBlockSnapshotById(Number(insertedBlock.id))
  if (!createdBlock) {
    return { error: '板塊已建立，但重新讀取詳細內容失敗。' }
  }

  return {
    data: createdBlock,
    message: `已建立板塊模板，共寫入 ${writeResult.exerciseCount} 個動作。`,
  }
}

export async function updateBlockTemplateForCoach(
  coachProfile: CoachProfile,
  blockId: number,
  payload: BlockTemplatePayload,
): Promise<AdminMutationResult<BlockTemplateRecord>> {
  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法執行板塊更新。' }

  const { data: blockRow, error: blockError } = await admin
    .from('blocks')
    .select('id')
    .eq('id', blockId)
    .maybeSingle()

  if (blockError) {
    return { error: blockError.message }
  }

  if (!blockRow) {
    return { error: '找不到要編輯的板塊。' }
  }

  const existingBlocks = await fetchBlockIdentityRows()
  const identityError = validateBlockIdentity(payload, existingBlocks, { ignoreBlockId: blockId })
  if (identityError) {
    return { error: identityError }
  }

  const blockCode = cleanText(payload.blockCode || payload.blockName)
  const blockName = cleanText(payload.blockName || payload.blockCode)

  const { error: updateBlockError } = await admin
    .from('blocks')
    .update({
      block_code: blockCode,
      block_name: blockName,
      goal: cleanText(payload.goal),
      training_element: cleanText(payload.trainingElement),
      description: cleanText(payload.description) || '由手動模板建立',
      training_category_id: typeof payload.trainingCategoryId === 'number' ? payload.trainingCategoryId : null,
    })
    .eq('id', blockId)

  if (updateBlockError) {
    return { error: updateBlockError.message }
  }

  const writeResult = await writeTemplateSectionsAndExercises(admin, blockId, payload)
  if (writeResult.error) {
    return { error: writeResult.error }
  }

  const updatedBlock = await getBlockSnapshotById(blockId)
  if (!updatedBlock) {
    return { error: '板塊已更新，但重新讀取詳細內容失敗。' }
  }

  return {
    data: updatedBlock,
    message: `已更新板塊模板，共寫入 ${writeResult.exerciseCount} 個動作。`,
  }
}

export async function importBlockTemplatesForCoach(
  coachProfile: CoachProfile,
  blocks: ImportedBlockTemplate[],
  description: string,
  options?: {
    trainingCategoryId?: number | null
  },
): Promise<AdminMutationResult<{ importedCount: number; importedBlocks: BlockTemplateRecord[] }>> {
  const importedBlocks: BlockTemplateRecord[] = []

  for (const block of blocks) {
    const result = await createBlockTemplateForCoach(coachProfile, {
      ...toTemplatePayload(block, description),
      trainingCategoryId: typeof options?.trainingCategoryId === 'number' ? options.trainingCategoryId : null,
    })
    if (result.error || !result.data) {
      return {
        error: result.error ?? `匯入板塊 ${block.sheetName} 失敗。`,
      }
    }
    importedBlocks.push(result.data)
  }

  return {
    data: {
      importedCount: importedBlocks.length,
      importedBlocks,
    },
    message: `已從 Excel 匯入 ${importedBlocks.length} 個板塊。`,
  }
}

export async function deleteBlockTemplateForCoach(
  blockId: number,
): Promise<AdminMutationResult<{ blockId: number }>> {
  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法執行板塊刪除。' }

  const { data: blockRow, error: blockError } = await admin
    .from('blocks')
    .select('id')
    .eq('id', blockId)
    .maybeSingle()

  if (blockError) {
    return { error: blockError.message }
  }

  if (!blockRow) {
    return { error: '找不到要刪除的板塊。' }
  }

  const { data: productBlocks, error: productBlocksError } = await admin
    .from('training_product_blocks')
    .select('id')
    .eq('block_id', blockId)

  if (productBlocksError && productBlocksError.code !== 'PGRST205') {
    return { error: productBlocksError.message }
  }

  const { data: athleteBlocks, error: athleteBlocksError } = await admin
    .from('athlete_blocks')
    .select('id')
    .eq('block_id', blockId)

  if (athleteBlocksError) {
    return { error: athleteBlocksError.message }
  }

  const { data: programBlocks, error: programBlocksError } = await admin
    .from('athlete_program_blocks')
    .select('id')
    .eq('block_id', blockId)

  if (programBlocksError && programBlocksError.code !== 'PGRST205') {
    return { error: programBlocksError.message }
  }

  const productUsageCount = productBlocks?.length ?? 0
  const scheduleUsageCount = athleteBlocks?.length ?? 0
  const programUsageCount = programBlocks?.length ?? 0

  if (productUsageCount + scheduleUsageCount + programUsageCount > 0) {
    return {
      error: `此板塊已被引用，無法直接刪除。商品 ${productUsageCount} 筆、課表 ${scheduleUsageCount} 筆、方案 ${programUsageCount} 筆。請保留此板塊或改用封存分類。`,
    }
  }

  const { error: deleteExercisesError } = await admin.from('block_exercises').delete().eq('block_id', blockId)
  if (deleteExercisesError) {
    return { error: deleteExercisesError.message }
  }

  const { error: deleteSectionsError } = await admin.from('block_sections').delete().eq('block_id', blockId)
  if (deleteSectionsError) {
    return { error: deleteSectionsError.message }
  }

  const { error: deleteBlockError } = await admin.from('blocks').delete().eq('id', blockId)
  if (deleteBlockError) {
    return { error: deleteBlockError.message }
  }

  return {
    data: { blockId },
    message: '已刪除未被引用的板塊模板。',
  }
}
