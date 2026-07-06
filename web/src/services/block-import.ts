import 'server-only'

import * as XLSX from 'xlsx'

import { MANUAL_BLOCK_SECTION_NAMES, type BlockExerciseTemplateInput, type ImportedBlockTemplate } from '@/lib/types/block-management'

const BLOCK_SECTION_NAMES = [
  '自我筋膜滾動',
  '自我筋膜鬆動',
  '活動度',
  '活化',
  '動態熱身',
  '增強/彈震式訓練',
  '重量訓練',
  '輔助訓練',
  '恢復訓練',
] as const

const HEADER_ALIASES: Record<string, keyof BlockExerciseTemplateInput | ''> = {
  動作: 'exercise_name',
  組數: 'sets',
  '次數/時間': 'reps_or_time',
  '次數／時間': 'reps_or_time',
  工具: 'equipment',
  強度: 'intensity',
  重量: 'weight',
  休息時間: 'rest',
  休息: 'rest',
  影片連結: 'video_url',
  影片: 'video_url',
}

type ParsedWorkbookBlock = ImportedBlockTemplate

function cellText(value: unknown) {
  if (value == null) return ''
  const text = String(value).trim()
  return text.toLowerCase() === 'nan' ? '' : text
}

function normalizeSectionName(value: string) {
  if (!value) return ''
  if (value.includes('自我筋膜')) return '自我筋膜滾動'
  if (value.includes('增強') || value.includes('彈震')) return '增強/彈震式訓練'
  return BLOCK_SECTION_NAMES.find((section) => section === value) ?? ''
}

function normalizeHeaderName(value: string) {
  const header = cellText(value).replaceAll(' ', '')
  return HEADER_ALIASES[header] ?? ''
}

function looksLikeBlockTitle(value: string, sheetName: string) {
  if (!value) return false

  const excludedFragments = ['LAB33', 'Sport Performance', '週期目標', '訓練元素', '強調於', '核心目標', '透過', '過程中']
  if (excludedFragments.some((fragment) => value.includes(fragment))) return false
  if (value.length > 20) return false

  return value.includes('訓練') || value.replaceAll(' ', '') === sheetName.replaceAll(' ', '')
}

function getSheetBounds(sheet: XLSX.WorkSheet) {
  const ref = sheet['!ref']
  if (!ref) return null
  return XLSX.utils.decode_range(ref)
}

function getCellValue(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number) {
  const address = XLSX.utils.encode_cell({ r: rowIndex - 1, c: columnIndex - 1 })
  const cell = sheet[address]
  if (cell?.v != null) {
    return cellText(cell.v)
  }

  const merges = (sheet['!merges'] ?? []) as XLSX.Range[]
  for (const merge of merges) {
    if (rowIndex - 1 >= merge.s.r && rowIndex - 1 <= merge.e.r && columnIndex - 1 >= merge.s.c && columnIndex - 1 <= merge.e.c) {
      const mergedAddress = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c })
      return cellText(sheet[mergedAddress]?.v)
    }
  }

  return ''
}

function getRowValues(sheet: XLSX.WorkSheet, rowIndex: number, maxColumn: number) {
  return Array.from({ length: maxColumn }, (_, index) => getCellValue(sheet, rowIndex, index + 1))
}

function extractBlockTitle(sheet: XLSX.WorkSheet, fallbackName: string, maxRow: number, maxColumn: number) {
  const preferredValues: string[] = []
  for (let rowIndex = 1; rowIndex <= Math.min(3, maxRow); rowIndex += 1) {
    for (const value of getRowValues(sheet, rowIndex, maxColumn)) {
      if (looksLikeBlockTitle(value, fallbackName)) preferredValues.push(value)
    }
  }

  if (preferredValues.length > 0) {
    return preferredValues.sort((left, right) => right.length - left.length)[0]
  }

  const topValues: string[] = []
  for (let rowIndex = 1; rowIndex <= Math.min(5, maxRow); rowIndex += 1) {
    for (const value of getRowValues(sheet, rowIndex, maxColumn)) {
      if (looksLikeBlockTitle(value, fallbackName)) topValues.push(value)
    }
  }

  return topValues.sort((left, right) => right.length - left.length)[0] ?? fallbackName
}

function parseBlockSheet(sheetName: string, sheet: XLSX.WorkSheet): ParsedWorkbookBlock | null {
  const bounds = getSheetBounds(sheet)
  if (!bounds) return null

  const maxRow = bounds.e.r + 1
  const maxColumn = bounds.e.c + 1
  const blockName = extractBlockTitle(sheet, sheetName, maxRow, maxColumn)

  let goal = ''
  let trainingElement = ''

  for (let rowIndex = 1; rowIndex <= Math.min(5, maxRow); rowIndex += 1) {
    const values = getRowValues(sheet, rowIndex, maxColumn)
    values.forEach((value, index) => {
      if (value === '週期目標') {
        goal = values.slice(index + 1).find(Boolean) ?? goal
      }
      if (value === '訓練元素') {
        trainingElement = values.slice(index + 1).find(Boolean) ?? trainingElement
      }
    })
  }

  const sections: ImportedBlockTemplate['sections'] = []
  let currentSection: ImportedBlockTemplate['sections'][number] | null = null
  let currentHeaders: Partial<Record<keyof BlockExerciseTemplateInput, number>> = {}
  let lastHeaders: Partial<Record<keyof BlockExerciseTemplateInput, number>> = {}
  const orderBySection = new Map<string, number>()

  for (let rowIndex = 4; rowIndex <= maxRow; rowIndex += 1) {
    const values = getRowValues(sheet, rowIndex, maxColumn)
    const nonEmpty = values.filter(Boolean)

    const matchedSection = nonEmpty.map(normalizeSectionName).find(Boolean) ?? null
    if (matchedSection) {
      currentSection = { section_name: matchedSection, exercises: [] }
      sections.push(currentSection)
      currentHeaders = { ...lastHeaders }
      orderBySection.set(matchedSection, 0)
      continue
    }

    if (nonEmpty.includes('動作')) {
      currentHeaders = {}
      values.forEach((value, index) => {
        const headerName = normalizeHeaderName(value)
        if (headerName && currentHeaders[headerName] == null) {
          currentHeaders[headerName] = index
        }
      })
      lastHeaders = { ...currentHeaders }
      continue
    }

    if (!currentSection) continue
    const exerciseIndex = currentHeaders.exercise_name
    if (exerciseIndex == null || exerciseIndex >= values.length) continue

    const exerciseName = values[exerciseIndex]
    if (!exerciseName) continue

    const sectionName = currentSection?.section_name ?? ''
    const nextOrder = (orderBySection.get(sectionName) ?? 0) + 1
    orderBySection.set(sectionName, nextOrder)

    const pick = (headerKey: keyof BlockExerciseTemplateInput) => {
      const index = currentHeaders[headerKey]
      if (index == null || index >= values.length) return ''
      return values[index]
    }

    currentSection?.exercises.push({
      exercise_name: exerciseName,
      sets: pick('sets'),
      reps_or_time: pick('reps_or_time'),
      equipment: pick('equipment'),
      intensity: pick('intensity'),
      weight: pick('weight'),
      rest: pick('rest'),
      video_url: pick('video_url'),
      notes: '',
    })
  }

  const exerciseCount = sections.reduce((sum, section) => sum + section.exercises.length, 0)
  if (sections.length === 0 && exerciseCount === 0) return null

  return {
    sheetName,
    blockName,
    goal,
    trainingElement,
    sections,
    exerciseCount,
  }
}

export function parseBlockWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const parsedBlocks: ParsedWorkbookBlock[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const parsedBlock = parseBlockSheet(sheetName, sheet)
    if (parsedBlock) parsedBlocks.push(parsedBlock)
  }

  return parsedBlocks
}

export function buildImportPreview(
  parsedBlocks: ParsedWorkbookBlock[],
  existingBlocks: Array<{ block_code: string | null; block_name: string | null }>,
) {
  const existingCodes = new Set(existingBlocks.map((block) => cellText(block.block_code).toLocaleLowerCase('en-US')).filter(Boolean))
  const seenCodes = new Set<string>()

  const importableBlocks: ParsedWorkbookBlock[] = []
  const skippedRows: Array<{ blockCode: string; blockName: string; reason: string }> = []

  for (const parsedBlock of parsedBlocks) {
    const blockCode = cellText(parsedBlock.sheetName)
    const normalizedCode = blockCode.toLocaleLowerCase('en-US')
    const reasons: string[] = []

    if (seenCodes.has(normalizedCode)) reasons.push('這次檔案中 Block Code 重複')
    if (existingCodes.has(normalizedCode)) reasons.push('資料庫已存在相同 Block Code')

    seenCodes.add(normalizedCode)

    if (reasons.length > 0) {
      skippedRows.push({
        blockCode,
        blockName: parsedBlock.blockName,
        reason: reasons.join('、'),
      })
      continue
    }

    importableBlocks.push(parsedBlock)
  }

  return {
    importableBlocks,
    skippedRows,
  }
}

export function toTemplatePayload(block: ParsedWorkbookBlock, description: string) {
  const blockName = cellText(block.blockName || block.sheetName)
  return {
    blockCode: cellText(block.sheetName || blockName),
    blockName,
    goal: cellText(block.goal),
    trainingElement: cellText(block.trainingElement),
    description: cellText(description) || '由 Excel 多工作表匯入',
    sections: block.sections
      .filter((section) => MANUAL_BLOCK_SECTION_NAMES.includes(section.section_name as (typeof MANUAL_BLOCK_SECTION_NAMES)[number]) || section.exercises.length > 0)
      .map((section) => ({
        section_name: cellText(section.section_name),
        exercises: section.exercises.map((exercise) => ({
          exercise_name: cellText(exercise.exercise_name),
          sets: cellText(exercise.sets),
          reps_or_time: cellText(exercise.reps_or_time),
          equipment: cellText(exercise.equipment),
          intensity: cellText(exercise.intensity),
          weight: cellText(exercise.weight),
          rest: cellText(exercise.rest),
          video_url: cellText(exercise.video_url),
          notes: '',
        })),
      })),
  }
}
