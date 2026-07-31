import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  BlockTaxonomyAgeGroupRecord,
  BlockTaxonomyAgeGroupSummary,
  BlockTaxonomySportRecord,
  BlockTaxonomySportSummary,
  BlockTaxonomyTrainingCategoryRecord,
  BlockTaxonomyTrainingCategorySummary,
} from '@/lib/types/block-taxonomy'

type AdminMutationResult<T> = {
  data?: T
  error?: string
  message?: string
}

function cleanName(value: string | null | undefined) {
  return String(value ?? '').trim()
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


async function getTaxonomyReadClient() {
  const admin = createAdminClient()
  if (admin) {
    return admin
  }

  return await createClient()
}

function humanizeUniqueViolation(message: string, fallback: string) {
  if (message.includes('duplicate key value')) {
    return fallback
  }

  return message
}

export async function getTaxonomyRootSummary(): Promise<{
  sports: BlockTaxonomySportSummary[]
  uncategorizedBlockCount: number
}> {
  const supabase = await getTaxonomyReadClient()

  const [{ data: sports, error: sportError }, { data: ageGroups, error: ageError }, { count, error: blockError }] = await Promise.all([
    supabase
      .from('block_taxonomy_sports')
      .select('id, name, sort_order, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase
      .from('block_taxonomy_age_groups')
      .select('id, sport_id')
      .eq('is_active', true),
    supabase
      .from('blocks')
      .select('id', { count: 'exact', head: true })
      .is('training_category_id', null),
  ])

  if (sportError) throw sportError
  if (ageError) throw ageError
  if (blockError) throw blockError

  const ageGroupCountBySport = new Map<number, number>()
  for (const row of ageGroups ?? []) {
    const sportId = Number(row.sport_id)
    ageGroupCountBySport.set(sportId, (ageGroupCountBySport.get(sportId) ?? 0) + 1)
  }

  return {
    sports: ((sports ?? []) as BlockTaxonomySportRecord[]).map((sport) => ({
      ...sport,
      ageGroupCount: ageGroupCountBySport.get(sport.id) ?? 0,
    })),
    uncategorizedBlockCount: count ?? 0,
  }
}

export async function getSportById(sportId: number) {
  const supabase = await getTaxonomyReadClient()
  const { data, error } = await supabase
    .from('block_taxonomy_sports')
    .select('id, name, sort_order, is_active, created_at, updated_at')
    .eq('id', sportId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BlockTaxonomySportRecord | null
}

export async function getAgeGroupById(ageGroupId: number) {
  const supabase = await getTaxonomyReadClient()
  const { data, error } = await supabase
    .from('block_taxonomy_age_groups')
    .select('id, sport_id, name, sort_order, is_active, created_at, updated_at')
    .eq('id', ageGroupId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BlockTaxonomyAgeGroupRecord | null
}

export async function getTrainingCategoryById(trainingCategoryId: number) {
  const supabase = await getTaxonomyReadClient()
  const { data, error } = await supabase
    .from('block_taxonomy_training_categories')
    .select('id, age_group_id, name, sort_order, is_active, created_at, updated_at')
    .eq('id', trainingCategoryId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BlockTaxonomyTrainingCategoryRecord | null
}

export async function getAgeGroupsForSport(sportId: number): Promise<BlockTaxonomyAgeGroupSummary[]> {
  const supabase = await getTaxonomyReadClient()
  const [{ data: ageGroups, error: ageError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase
      .from('block_taxonomy_age_groups')
      .select('id, sport_id, name, sort_order, is_active, created_at, updated_at')
      .eq('sport_id', sportId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase
      .from('block_taxonomy_training_categories')
      .select('id, age_group_id')
      .eq('is_active', true),
  ])

  if (ageError) throw ageError
  if (categoryError) throw categoryError

  const categoryCountByAgeGroup = new Map<number, number>()
  for (const row of categories ?? []) {
    const ageGroupId = Number(row.age_group_id)
    categoryCountByAgeGroup.set(ageGroupId, (categoryCountByAgeGroup.get(ageGroupId) ?? 0) + 1)
  }

  return ((ageGroups ?? []) as BlockTaxonomyAgeGroupRecord[]).map((ageGroup) => ({
    ...ageGroup,
    trainingCategoryCount: categoryCountByAgeGroup.get(ageGroup.id) ?? 0,
  }))
}

export async function getTrainingCategoriesForAgeGroup(ageGroupId: number): Promise<BlockTaxonomyTrainingCategorySummary[]> {
  const supabase = await getTaxonomyReadClient()
  const [{ data: categories, error: categoryError }, { data: blocks, error: blockError }] = await Promise.all([
    supabase
      .from('block_taxonomy_training_categories')
      .select('id, age_group_id, name, sort_order, is_active, created_at, updated_at')
      .eq('age_group_id', ageGroupId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase
      .from('blocks')
      .select('id, training_category_id')
      .not('training_category_id', 'is', null),
  ])

  if (categoryError) throw categoryError
  if (blockError) throw blockError

  const blockCountByCategory = new Map<number, number>()
  for (const row of blocks ?? []) {
    const categoryId = Number(row.training_category_id)
    if (Number.isFinite(categoryId)) {
      blockCountByCategory.set(categoryId, (blockCountByCategory.get(categoryId) ?? 0) + 1)
    }
  }

  return ((categories ?? []) as BlockTaxonomyTrainingCategoryRecord[]).map((category) => ({
    ...category,
    blockCount: blockCountByCategory.get(category.id) ?? 0,
  }))
}

export async function createSport(name: string): Promise<AdminMutationResult<BlockTaxonomySportRecord>> {
  const cleanedName = cleanName(name)
  if (!cleanedName) return { error: '請先輸入專項名稱。' }

  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法建立專項。' }

  const { data, error: insertError } = await admin
    .from('block_taxonomy_sports')
    .insert({ name: cleanedName })
    .select('id, name, sort_order, is_active, created_at, updated_at')
    .single()

  if (insertError || !data) {
    return {
      error: humanizeUniqueViolation(insertError?.message ?? '建立專項失敗。', '這個專項名稱已存在。'),
    }
  }

  return { data: data as BlockTaxonomySportRecord, message: '已建立專項分類。' }
}

export async function createAgeGroup(sportId: number, name: string): Promise<AdminMutationResult<BlockTaxonomyAgeGroupRecord>> {
  const cleanedName = cleanName(name)
  if (!cleanedName) return { error: '請先輸入年齡分級名稱。' }

  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法建立年齡分級。' }

  const { data, error: insertError } = await admin
    .from('block_taxonomy_age_groups')
    .insert({ sport_id: sportId, name: cleanedName })
    .select('id, sport_id, name, sort_order, is_active, created_at, updated_at')
    .single()

  if (insertError || !data) {
    return {
      error: humanizeUniqueViolation(insertError?.message ?? '建立年齡分級失敗。', '這個專項底下已存在相同年齡分級。'),
    }
  }

  return { data: data as BlockTaxonomyAgeGroupRecord, message: '已建立年齡分級。' }
}

export async function createTrainingCategory(ageGroupId: number, name: string): Promise<AdminMutationResult<BlockTaxonomyTrainingCategoryRecord>> {
  const cleanedName = cleanName(name)
  if (!cleanedName) return { error: '請先輸入訓練分類名稱。' }

  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法建立訓練分類。' }

  const { data, error: insertError } = await admin
    .from('block_taxonomy_training_categories')
    .insert({ age_group_id: ageGroupId, name: cleanedName })
    .select('id, age_group_id, name, sort_order, is_active, created_at, updated_at')
    .single()

  if (insertError || !data) {
    return {
      error: humanizeUniqueViolation(insertError?.message ?? '建立訓練分類失敗。', '這個年齡分級底下已存在相同訓練分類。'),
    }
  }

  return { data: data as BlockTaxonomyTrainingCategoryRecord, message: '已建立訓練分類。' }
}

async function updateTaxonomyName<T>(table: string, id: number, name: string, select: string, duplicateMessage: string): Promise<AdminMutationResult<T>> {
  const cleanedName = cleanName(name)
  if (!cleanedName) return { error: '請輸入分類名稱。' }

  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法更新分類。' }

  const { data, error: updateError } = await admin
    .from(table)
    .update({ name: cleanedName })
    .eq('id', id)
    .select(select)
    .maybeSingle()

  if (updateError || !data) {
    return { error: humanizeUniqueViolation(updateError?.message ?? '找不到這個分類。', duplicateMessage) }
  }

  return { data: data as T, message: '分類名稱已更新。' }
}

export async function updateSport(sportId: number, name: string) {
  return await updateTaxonomyName<BlockTaxonomySportRecord>(
    'block_taxonomy_sports',
    sportId,
    name,
    'id, name, sort_order, is_active, created_at, updated_at',
    '這個專項名稱已存在。',
  )
}

export async function updateAgeGroup(ageGroupId: number, name: string) {
  return await updateTaxonomyName<BlockTaxonomyAgeGroupRecord>(
    'block_taxonomy_age_groups',
    ageGroupId,
    name,
    'id, sport_id, name, sort_order, is_active, created_at, updated_at',
    '這個專項底下已存在相同年齡分級。',
  )
}

export async function updateTrainingCategory(trainingCategoryId: number, name: string) {
  return await updateTaxonomyName<BlockTaxonomyTrainingCategoryRecord>(
    'block_taxonomy_training_categories',
    trainingCategoryId,
    name,
    'id, age_group_id, name, sort_order, is_active, created_at, updated_at',
    '這個年齡分級底下已存在相同訓練分類。',
  )
}

async function deleteTaxonomyEntry(table: string, id: number, dependentTable: string, dependentColumn: string, blockedMessage: string): Promise<AdminMutationResult<{ id: number }>> {
  const { admin, error } = await ensureAdminClient()
  if (!admin) return { error: error ?? '無法刪除分類。' }

  const { count, error: countError } = await admin
    .from(dependentTable)
    .select('id', { count: 'exact', head: true })
    .eq(dependentColumn, id)

  if (countError) return { error: countError.message }
  if ((count ?? 0) > 0) return { error: blockedMessage.replace('{count}', String(count)) }

  const { error: deleteError } = await admin.from(table).delete().eq('id', id)
  if (deleteError) return { error: deleteError.message }
  return { data: { id }, message: '分類已刪除。' }
}

export async function deleteSport(sportId: number) {
  return await deleteTaxonomyEntry(
    'block_taxonomy_sports',
    sportId,
    'block_taxonomy_age_groups',
    'sport_id',
    '此專項仍有 {count} 個年齡分級；請先處理下層資料夾。',
  )
}

export async function deleteAgeGroup(ageGroupId: number) {
  return await deleteTaxonomyEntry(
    'block_taxonomy_age_groups',
    ageGroupId,
    'block_taxonomy_training_categories',
    'age_group_id',
    '此年齡分級仍有 {count} 個訓練分類；請先處理下層資料夾。',
  )
}

export async function deleteTrainingCategory(trainingCategoryId: number) {
  return await deleteTaxonomyEntry(
    'block_taxonomy_training_categories',
    trainingCategoryId,
    'blocks',
    'training_category_id',
    '此訓練分類仍有 {count} 個板塊；請先移除或重新分類板塊。',
  )
}

export async function getTaxonomySelectionSnapshot(): Promise<{
  sports: BlockTaxonomySportRecord[]
  ageGroups: BlockTaxonomyAgeGroupRecord[]
  trainingCategories: BlockTaxonomyTrainingCategoryRecord[]
}> {
  const supabase = await getTaxonomyReadClient()
  const [{ data: sports, error: sportsError }, { data: ageGroups, error: ageGroupsError }, { data: trainingCategories, error: trainingCategoriesError }] = await Promise.all([
    supabase
      .from('block_taxonomy_sports')
      .select('id, name, sort_order, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase
      .from('block_taxonomy_age_groups')
      .select('id, sport_id, name, sort_order, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
    supabase
      .from('block_taxonomy_training_categories')
      .select('id, age_group_id, name, sort_order, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
  ])

  if (sportsError) throw sportsError
  if (ageGroupsError) throw ageGroupsError
  if (trainingCategoriesError) throw trainingCategoriesError

  return {
    sports: (sports ?? []) as BlockTaxonomySportRecord[],
    ageGroups: (ageGroups ?? []) as BlockTaxonomyAgeGroupRecord[],
    trainingCategories: (trainingCategories ?? []) as BlockTaxonomyTrainingCategoryRecord[],
  }
}
