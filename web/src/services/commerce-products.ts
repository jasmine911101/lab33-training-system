import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ProductBlockEntry,
  ProductBlockMutationPayload,
  ProductBlockOption,
  ProductCurrency,
  ProductManagementSnapshot,
  ProductMetadataPayload,
  ProductMutationPayload,
  ProductStatus,
  ProductVersionStatus,
  TrainingProductRecord,
  TrainingProductVersionRecord,
} from '@/lib/types/commerce'
import { PRODUCT_CURRENCIES, PRODUCT_STATUSES, PRODUCT_VERSION_STATUSES } from '@/lib/types/commerce'
import type { CoachProfile } from '@/services/coach'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

type AdminMutationResult<T> = {
  data?: T
  error?: string
  message?: string
}

type ProductRow = {
  id: number
  author_coach_id: number
  name: string
  description: string | null
  cover_image_url: string | null
  price_amount: number | null
  currency: string | null
  status: string | null
  is_active: boolean | null
  published_at: string | null
  unpublished_at: string | null
  archived_at: string | null
  created_at: string | null
  updated_at: string | null
}

type ProductVersionRow = {
  id: number
  product_id: number
  version_number: number
  status: string | null
  snapshot_name: string
  snapshot_description: string | null
  snapshot_price_amount: number | null
  snapshot_currency: string | null
  created_at: string | null
  published_at: string | null
  retired_at: string | null
}

type ProductBlockRow = {
  id: number
  product_version_id: number
  block_id: number
  week_number: number | null
  day_number: number | null
  sort_order: number | null
}

type CoachRow = {
  id: number
  name: string | null
  email: string | null
}

const DESCRIPTION_MAX_LENGTH = 3000

function ensureAdminClient() {
  const admin = createAdminClient()
  if (!admin) {
    return {
      admin: null,
      error: '尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法執行商品管理操作。',
    }
  }

  return { admin, error: null }
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized.toLowerCase() === 'nan' ? '' : normalized
}

function normalizeProductStatus(value: unknown): ProductStatus {
  const normalized = cleanText(value).toLowerCase()
  return PRODUCT_STATUSES.includes(normalized as ProductStatus) ? (normalized as ProductStatus) : 'draft'
}

function normalizeVersionStatus(value: unknown): ProductVersionStatus {
  const normalized = cleanText(value).toLowerCase()
  return PRODUCT_VERSION_STATUSES.includes(normalized as ProductVersionStatus) ? (normalized as ProductVersionStatus) : 'draft'
}

function normalizeCurrency(value: unknown): ProductCurrency {
  const currency = cleanText(value || 'TWD').toUpperCase()
  return PRODUCT_CURRENCIES.includes(currency as ProductCurrency) ? (currency as ProductCurrency) : 'TWD'
}

function normalizePriceAmount(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return 0
  return Math.round(amount)
}

function normalizeUrl(value: unknown) {
  const text = cleanText(value)
  if (!text) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

function canManageProduct(coach: CoachProfile, product: Pick<ProductRow, 'author_coach_id'>) {
  return Boolean(coach.is_head_coach) || Number(product.author_coach_id) === Number(coach.id)
}

function parsePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function normalizeBlocks(value: unknown): ProductBlockMutationPayload[] {
  if (!Array.isArray(value)) return []

  return value.map((entry, index) => {
    if (typeof entry === 'number' || typeof entry === 'string') {
      return {
        blockId: Number(entry),
        sortOrder: index,
      }
    }

    const record = entry as Record<string, unknown>
    return {
      blockId: Number(record.blockId ?? record.block_id),
      weekNumber: parsePositiveInteger(record.weekNumber ?? record.week_number),
      dayNumber: parsePositiveInteger(record.dayNumber ?? record.day_number),
      sortOrder: Number.isInteger(Number(record.sortOrder ?? record.sort_order)) ? Number(record.sortOrder ?? record.sort_order) : index,
    }
  })
}

function validateDraftPayload(payload: ProductMutationPayload) {
  const name = cleanText(payload.name)
  if (!name) return '請輸入商品名稱。'

  if (cleanText(payload.description).length > DESCRIPTION_MAX_LENGTH) {
    return `商品描述不可超過 ${DESCRIPTION_MAX_LENGTH} 字。`
  }

  const priceAmount = Number(payload.priceAmount)
  if (!Number.isInteger(priceAmount) || priceAmount < 0) return '售價必須是大於或等於 0 的整數金額。'

  const currency = cleanText(payload.currency).toUpperCase()
  if (!PRODUCT_CURRENCIES.includes(currency as ProductCurrency)) return '目前僅支援 TWD、USD。'

  if (cleanText(payload.coverImageUrl) && !normalizeUrl(payload.coverImageUrl)) return '封面圖片 URL 格式不正確。'

  const blocks = normalizeBlocks(payload.blocks)
  const blockIds = blocks.map((block) => Number(block.blockId))
  if (blockIds.some((blockId) => !Number.isFinite(blockId) || blockId <= 0)) return 'Block ID 格式不正確。'
  if (new Set(blockIds).size !== blockIds.length) return '同一個商品版本不可重複加入相同 Block。'

  const sortOrders = blocks.map((block, index) => Number(block.sortOrder ?? index))
  if (sortOrders.some((sortOrder) => !Number.isInteger(sortOrder) || sortOrder < 0)) return 'Block 排序必須是大於或等於 0 的整數。'
  if (new Set(sortOrders).size !== sortOrders.length) return 'Block 排序不可重複。'

  return null
}

function validateProductMetadataPayload(payload: ProductMetadataPayload) {
  if (payload.name !== undefined && !cleanText(payload.name)) return '請輸入商品名稱。'
  if (payload.description !== undefined && cleanText(payload.description).length > DESCRIPTION_MAX_LENGTH) return `商品描述不可超過 ${DESCRIPTION_MAX_LENGTH} 字。`
  if (payload.priceAmount !== undefined && (!Number.isInteger(Number(payload.priceAmount)) || Number(payload.priceAmount) < 0)) return '售價必須是大於或等於 0 的整數金額。'
  if (payload.currency !== undefined && !PRODUCT_CURRENCIES.includes(cleanText(payload.currency).toUpperCase() as ProductCurrency)) return '目前僅支援 TWD、USD。'
  if (payload.coverImageUrl !== undefined && cleanText(payload.coverImageUrl) && !normalizeUrl(payload.coverImageUrl)) return '封面圖片 URL 格式不正確。'
  return null
}

function toBlockRpcPayload(blocks: ProductBlockMutationPayload[]) {
  return blocks.map((block, index) => ({
    block_id: Number(block.blockId),
    week_number: block.weekNumber ?? null,
    day_number: block.dayNumber ?? null,
    sort_order: Number(block.sortOrder ?? index),
  }))
}

async function fetchBlockOptions(admin: AdminClient) {
  const { data, error } = await admin
    .from('blocks')
    .select('id, block_code, block_name')
    .order('block_code', { ascending: true })
    .order('block_name', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProductBlockOption[]
}

async function assertBlockIdsExist(admin: AdminClient, blocks: ProductBlockMutationPayload[]) {
  const blockIds = blocks.map((block) => Number(block.blockId))
  if (blockIds.length === 0) return null

  const { data, error } = await admin
    .from('blocks')
    .select('id')
    .in('id', blockIds)

  if (error) return error.message

  const existingIds = new Set((data ?? []).map((row) => Number(row.id)))
  const missingIds = blockIds.filter((id) => !existingIds.has(id))
  if (missingIds.length > 0) return '商品包含不存在的板塊，請重新選擇。'

  return null
}

async function fetchProductById(admin: AdminClient, productId: number) {
  const { data, error } = await admin
    .from('training_products')
    .select('id, author_coach_id, name, description, cover_image_url, price_amount, currency, status, is_active, published_at, unpublished_at, archived_at, created_at, updated_at')
    .eq('id', productId)
    .maybeSingle()

  if (error) throw error
  return data as ProductRow | null
}

async function fetchVersionById(admin: AdminClient, versionId: number) {
  const { data, error } = await admin
    .from('training_product_versions')
    .select('id, product_id, version_number, status, snapshot_name, snapshot_description, snapshot_price_amount, snapshot_currency, created_at, published_at, retired_at')
    .eq('id', versionId)
    .maybeSingle()

  if (error) throw error
  return data as ProductVersionRow | null
}

async function replaceDraftVersionBlocks(admin: AdminClient, coach: CoachProfile, versionId: number, blocks: ProductBlockMutationPayload[]) {
  const { error } = await admin.rpc('replace_product_version_blocks', {
    p_product_version_id: versionId,
    p_blocks: toBlockRpcPayload(blocks),
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
  })

  return error?.message ?? null
}

async function hydrateProducts(admin: AdminClient, productRows: ProductRow[]): Promise<TrainingProductRecord[]> {
  if (productRows.length === 0) return []

  const productIds = productRows.map((row) => Number(row.id))
  const authorIds = Array.from(new Set(productRows.map((row) => Number(row.author_coach_id))))

  const [coachResult, versionResult, blockResult, blockOptions] = await Promise.all([
    admin.from('coaches').select('id, name, email').in('id', authorIds),
    admin.from('training_product_versions').select('id, product_id, version_number, status, snapshot_name, snapshot_description, snapshot_price_amount, snapshot_currency, created_at, published_at, retired_at').in('product_id', productIds).order('version_number', { ascending: false }),
    admin.from('training_product_blocks').select('id, product_version_id, block_id, week_number, day_number, sort_order').order('sort_order', { ascending: true }),
    fetchBlockOptions(admin),
  ])

  if (coachResult.error) throw coachResult.error
  if (versionResult.error) throw versionResult.error
  if (blockResult.error) throw blockResult.error

  const coachRows = (coachResult.data ?? []) as CoachRow[]
  const versionRows = (versionResult.data ?? []) as ProductVersionRow[]
  const productBlockRows = (blockResult.data ?? []) as ProductBlockRow[]
  const coachById = new Map(coachRows.map((coach) => [Number(coach.id), coach]))
  const blockById = new Map(blockOptions.map((block) => [Number(block.id), block]))
  const productBlocksByVersionId = new Map<number, ProductBlockEntry[]>()

  for (const row of productBlockRows) {
    const block = blockById.get(Number(row.block_id))
    const entry: ProductBlockEntry = {
      id: Number(row.id),
      product_version_id: Number(row.product_version_id),
      block_id: Number(row.block_id),
      week_number: row.week_number == null ? null : Number(row.week_number),
      day_number: row.day_number == null ? null : Number(row.day_number),
      sort_order: Number(row.sort_order ?? 0),
      block_code: block?.block_code ?? null,
      block_name: block?.block_name ?? null,
    }
    const current = productBlocksByVersionId.get(entry.product_version_id) ?? []
    current.push(entry)
    productBlocksByVersionId.set(entry.product_version_id, current)
  }

  const versionsByProductId = new Map<number, TrainingProductVersionRecord[]>()
  for (const row of versionRows) {
    const version: TrainingProductVersionRecord = {
      id: Number(row.id),
      product_id: Number(row.product_id),
      version_number: Number(row.version_number),
      status: normalizeVersionStatus(row.status),
      snapshot_name: row.snapshot_name,
      snapshot_description: row.snapshot_description,
      snapshot_price_amount: Number(row.snapshot_price_amount ?? 0),
      snapshot_currency: normalizeCurrency(row.snapshot_currency),
      created_at: row.created_at,
      published_at: row.published_at,
      retired_at: row.retired_at,
      blocks: productBlocksByVersionId.get(Number(row.id)) ?? [],
    }
    const current = versionsByProductId.get(version.product_id) ?? []
    current.push(version)
    versionsByProductId.set(version.product_id, current)
  }

  return productRows.map((row) => {
    const author = coachById.get(Number(row.author_coach_id))
    const versions = versionsByProductId.get(Number(row.id)) ?? []
    const currentPublishedVersion = versions.find((version) => version.status === 'published') ?? null
    const currentDraftVersion = versions.find((version) => version.status === 'draft') ?? null
    return {
      id: Number(row.id),
      author_coach_id: Number(row.author_coach_id),
      author_name: author?.name ?? null,
      author_email: author?.email ?? null,
      name: row.name,
      description: row.description,
      cover_image_url: row.cover_image_url,
      price_amount: Number(row.price_amount ?? 0),
      currency: normalizeCurrency(row.currency),
      status: normalizeProductStatus(row.status),
      is_active: row.is_active ?? true,
      published_at: row.published_at,
      unpublished_at: row.unpublished_at,
      archived_at: row.archived_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      versions,
      currentPublishedVersion,
      currentDraftVersion,
    }
  })
}

export async function getProductManagementSnapshot(coach: CoachProfile): Promise<ProductManagementSnapshot> {
  const { admin, error } = ensureAdminClient()
  if (!admin) throw new Error(error ?? '無法讀取商品資料。')

  let query = admin
    .from('training_products')
    .select('id, author_coach_id, name, description, cover_image_url, price_amount, currency, status, is_active, published_at, unpublished_at, archived_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })

  if (!coach.is_head_coach) {
    query = query.eq('author_coach_id', coach.id)
  }

  const [{ data, error: productError }, blockOptions] = await Promise.all([query, fetchBlockOptions(admin)])
  if (productError) throw productError

  const products = await hydrateProducts(admin, (data ?? []) as ProductRow[])
  return { products, blockOptions }
}

export async function getProductRecordForCoach(coach: CoachProfile, productId: number) {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法讀取商品資料。' }

  const product = await fetchProductById(admin, productId)
  if (!product) return { error: '找不到這個商品。' }
  if (!canManageProduct(coach, product)) return { error: '你沒有權限管理這個商品。' }

  const hydrated = await hydrateProducts(admin, [product])
  return { data: hydrated[0] }
}

export async function createProductForCoach(coach: CoachProfile, payload: ProductMutationPayload): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法建立商品。' }

  const validationError = validateDraftPayload(payload)
  if (validationError) return { error: validationError }

  const blocks = normalizeBlocks(payload.blocks)
  const blockError = await assertBlockIdsExist(admin, blocks)
  if (blockError) return { error: blockError }

  const name = cleanText(payload.name)
  const description = cleanText(payload.description) || null
  const coverImageUrl = normalizeUrl(payload.coverImageUrl)
  const priceAmount = normalizePriceAmount(payload.priceAmount)
  const currency = normalizeCurrency(payload.currency)

  const { data: insertedProduct, error: insertError } = await admin
    .from('training_products')
    .insert({
      author_coach_id: coach.id,
      name,
      description,
      cover_image_url: coverImageUrl,
      price_amount: priceAmount,
      currency,
      status: 'draft',
      is_active: payload.isActive,
    })
    .select('id')
    .single()

  if (insertError || !insertedProduct) {
    return { error: insertError?.message ?? '建立商品失敗。' }
  }

  const productId = Number(insertedProduct.id)
  const { data: insertedVersion, error: versionError } = await admin
    .from('training_product_versions')
    .insert({
      product_id: productId,
      version_number: 1,
      status: 'draft',
      snapshot_name: name,
      snapshot_description: description,
      snapshot_price_amount: priceAmount,
      snapshot_currency: currency,
    })
    .select('id')
    .single()

  if (versionError || !insertedVersion) {
    await admin.from('training_products').delete().eq('id', productId)
    return { error: versionError?.message ?? '建立商品版本失敗。' }
  }

  const blockReplaceError = await replaceDraftVersionBlocks(admin, coach, Number(insertedVersion.id), blocks)
  if (blockReplaceError) {
    await admin.from('training_product_blocks').delete().eq('product_version_id', Number(insertedVersion.id))
    await admin.from('training_product_versions').delete().eq('id', Number(insertedVersion.id))
    await admin.from('training_products').delete().eq('id', productId)
    return { error: blockReplaceError }
  }

  const created = await getProductRecordForCoach(coach, productId)
  if (created.error || !created.data) return { error: created.error ?? '商品已建立，但重新讀取失敗。' }

  return { data: created.data, message: '已建立商品與第一個 draft version。' }
}

export async function updateProductForCoach(coach: CoachProfile, productId: number, payload: ProductMetadataPayload): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法更新商品。' }

  const validationError = validateProductMetadataPayload(payload)
  if (validationError) return { error: validationError }

  const currentProduct = await fetchProductById(admin, productId)
  if (!currentProduct) return { error: '找不到這個商品。' }
  if (!canManageProduct(coach, currentProduct)) return { error: '你沒有權限管理這個商品。' }
  if (normalizeProductStatus(currentProduct.status) === 'archived') return { error: '封存商品不可再修改。' }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.name !== undefined) update.name = cleanText(payload.name)
  if (payload.description !== undefined) update.description = cleanText(payload.description) || null
  if (payload.coverImageUrl !== undefined) update.cover_image_url = normalizeUrl(payload.coverImageUrl)
  if (payload.priceAmount !== undefined) update.price_amount = normalizePriceAmount(payload.priceAmount)
  if (payload.currency !== undefined) update.currency = normalizeCurrency(payload.currency)
  if (payload.isActive !== undefined) update.is_active = payload.isActive

  const { error: updateError } = await admin.from('training_products').update(update).eq('id', productId)
  if (updateError) return { error: updateError.message }

  const updated = await getProductRecordForCoach(coach, productId)
  if (updated.error || !updated.data) return { error: updated.error ?? '商品已更新，但重新讀取失敗。' }
  return { data: updated.data, message: '已更新商品主檔。' }
}

export async function updateProductVersionForCoach(coach: CoachProfile, productId: number, versionId: number, payload: ProductMutationPayload): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法更新商品版本。' }

  const validationError = validateDraftPayload(payload)
  if (validationError) return { error: validationError }

  const currentProduct = await fetchProductById(admin, productId)
  if (!currentProduct) return { error: '找不到這個商品。' }
  if (!canManageProduct(coach, currentProduct)) return { error: '你沒有權限管理這個商品。' }
  if (normalizeProductStatus(currentProduct.status) === 'archived') return { error: '封存商品不可再修改。' }

  const currentVersion = await fetchVersionById(admin, versionId)
  if (!currentVersion || Number(currentVersion.product_id) !== productId) return { error: '找不到這個商品版本。' }
  if (normalizeVersionStatus(currentVersion.status) !== 'draft') return { error: 'Published version is read-only，請先建立新的 draft version。' }

  const blocks = normalizeBlocks(payload.blocks)
  const blockError = await assertBlockIdsExist(admin, blocks)
  if (blockError) return { error: blockError }

  const name = cleanText(payload.name)
  const description = cleanText(payload.description) || null
  const coverImageUrl = normalizeUrl(payload.coverImageUrl)
  const priceAmount = normalizePriceAmount(payload.priceAmount)
  const currency = normalizeCurrency(payload.currency)

  const { error: updateVersionError } = await admin
    .from('training_product_versions')
    .update({
      snapshot_name: name,
      snapshot_description: description,
      snapshot_price_amount: priceAmount,
      snapshot_currency: currency,
    })
    .eq('id', versionId)

  if (updateVersionError) return { error: updateVersionError.message }

  const blockReplaceError = await replaceDraftVersionBlocks(admin, coach, versionId, blocks)
  if (blockReplaceError) return { error: blockReplaceError }

  const { error: updateProductError } = await admin
    .from('training_products')
    .update({
      name,
      description,
      cover_image_url: coverImageUrl,
      price_amount: priceAmount,
      currency,
      is_active: payload.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (updateProductError) return { error: updateProductError.message }

  const updated = await getProductRecordForCoach(coach, productId)
  if (updated.error || !updated.data) return { error: updated.error ?? '商品版本已更新，但重新讀取失敗。' }
  return { data: updated.data, message: '已更新 draft version。' }
}

export async function createDraftVersionForCoach(coach: CoachProfile, productId: number): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法建立 draft version。' }

  const current = await getProductRecordForCoach(coach, productId)
  if (current.error || !current.data) return { error: current.error ?? '找不到商品。' }
  const product = current.data
  if (product.status === 'archived') return { error: '封存商品不可建立新版本。' }
  if (product.currentDraftVersion) return { error: '這個商品已經有 draft version。' }

  const source = product.currentPublishedVersion ?? product.versions[0]
  if (!source) return { error: '找不到可複製的商品版本。' }

  const nextVersionNumber = Math.max(...product.versions.map((version) => version.version_number), 0) + 1
  const { data: insertedVersion, error: insertError } = await admin
    .from('training_product_versions')
    .insert({
      product_id: product.id,
      version_number: nextVersionNumber,
      status: 'draft',
      snapshot_name: source.snapshot_name,
      snapshot_description: source.snapshot_description,
      snapshot_price_amount: source.snapshot_price_amount,
      snapshot_currency: source.snapshot_currency,
    })
    .select('id')
    .single()

  if (insertError || !insertedVersion) return { error: insertError?.message ?? '建立 draft version 失敗。' }

  const blocks = source.blocks.map((block) => ({
    blockId: block.block_id,
    weekNumber: block.week_number,
    dayNumber: block.day_number,
    sortOrder: block.sort_order,
  }))
  const blockReplaceError = await replaceDraftVersionBlocks(admin, coach, Number(insertedVersion.id), blocks)
  if (blockReplaceError) return { error: blockReplaceError }

  const updated = await getProductRecordForCoach(coach, productId)
  if (updated.error || !updated.data) return { error: updated.error ?? 'Draft version 已建立，但重新讀取失敗。' }
  return { data: updated.data, message: `已建立 V${nextVersionNumber} draft。` }
}

export async function publishProductForCoach(coach: CoachProfile, productId: number, versionId: number): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法發布商品。' }

  const { error: publishError } = await admin.rpc('publish_product_version', {
    p_product_id: productId,
    p_product_version_id: versionId,
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
  })
  if (publishError) return { error: publishError.message }

  const updated = await getProductRecordForCoach(coach, productId)
  if (updated.error || !updated.data) return { error: updated.error ?? '商品已發布，但重新讀取失敗。' }
  return { data: updated.data, message: '商品已發布。' }
}

export async function unpublishProductForCoach(coach: CoachProfile, productId: number): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法下架商品。' }

  const { error: unpublishError } = await admin.rpc('unpublish_product', {
    p_product_id: productId,
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
  })
  if (unpublishError) return { error: unpublishError.message }

  const updated = await getProductRecordForCoach(coach, productId)
  if (updated.error || !updated.data) return { error: updated.error ?? '商品已下架，但重新讀取失敗。' }
  return { data: updated.data, message: '商品已下架，published version 會保留作為歷史版本。' }
}

export async function archiveProductForCoach(coach: CoachProfile, productId: number): Promise<AdminMutationResult<TrainingProductRecord>> {
  const { admin, error } = ensureAdminClient()
  if (!admin) return { error: error ?? '無法封存商品。' }

  const { error: archiveError } = await admin.rpc('archive_product', {
    p_product_id: productId,
    p_actor_coach_id: coach.id,
    p_actor_is_head_coach: coach.is_head_coach === true,
  })
  if (archiveError) return { error: archiveError.message }

  const updated = await getProductRecordForCoach(coach, productId)
  if (updated.error || !updated.data) return { error: updated.error ?? '商品已封存，但重新讀取失敗。' }
  return { data: updated.data, message: '商品已封存，歷史版本與 mappings 已保留。' }
}
