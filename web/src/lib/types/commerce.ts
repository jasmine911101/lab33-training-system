export const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const
export const PRODUCT_VERSION_STATUSES = ['draft', 'published', 'retired'] as const
export const PRODUCT_CURRENCIES = ['TWD', 'USD'] as const

export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type ProductVersionStatus = (typeof PRODUCT_VERSION_STATUSES)[number]
export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number]

export type ProductBlockOption = {
  id: number
  block_code: string | null
  block_name: string | null
}

export type ProductBlockEntry = {
  id: number
  product_version_id: number
  block_id: number
  week_number: number | null
  day_number: number | null
  sort_order: number
  block_code: string | null
  block_name: string | null
}

export type TrainingProductVersionRecord = {
  id: number
  product_id: number
  version_number: number
  status: ProductVersionStatus
  snapshot_name: string
  snapshot_description: string | null
  snapshot_price_amount: number
  snapshot_currency: ProductCurrency
  created_at: string | null
  published_at: string | null
  retired_at: string | null
  blocks: ProductBlockEntry[]
}

export type TrainingProductRecord = {
  id: number
  author_coach_id: number
  author_name: string | null
  author_email: string | null
  name: string
  description: string | null
  cover_image_url: string | null
  price_amount: number
  currency: ProductCurrency
  status: ProductStatus
  is_active: boolean
  published_at: string | null
  unpublished_at: string | null
  archived_at: string | null
  created_at: string | null
  updated_at: string | null
  versions: TrainingProductVersionRecord[]
  currentPublishedVersion: TrainingProductVersionRecord | null
  currentDraftVersion: TrainingProductVersionRecord | null
}

export type ProductManagementSnapshot = {
  products: TrainingProductRecord[]
  blockOptions: ProductBlockOption[]
}

export type ProductBlockMutationPayload = {
  blockId: number
  weekNumber?: number | null
  dayNumber?: number | null
  sortOrder?: number | null
}

export type ProductMutationPayload = {
  name: string
  description: string
  coverImageUrl?: string | null
  priceAmount: number
  currency: string
  isActive: boolean
  blocks: ProductBlockMutationPayload[]
}

export type ProductMetadataPayload = {
  name?: string
  description?: string | null
  coverImageUrl?: string | null
  priceAmount?: number
  currency?: string
  isActive?: boolean
}
