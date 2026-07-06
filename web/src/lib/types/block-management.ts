export const MANUAL_BLOCK_SECTION_NAMES = [
  '自我筋膜滾動',
  '活動度',
  '活化',
  '動態熱身',
  '增強/彈震式訓練',
  '重量訓練',
  '輔助訓練',
  '恢復訓練',
] as const

export const MANUAL_TEMPLATE_COLUMNS = [
  'exercise_name',
  'sets',
  'reps_or_time',
  'equipment',
  'intensity',
  'weight',
  'rest',
  'video_url',
] as const

export type BlockExerciseTemplateInput = {
  exercise_name: string
  sets: string
  reps_or_time: string
  equipment: string
  intensity: string
  weight: string
  rest: string
  video_url: string
  notes?: string
}

export type BlockSectionTemplateInput = {
  section_name: string
  exercises: BlockExerciseTemplateInput[]
}

export type BlockTemplatePayload = {
  blockCode: string
  blockName: string
  goal: string
  trainingElement: string
  description: string
  sections: BlockSectionTemplateInput[]
}

export type ImportedBlockTemplate = {
  sheetName: string
  blockName: string
  goal: string
  trainingElement: string
  sections: BlockSectionTemplateInput[]
  exerciseCount: number
}

export type ImportSkippedBlock = {
  blockCode: string
  blockName: string
  reason: string
}

export type BlockExerciseDetail = {
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
  notes: string | null
  order_num: number | null
}

export type BlockSectionDetail = {
  id: number
  block_id: number
  section_name: string | null
  order_num: number | null
  exercises: BlockExerciseDetail[]
}

export type BlockTemplateRecord = {
  id: number
  block_code: string | null
  block_name: string | null
  goal: string | null
  training_element: string | null
  description: string | null
  sectionCount: number
  exerciseCount: number
  sections: BlockSectionDetail[]
}
