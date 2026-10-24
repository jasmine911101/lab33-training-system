import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { BlockExerciseDetail } from '@/lib/types/block-management'
import type { BlockTransferInput, BlockTransferResult } from '@/lib/types/block-transfer'
import { fetchBlockIdentityRows, getBlockManagementSnapshot } from '@/services/block-management'
import { getTaxonomySelectionSnapshot } from '@/services/block-taxonomy'

// 只由通過教練驗證的 API 呼叫；不接收瀏覽器提供的角色或教練 ID。
export async function transferBlock(blockId: number, input: BlockTransferInput): Promise<BlockTransferResult> {
  if (!Number.isSafeInteger(blockId) || blockId <= 0) {
    throw new Error('板塊 ID 不正確。')
  }
  if (!Number.isSafeInteger(input.trainingCategoryId) || input.trainingCategoryId <= 0) {
    throw new Error('請選擇有效的目標分類。')
  }
  if (input.mode !== 'move' && input.mode !== 'copy') {
    throw new Error('請選擇移動或複製。')
  }

  const admin = createAdminClient()
  if (!admin) {
    throw new Error('系統尚未完成設定，請聯絡管理員。')
  }

  const taxonomy = await getTaxonomySelectionSnapshot()
  const category = taxonomy.trainingCategories.find((entry) => entry.id === input.trainingCategoryId)
  const ageGroup = taxonomy.ageGroups.find((entry) => entry.id === category?.age_group_id)
  const sport = taxonomy.sports.find((entry) => entry.id === ageGroup?.sport_id)
  if (!category || !ageGroup || !sport) {
    throw new Error('目標分類不存在或已停用，請重新選擇。')
  }

  const snapshot = await getBlockManagementSnapshot({ blockIds: [blockId] })
  const source = snapshot.blocks.find((entry) => entry.id === blockId)
  if (!source) {
    throw new Error('找不到原板塊，請重新整理後再試。')
  }
  if (source.training_category_id === category.id) {
    throw new Error('請選擇與原板塊不同的分類。')
  }

  const targetPath = `/coach/blocks/sport/${sport.id}/age/${ageGroup.id}/category/${category.id}`
  if (input.mode === 'move') {
    // 只改分類，不更動板塊 ID、區段、動作或任何已安排的課表。
    const { data, error } = await admin.from('blocks')
      .update({ training_category_id: category.id })
      .eq('id', blockId)
      .select('id')
      .maybeSingle()
    if (error) {
      throw new Error('移動失敗，請稍後再試。')
    }
    if (!data) {
      throw new Error('原板塊已不存在，請重新整理。')
    }
    return {
      blockId,
      targetPath,
      message: `已移動到「${sport.name}／${ageGroup.name}／${category.name}」。既有課表保持不變。`,
    }
  }

  const blockCode = input.blockCode?.trim() ?? ''
  const blockName = input.blockName?.trim() ?? ''
  if (!blockCode || !blockName) {
    throw new Error('請填寫副本的板塊代碼與名稱。')
  }
  const existing = await fetchBlockIdentityRows()
  if (existing.some((entry) => entry.block_code?.trim().toLocaleLowerCase('en-US') === blockCode.toLocaleLowerCase('en-US'))) {
    throw new Error('副本的板塊代碼已存在，請換一個代碼。')
  }
  if (existing.some((entry) => entry.block_name?.trim().toLocaleLowerCase('en-US') === blockName.toLocaleLowerCase('en-US'))) {
    throw new Error('副本的板塊名稱已存在，請換一個名稱。')
  }

  // 連同舊資料中尚未放入區段的動作一起讀取，避免複製時遺漏。
  const { data: exerciseRows, error: readError } = await admin.from('block_exercises')
    .select('id, block_id, section_id, exercise_name, sets, reps_or_time, equipment, intensity, weight, rest, video_url, notes, order_num')
    .eq('block_id', source.id)
  if (readError) {
    throw new Error('無法讀取原板塊動作，請稍後再試。')
  }
  const sourceExercises = (exerciseRows ?? []) as BlockExerciseDetail[]

  const { data: inserted, error: insertError } = await admin.from('blocks').insert({
    block_code: blockCode,
    block_name: blockName,
    goal: source.goal,
    training_element: source.training_element,
    description: source.description,
    training_category_id: category.id,
  }).select('id').single()
  if (insertError || !inserted) {
    throw new Error('無法建立副本，請確認代碼與名稱未重複，再重新嘗試。')
  }

  const copyId = Number(inserted.id)
  try {
    // 每個區段與動作都建立新 ID；所有訓練內容、備註及順序保留。
    const copiedSectionIds = new Map<number, number>()
    for (const section of source.sections) {
      const { data: copiedSection, error: sectionError } = await admin.from('block_sections').insert({
        block_id: copyId,
        section_name: section.section_name,
        order_num: section.order_num,
      }).select('id').single()
      if (sectionError || !copiedSection) {
        throw new Error('複製區段失敗。')
      }
      copiedSectionIds.set(section.id, Number(copiedSection.id))
    }
    if (sourceExercises.length > 0) {
      const exercises = sourceExercises.map((exercise) => {
        // 舊動作可能沒有區段；有區段時則改用副本的新區段 ID。
        let sectionId: number | null | undefined = null
        if (exercise.section_id !== null) {
          sectionId = copiedSectionIds.get(exercise.section_id)
        }
        if (sectionId === undefined) {
          throw new Error('原板塊的區段資料不完整。')
        }
        return {
          block_id: copyId,
          section_id: sectionId,
          exercise_name: exercise.exercise_name,
          sets: exercise.sets,
          reps_or_time: exercise.reps_or_time,
          equipment: exercise.equipment,
          intensity: exercise.intensity,
          weight: exercise.weight,
          rest: exercise.rest,
          video_url: exercise.video_url,
          notes: exercise.notes,
          order_num: exercise.order_num,
        }
      })
      const { error: exerciseError } = await admin.from('block_exercises').insert(exercises)
      if (exerciseError) {
        throw new Error('複製動作失敗。')
      }
    }
  } catch {
    // 複製中斷時只清理這次新建的副本，不碰來源與課表。
    try {
      for (const table of ['block_exercises', 'block_sections', 'blocks']) {
        let column = 'block_id'
        if (table === 'blocks') {
          column = 'id'
        }
        const { error } = await admin.from(table).delete().eq(column, copyId)
        if (error) {
          throw error
        }
      }
    } catch {
      throw new Error(`複製未完成，副本 ID ${copyId} 可能有不完整資料。原板塊未變更，請聯絡管理員處理後再試。`)
    }
    throw new Error('複製未完成，已移除這次建立的副本。原板塊未變更，請稍後再試。')
  }

  return {
    blockId: copyId,
    targetPath,
    message: `已在「${sport.name}／${ageGroup.name}／${category.name}」建立獨立副本。原板塊與既有課表保持不變。`,
  }
}
