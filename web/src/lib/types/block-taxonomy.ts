export type BlockTaxonomySportRecord = {
  id: number
  name: string
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BlockTaxonomyAgeGroupRecord = {
  id: number
  sport_id: number
  name: string
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BlockTaxonomyTrainingCategoryRecord = {
  id: number
  age_group_id: number
  name: string
  sort_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BlockTaxonomySportSummary = BlockTaxonomySportRecord & {
  ageGroupCount: number
}

export type BlockTaxonomyAgeGroupSummary = BlockTaxonomyAgeGroupRecord & {
  trainingCategoryCount: number
}

export type BlockTaxonomyTrainingCategorySummary = BlockTaxonomyTrainingCategoryRecord & {
  blockCount: number
}
