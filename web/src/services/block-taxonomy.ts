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

export type BlockTaxonomyNodeType = 'sport' | 'age_group' | 'training_category'

export type ReferencedBlockUsage = {
  products: number
  schedules: number
  teamPrograms: number
  results: number
}

export type ReferencedBlockPreview = {
  blockId: number
  blockCode: string | null
  displayName: string | null
  usage: ReferencedBlockUsage
}

export type BlockTaxonomyDeletePreview = {
  nodeType: BlockTaxonomyNodeType
  nodeId: number
  nodeName: string
  directChildTaxonomyCount: number
  descendantTaxonomyCount: number
  blockCount: number
  deletableBlocks: number
  referencedBlocks: ReferencedBlockPreview[]
  permanentDeleteAllowed: boolean
  archiveAvailable: boolean
}

type TaxonomyDescendantContext = {
  nodeName: string
  sportIds: number[]
  ageGroupIds: number[]
  trainingCategoryIds: number[]
  directChildTaxonomyCount: number
  descendantTaxonomyCount: number
}

function normalizeTaxonomyNodeType(value: string): BlockTaxonomyNodeType | null {
  if (value === 'sport' || value === 'sports') return 'sport'
  if (value === 'age_group' || value === 'age-groups' || value === 'ageGroup') return 'age_group'
  if (value === 'training_category' || value === 'training-categories' || value === 'trainingCategory') return 'training_category'
  return null
}

function normalizeTaxonomyName(value: unknown) {
  return cleanName(String(value ?? '')).normalize('NFKC')
}

function normalizeTaxonomyComparableName(value: unknown) {
  return normalizeTaxonomyName(value).toLocaleLowerCase('zh-TW')
}

function isMissingRelationError(error: unknown) {
  const maybeError = error as { code?: string; message?: string } | null | undefined
  return maybeError?.code === 'PGRST205' || String(maybeError?.message ?? '').includes('Could not find the table')
}

async function requireTaxonomyAdmin() {
  const { admin, error } = await ensureAdminClient()
  if (!admin) throw new Error(error ?? '無法執行分類管理操作。')
  return admin
}

async function getTaxonomyDescendantContext(admin: NonNullable<ReturnType<typeof createAdminClient>>, nodeType: BlockTaxonomyNodeType, nodeId: number): Promise<TaxonomyDescendantContext | null> {
  if (nodeType === 'sport') {
    const { data: sport, error } = await admin.from('block_taxonomy_sports').select('id, name').eq('id', nodeId).maybeSingle()
    if (error) throw error
    if (!sport) return null

    const { data: ageGroups, error: ageError } = await admin.from('block_taxonomy_age_groups').select('id').eq('sport_id', nodeId)
    if (ageError) throw ageError
    const ageGroupIds = (ageGroups ?? []).map((row) => Number(row.id))

    let trainingCategoryIds: number[] = []
    if (ageGroupIds.length > 0) {
      const { data: categories, error: categoryError } = await admin.from('block_taxonomy_training_categories').select('id').in('age_group_id', ageGroupIds)
      if (categoryError) throw categoryError
      trainingCategoryIds = (categories ?? []).map((row) => Number(row.id))
    }

    return {
      nodeName: String(sport.name),
      sportIds: [nodeId],
      ageGroupIds,
      trainingCategoryIds,
      directChildTaxonomyCount: ageGroupIds.length,
      descendantTaxonomyCount: ageGroupIds.length + trainingCategoryIds.length,
    }
  }

  if (nodeType === 'age_group') {
    const { data: ageGroup, error } = await admin.from('block_taxonomy_age_groups').select('id, name').eq('id', nodeId).maybeSingle()
    if (error) throw error
    if (!ageGroup) return null

    const { data: categories, error: categoryError } = await admin.from('block_taxonomy_training_categories').select('id').eq('age_group_id', nodeId)
    if (categoryError) throw categoryError
    const trainingCategoryIds = (categories ?? []).map((row) => Number(row.id))

    return {
      nodeName: String(ageGroup.name),
      sportIds: [],
      ageGroupIds: [nodeId],
      trainingCategoryIds,
      directChildTaxonomyCount: trainingCategoryIds.length,
      descendantTaxonomyCount: trainingCategoryIds.length,
    }
  }

  const { data: trainingCategory, error } = await admin.from('block_taxonomy_training_categories').select('id, name').eq('id', nodeId).maybeSingle()
  if (error) throw error
  if (!trainingCategory) return null

  return {
    nodeName: String(trainingCategory.name),
    sportIds: [],
    ageGroupIds: [],
    trainingCategoryIds: [nodeId],
    directChildTaxonomyCount: 0,
    descendantTaxonomyCount: 0,
  }
}

async function countRowsForBlocks(admin: NonNullable<ReturnType<typeof createAdminClient>>, tableName: string, blockIds: number[]) {
  if (blockIds.length === 0) return [] as Array<Record<string, unknown>>
  const { data, error } = await admin.from(tableName).select('*').in('block_id', blockIds)
  if (error) {
    if (isMissingRelationError(error)) return []
    throw error
  }
  return (data ?? []) as Array<Record<string, unknown>>
}

export async function getBlockTaxonomyDeletePreview(nodeTypeValue: string, nodeId: number): Promise<AdminMutationResult<BlockTaxonomyDeletePreview>> {
  const nodeType = normalizeTaxonomyNodeType(nodeTypeValue)
  if (!nodeType || !Number.isFinite(nodeId)) return { error: '分類參數不正確。' }

  try {
    const admin = await requireTaxonomyAdmin()
    const context = await getTaxonomyDescendantContext(admin, nodeType, nodeId)
    if (!context) return { error: '找不到分類。' }

    let blocks: Array<{ id: number; block_code: string | null; block_name: string | null }> = []
    if (context.trainingCategoryIds.length > 0) {
      const { data, error } = await admin
        .from('blocks')
        .select('id, block_code, block_name')
        .in('training_category_id', context.trainingCategoryIds)
      if (error) throw error
      blocks = (data ?? []) as Array<{ id: number; block_code: string | null; block_name: string | null }>
    }

    const blockIds = blocks.map((block) => Number(block.id))
    const usageByBlock = new Map<number, ReferencedBlockUsage>()
    for (const blockId of blockIds) {
      usageByBlock.set(blockId, { products: 0, schedules: 0, teamPrograms: 0, results: 0 })
    }

    const productRows = await countRowsForBlocks(admin, 'training_product_blocks', blockIds)
    for (const row of productRows) {
      const blockId = Number(row.block_id)
      const usage = usageByBlock.get(blockId)
      if (usage) usage.products += 1
    }

    const scheduleRows = await countRowsForBlocks(admin, 'athlete_blocks', blockIds)
    const athleteBlockIdToBlockId = new Map<number, number>()
    for (const row of scheduleRows) {
      const blockId = Number(row.block_id)
      const athleteBlockId = Number(row.id)
      if (Number.isFinite(athleteBlockId)) athleteBlockIdToBlockId.set(athleteBlockId, blockId)
      const usage = usageByBlock.get(blockId)
      if (usage) usage.schedules += 1
    }

    const athleteBlockIds = Array.from(athleteBlockIdToBlockId.keys())
    if (athleteBlockIds.length > 0) {
      const { data: resultRows, error: resultError } = await admin
        .from('athlete_block_exercises')
        .select('athlete_block_id')
        .in('athlete_block_id', athleteBlockIds)
      if (resultError && !isMissingRelationError(resultError)) throw resultError
      for (const row of resultRows ?? []) {
        const blockId = athleteBlockIdToBlockId.get(Number(row.athlete_block_id))
        const usage = blockId ? usageByBlock.get(blockId) : null
        if (usage) usage.results += 1
      }
    }

    const programRows = await countRowsForBlocks(admin, 'athlete_program_blocks', blockIds)
    for (const row of programRows) {
      const blockId = Number(row.block_id)
      const usage = usageByBlock.get(blockId)
      if (usage) usage.teamPrograms += 1
    }

    const referencedBlocks = blocks
      .map((block) => ({
        blockId: Number(block.id),
        blockCode: block.block_code,
        displayName: block.block_name,
        usage: usageByBlock.get(Number(block.id)) ?? { products: 0, schedules: 0, teamPrograms: 0, results: 0 },
      }))
      .filter((block) => block.usage.products + block.usage.schedules + block.usage.teamPrograms + block.usage.results > 0)

    return {
      data: {
        nodeType,
        nodeId,
        nodeName: context.nodeName,
        directChildTaxonomyCount: context.directChildTaxonomyCount,
        descendantTaxonomyCount: context.descendantTaxonomyCount,
        blockCount: blocks.length,
        deletableBlocks: blocks.length - referencedBlocks.length,
        referencedBlocks,
        permanentDeleteAllowed: referencedBlocks.length === 0,
        archiveAvailable: true,
      },
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '讀取刪除預覽失敗。' }
  }
}

export async function updateBlockTaxonomyNodeName(nodeTypeValue: string, nodeId: number, nextNameValue: string): Promise<AdminMutationResult<{ id: number; name: string }>> {
  const nodeType = normalizeTaxonomyNodeType(nodeTypeValue)
  const nextName = normalizeTaxonomyName(nextNameValue)
  if (!nodeType || !Number.isFinite(nodeId)) return { error: '分類參數不正確。' }
  if (!nextName) return { error: '分類名稱不可空白。' }
  if (nextName.length > 80) return { error: '分類名稱不可超過 80 個字。' }

  try {
    const admin = await requireTaxonomyAdmin()
    const now = new Date().toISOString()

    if (nodeType === 'sport') {
      const { data: existing, error } = await admin.from('block_taxonomy_sports').select('id, name').eq('is_active', true)
      if (error) throw error
      if ((existing ?? []).some((row) => Number(row.id) !== nodeId && normalizeTaxonomyComparableName(row.name) === normalizeTaxonomyComparableName(nextName))) {
        return { error: '同一層已存在相同專項名稱。' }
      }
      const { data, error: updateError } = await admin.from('block_taxonomy_sports').update({ name: nextName, updated_at: now }).eq('id', nodeId).select('id, name').maybeSingle()
      if (updateError) throw updateError
      if (!data) return { error: '找不到分類。' }
      return { data: { id: Number(data.id), name: String(data.name) }, message: '已更新專項名稱。' }
    }

    if (nodeType === 'age_group') {
      const { data: target, error: targetError } = await admin.from('block_taxonomy_age_groups').select('id, sport_id').eq('id', nodeId).maybeSingle()
      if (targetError) throw targetError
      if (!target) return { error: '找不到分類。' }
      const { data: siblings, error } = await admin.from('block_taxonomy_age_groups').select('id, name').eq('sport_id', Number(target.sport_id)).eq('is_active', true)
      if (error) throw error
      if ((siblings ?? []).some((row) => Number(row.id) !== nodeId && normalizeTaxonomyComparableName(row.name) === normalizeTaxonomyComparableName(nextName))) {
        return { error: '同一專項底下已存在相同年齡分級。' }
      }
      const { data, error: updateError } = await admin.from('block_taxonomy_age_groups').update({ name: nextName, updated_at: now }).eq('id', nodeId).select('id, name').maybeSingle()
      if (updateError) throw updateError
      if (!data) return { error: '找不到分類。' }
      return { data: { id: Number(data.id), name: String(data.name) }, message: '已更新年齡分級名稱。' }
    }

    const { data: target, error: targetError } = await admin.from('block_taxonomy_training_categories').select('id, age_group_id').eq('id', nodeId).maybeSingle()
    if (targetError) throw targetError
    if (!target) return { error: '找不到分類。' }
    const { data: siblings, error } = await admin.from('block_taxonomy_training_categories').select('id, name').eq('age_group_id', Number(target.age_group_id)).eq('is_active', true)
    if (error) throw error
    if ((siblings ?? []).some((row) => Number(row.id) !== nodeId && normalizeTaxonomyComparableName(row.name) === normalizeTaxonomyComparableName(nextName))) {
      return { error: '同一年齡分級底下已存在相同訓練分類。' }
    }
    const { data, error: updateError } = await admin.from('block_taxonomy_training_categories').update({ name: nextName, updated_at: now }).eq('id', nodeId).select('id, name').maybeSingle()
    if (updateError) throw updateError
    if (!data) return { error: '找不到分類。' }
    return { data: { id: Number(data.id), name: String(data.name) }, message: '已更新訓練分類名稱。' }
  } catch (error) {
    return { error: error instanceof Error ? humanizeUniqueViolation(error.message, '同一層已存在相同分類名稱。') : '更新分類名稱失敗。' }
  }
}

export async function deleteBlockTaxonomyNode(coachProfile: { id: number; is_head_coach: boolean | null }, nodeTypeValue: string, nodeId: number, confirmationName: string): Promise<AdminMutationResult<BlockTaxonomyDeletePreview>> {
  const preview = await getBlockTaxonomyDeletePreview(nodeTypeValue, nodeId)
  if (preview.error || !preview.data) return { error: preview.error ?? '無法讀取刪除預覽。' }
  if (normalizeTaxonomyName(confirmationName) !== normalizeTaxonomyName(preview.data.nodeName)) return { error: '確認名稱不符合分類名稱。' }
  if (!preview.data.permanentDeleteAllowed) return { error: '此分類內有板塊正在被商品、課表、方案或歷史回報使用，因此無法永久刪除。', data: preview.data }

  try {
    const admin = await requireTaxonomyAdmin()
    const { error } = await admin.rpc('delete_block_taxonomy_node', {
      p_node_type: preview.data.nodeType,
      p_node_id: nodeId,
      p_confirmation_name: preview.data.nodeName,
      p_actor_coach_id: coachProfile.id,
      p_actor_is_head_coach: coachProfile.is_head_coach === true,
    })
    if (error) return { error: error.message, data: preview.data }
    return { data: preview.data, message: '已永久刪除分類、子分類與未被引用的板塊。' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '刪除分類失敗。', data: preview.data }
  }
}

export async function archiveBlockTaxonomyNode(coachProfile: { id: number; is_head_coach: boolean | null }, nodeTypeValue: string, nodeId: number): Promise<AdminMutationResult<BlockTaxonomyDeletePreview>> {
  const preview = await getBlockTaxonomyDeletePreview(nodeTypeValue, nodeId)
  if (preview.error || !preview.data) return { error: preview.error ?? '無法讀取封存預覽。' }

  try {
    const admin = await requireTaxonomyAdmin()
    const { error } = await admin.rpc('archive_block_taxonomy_node', {
      p_node_type: preview.data.nodeType,
      p_node_id: nodeId,
      p_actor_coach_id: coachProfile.id,
      p_actor_is_head_coach: coachProfile.is_head_coach === true,
    })
    if (error) return { error: error.message, data: preview.data }
    return { data: preview.data, message: '已封存分類與子分類；歷史商品、課表與回報資料已保留。' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '封存分類失敗。', data: preview.data }
  }
}
