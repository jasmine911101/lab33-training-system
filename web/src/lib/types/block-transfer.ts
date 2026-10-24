import type {
  BlockTaxonomyAgeGroupRecord,
  BlockTaxonomySportRecord,
  BlockTaxonomyTrainingCategoryRecord,
} from '@/lib/types/block-taxonomy'

// 後端回傳的三層分類清單，表單會用上層 ID 找到對應的下層選項。
export type BlockTransferOptions = {
  sports: BlockTaxonomySportRecord[]
  ageGroups: BlockTaxonomyAgeGroupRecord[]
  trainingCategories: BlockTaxonomyTrainingCategoryRecord[]
}

// 一次操作需要的資料。? 表示這個欄位可以省略；複製時才需要代碼與名稱。
export type BlockTransferInput = {
  // 只接受這兩種文字值，避免把其他操作誤當成移動或複製。
  mode: 'move' | 'copy'
  trainingCategoryId: number
  blockCode?: string
  blockName?: string
}

// 成功後回傳的資料：移動保留原 ID，複製則回傳新板塊的 ID。
export type BlockTransferResult = {
  blockId: number
  targetPath: string
  message: string
}
