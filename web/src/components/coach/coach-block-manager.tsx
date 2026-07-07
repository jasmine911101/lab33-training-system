'use client'

import { useMemo, useState } from 'react'

import {
  MANUAL_BLOCK_SECTION_NAMES,
  type BlockExerciseTemplateInput,
  type ImportedBlockTemplate,
  type ImportSkippedBlock,
  type BlockTemplateRecord,
} from '@/lib/types/block-management'

type CoachBlockManagerProps = {
  initialBlocks: BlockTemplateRecord[]
}

type SectionState = Record<string, BlockExerciseTemplateInput[]>

type ImportPreviewState = {
  totalSheets: number
  importableBlocks: ImportedBlockTemplate[]
  skippedRows: ImportSkippedBlock[]
}

type ApiSuccess<T> = T & {
  message?: string
}

const EXERCISE_HEADERS = [
  { key: 'exercise_name', label: '動作' },
  { key: 'sets', label: '組數' },
  { key: 'reps_or_time', label: '次數/時間' },
  { key: 'equipment', label: '工具' },
  { key: 'intensity', label: '強度' },
  { key: 'weight', label: '重量' },
  { key: 'rest', label: '休息時間' },
  { key: 'video_url', label: '影片連結' },
] as const

function emptyExerciseRow(): BlockExerciseTemplateInput {
  return {
    exercise_name: '',
    sets: '',
    reps_or_time: '',
    equipment: '',
    intensity: '',
    weight: '',
    rest: '',
    video_url: '',
    notes: '',
  }
}

function buildInitialSections(): SectionState {
  return Object.fromEntries(MANUAL_BLOCK_SECTION_NAMES.map((sectionName) => [sectionName, Array.from({ length: 3 }, emptyExerciseRow)]))
}

function blockLabel(block: BlockTemplateRecord) {
  if (block.block_code && block.block_name) return `${block.block_code} | ${block.block_name}`
  return block.block_name || block.block_code || `Block ${block.id}`
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null
  if (!response.ok) {
    throw new Error(payload?.error ?? '操作失敗，請稍後再試。')
  }

  return (payload ?? {}) as ApiSuccess<T>
}

function ExerciseTable({
  rows,
  onChange,
  onAddRow,
  onRemoveRow,
}: {
  rows: BlockExerciseTemplateInput[]
  onChange: (rowIndex: number, field: keyof BlockExerciseTemplateInput, value: string) => void
  onAddRow: () => void
  onRemoveRow: (rowIndex: number) => void
}) {
  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
      <table className="min-w-[920px] w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            {EXERCISE_HEADERS.map((header) => (
              <th key={header.key} className="border-b border-slate-200 px-3 py-3 font-semibold">
                {header.label}
              </th>
            ))}
            <th className="border-b border-slate-200 px-3 py-3 font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`exercise-row-${rowIndex}`} className="align-top">
              {EXERCISE_HEADERS.map((header) => (
                <td key={`${header.key}-${rowIndex}`} className="border-b border-slate-100 p-2">
                  <input
                    value={row[header.key] ?? ''}
                    onChange={(event) => onChange(rowIndex, header.key, event.target.value)}
                    className="lab-input !min-h-10 rounded-2xl px-3 py-2 text-sm"
                    placeholder={header.label}
                  />
                </td>
              ))}
              <td className="border-b border-slate-100 p-2">
                <button
                  type="button"
                  className="lab-btn-secondary !min-h-10 px-3 py-2 text-xs"
                  onClick={() => onRemoveRow(rowIndex)}
                >
                  刪除列
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-3">
        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onAddRow}>
          新增一列
        </button>
      </div>
    </div>
  )
}

function BlockDetailTable({ block }: { block: BlockTemplateRecord }) {
  if (block.sections.length === 0) {
    return <div className="lab-card-muted px-4 py-4 text-sm text-slate-600">這個板塊目前沒有詳細內容。</div>
  }

  return (
    <div className="space-y-5">
      {block.sections.map((section) => (
        <section key={`${block.id}-${section.id}`} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-lg font-bold text-slate-900">{section.section_name || '未命名區段'}</h4>
            <span className="lab-badge bg-slate-100 text-slate-600">{section.exercises.length} 個動作</span>
          </div>
          <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
            <table className="min-w-[920px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {['動作', '組數', '次數/時間', '工具', '強度', '重量', '休息時間', '影片連結', '備註'].map((label) => (
                    <th key={label} className="border-b border-slate-200 px-3 py-3 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.exercises.map((exercise) => (
                  <tr key={exercise.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">{exercise.exercise_name || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.sets || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.reps_or_time || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.equipment || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.intensity || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.weight || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.rest || '-'}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      {exercise.video_url ? (
                        <a href={exercise.video_url} target="_blank" rel="noreferrer" className="lab-badge-info">
                          開啟影片
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">{exercise.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

export function CoachBlockManager({ initialBlocks }: CoachBlockManagerProps) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [blockCode, setBlockCode] = useState('')
  const [blockName, setBlockName] = useState('')
  const [goal, setGoal] = useState('')
  const [trainingElement, setTrainingElement] = useState('')
  const [description, setDescription] = useState('')
  const [sections, setSections] = useState<SectionState>(buildInitialSections)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createMessage, setCreateMessage] = useState<string | null>(null)
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [expandedBlockIds, setExpandedBlockIds] = useState<number[]>([])
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null)
  const [selectedImportBlockCodes, setSelectedImportBlockCodes] = useState<string[]>([])
  const [importDescription, setImportDescription] = useState('由 Excel 多工作表匯入')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<Record<number, string>>({})
  const [actionMessage, setActionMessage] = useState<Record<number, string>>({})
  const [isImportSectionOpen, setIsImportSectionOpen] = useState(false)
  const [isManualSectionOpen, setIsManualSectionOpen] = useState(false)

  const totalBlocks = blocks.length
  const totalExercises = useMemo(
    () => blocks.reduce((sum, block) => sum + block.exerciseCount, 0),
    [blocks],
  )

  function resetForm() {
    setBlockCode('')
    setBlockName('')
    setGoal('')
    setTrainingElement('')
    setDescription('')
    setSections(buildInitialSections())
  }

  function updateSectionRow(sectionName: string, rowIndex: number, field: keyof BlockExerciseTemplateInput, value: string) {
    setSections((current) => ({
      ...current,
      [sectionName]: current[sectionName].map((row, index) => (index === rowIndex ? { ...row, [field]: value } : row)),
    }))
  }

  function addSectionRow(sectionName: string) {
    setSections((current) => ({
      ...current,
      [sectionName]: [...current[sectionName], emptyExerciseRow()],
    }))
  }

  function removeSectionRow(sectionName: string, rowIndex: number) {
    setSections((current) => {
      const nextRows = current[sectionName].filter((_, index) => index !== rowIndex)
      return {
        ...current,
        [sectionName]: nextRows.length > 0 ? nextRows : [emptyExerciseRow()],
      }
    })
  }

  async function handleCreateBlock() {
    setIsCreating(true)
    setCreateError(null)
    setCreateMessage(null)

    try {
      const payload = await requestJson<{ block: BlockTemplateRecord }>(`/api/coach/blocks`, {
        method: 'POST',
        body: JSON.stringify({
          blockCode,
          blockName,
          goal,
          trainingElement,
          description,
          sections: MANUAL_BLOCK_SECTION_NAMES.map((sectionName) => ({
            section_name: sectionName,
            exercises: sections[sectionName],
          })),
        }),
      })

      setBlocks((current) => [...current, payload.block].sort((left, right) => left.id - right.id))
      setCreateMessage(payload.message ?? '已建立板塊模板。')
      resetForm()
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : '建立板塊失敗。')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteBlock(block: BlockTemplateRecord) {
    setDeletingBlockId(block.id)
    setActionError((current) => ({ ...current, [block.id]: '' }))
    setActionMessage((current) => ({ ...current, [block.id]: '' }))

    try {
      const payload = await requestJson<{ blockId: number }>(`/api/coach/blocks/${block.id}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      })

      setBlocks((current) => current.filter((entry) => entry.id !== payload.blockId))
      setExpandedBlockIds((current) => current.filter((entry) => entry !== payload.blockId))
      setCreateMessage(payload.message ?? '已刪除板塊。')
      setConfirmDeleteId(null)
    } catch (requestError) {
      setActionError((current) => ({
        ...current,
        [block.id]: requestError instanceof Error ? requestError.message : '刪除板塊失敗。',
      }))
    } finally {
      setDeletingBlockId(null)
    }
  }

  function toggleExpanded(blockId: number) {
    setExpandedBlockIds((current) =>
      current.includes(blockId) ? current.filter((entry) => entry !== blockId) : [...current, blockId],
    )
  }

  function toggleImportSelection(blockCode: string) {
    setSelectedImportBlockCodes((current) =>
      current.includes(blockCode) ? current.filter((entry) => entry !== blockCode) : [...current, blockCode],
    )
  }

  async function handlePreviewImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsPreviewLoading(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/coach/blocks/import/preview', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json().catch(() => null)) as ({ error?: string } & ImportPreviewState) | null

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? 'Excel 預覽失敗。')
      }

      setImportPreview(payload)
      setSelectedImportBlockCodes(payload.importableBlocks.map((block) => block.sheetName))
    } catch (requestError) {
      setImportPreview(null)
      setSelectedImportBlockCodes([])
      setImportError(requestError instanceof Error ? requestError.message : 'Excel 預覽失敗。')
    } finally {
      setIsPreviewLoading(false)
      event.target.value = ''
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return

    const selectedBlocks = importPreview.importableBlocks.filter((block) => selectedImportBlockCodes.includes(block.sheetName))
    if (selectedBlocks.length === 0) {
      setImportError('目前沒有選取任何可匯入的新板塊。')
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const payload = await requestJson<{ importedBlocks: BlockTemplateRecord[]; importedCount: number }>(`/api/coach/blocks/import`, {
        method: 'POST',
        body: JSON.stringify({
          selectedBlocks,
          description: importDescription,
        }),
      })

      setBlocks((current) =>
        [...current, ...payload.importedBlocks]
          .filter((block, index, list) => list.findIndex((entry) => entry.id === block.id) === index)
          .sort((left, right) => left.id - right.id),
      )
      setImportMessage(payload.message ?? `已從 Excel 匯入 ${payload.importedCount} 個板塊。`)
      setImportPreview(null)
      setSelectedImportBlockCodes([])
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : 'Excel 匯入失敗。')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Blocks</p>
          <p className="mt-3 font-display text-4xl leading-none text-slate-900">{totalBlocks}</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Exercises</p>
          <p className="mt-3 font-display text-4xl leading-none text-slate-900">{totalExercises}</p>
        </article>
      </section>

      <article className="lab-card p-6 sm:p-7">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 text-left"
          onClick={() => setIsImportSectionOpen((current) => !current)}
          aria-expanded={isImportSectionOpen}
        >
          <div>
            <p className="lab-eyebrow">Excel Import</p>
            <h2 className="lab-section-title mt-3">從 Excel 匯入板塊</h2>
          </div>
          <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{isImportSectionOpen ? '收起' : '展開'}</span>
        </button>

        {isImportSectionOpen ? (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="lab-copy">支援你目前的 LAB33 板塊模板格式。先上傳 `.xlsx` 讀取預覽，再勾選要匯入的工作表。</p>
              </div>
              <span className="lab-badge-info">只支援 .xlsx</span>
            </div>

            <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-5">
              <label className="block text-sm font-semibold text-slate-700">上傳板塊 Excel 檔</label>
              <input
                type="file"
                accept=".xlsx"
                className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
                onChange={(event) => void handlePreviewImport(event)}
              />
              <p className="mt-3 text-xs text-slate-500">目前會比對 Block Code，避免把資料庫已存在的板塊重複匯入。</p>
            </div>

            {isPreviewLoading ? <p className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm text-slate-700">Excel 解析中...</p> : null}
            {importError ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{importError}</p> : null}
            {importMessage ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importMessage}</p> : null}

            {importPreview ? (
              <div className="space-y-5">
                <div className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">匯入預覽</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        已讀取 {importPreview.totalSheets} 個工作表，可匯入 {importPreview.importableBlocks.length} 個板塊。
                      </p>
                    </div>
                    <span className="lab-badge-primary">{selectedImportBlockCodes.length} 個已選取</span>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-[1.25rem] border border-slate-200">
                    <table className="min-w-[860px] w-full border-collapse text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          {['匯入', 'Block Code', '顯示名稱', '週期目標', '訓練元素', '區段數', '動作數'].map((label) => (
                            <th key={label} className="border-b border-slate-200 px-3 py-3 font-semibold">{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.importableBlocks.map((block) => (
                          <tr key={block.sheetName}>
                            <td className="border-b border-slate-100 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedImportBlockCodes.includes(block.sheetName)}
                                onChange={() => toggleImportSelection(block.sheetName)}
                              />
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">{block.sheetName}</td>
                            <td className="border-b border-slate-100 px-3 py-3">{block.blockName}</td>
                            <td className="border-b border-slate-100 px-3 py-3">{block.goal || '-'}</td>
                            <td className="border-b border-slate-100 px-3 py-3">{block.trainingElement || '-'}</td>
                            <td className="border-b border-slate-100 px-3 py-3">{block.sections.length}</td>
                            <td className="border-b border-slate-100 px-3 py-3">{block.exerciseCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {importPreview.skippedRows.length > 0 ? (
                    <div className="mt-5">
                      <h4 className="text-base font-bold text-slate-900">以下板塊會跳過</h4>
                      <div className="mt-3 overflow-x-auto rounded-[1.25rem] border border-amber-200">
                        <table className="min-w-[640px] w-full border-collapse text-sm">
                          <thead className="bg-amber-50 text-left text-amber-800">
                            <tr>
                              {['Block Code', '顯示名稱', '跳過原因'].map((label) => (
                                <th key={label} className="border-b border-amber-200 px-3 py-3 font-semibold">{label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.skippedRows.map((row) => (
                              <tr key={`${row.blockCode}-${row.reason}`}>
                                <td className="border-b border-amber-100 px-3 py-3 font-semibold text-slate-900">{row.blockCode}</td>
                                <td className="border-b border-amber-100 px-3 py-3">{row.blockName}</td>
                                <td className="border-b border-amber-100 px-3 py-3">{row.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 space-y-2">
                    <label className="text-sm font-semibold text-slate-700">描述</label>
                    <textarea className="lab-input min-h-24" value={importDescription} onChange={(event) => setImportDescription(event.target.value)} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className="lab-btn-primary" disabled={isImporting} onClick={() => void handleConfirmImport()}>
                      {isImporting ? '匯入中...' : `確認匯入選取的 ${selectedImportBlockCodes.length} 個板塊`}
                    </button>
                    <button
                      type="button"
                      className="lab-btn-secondary"
                      onClick={() => {
                        setImportPreview(null)
                        setSelectedImportBlockCodes([])
                      }}
                    >
                      清除預覽
                    </button>
                  </div>
                </div>
                {importPreview.importableBlocks
                  .filter((block) => selectedImportBlockCodes.includes(block.sheetName))
                  .map((block) => (
                    <article key={`preview-${block.sheetName}`} className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{block.sheetName} | {block.blockName}</h3>
                          <p className="mt-2 text-sm text-slate-500">{block.goal || '未填寫週期目標'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="lab-badge bg-slate-100 text-slate-600">{block.sections.length} 個區段</span>
                          <span className="lab-badge bg-slate-100 text-slate-600">{block.exerciseCount} 個動作</span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        {block.sections.map((section) => (
                          <section key={`${block.sheetName}-${section.section_name}`} className="space-y-2">
                            <h4 className="text-base font-bold text-slate-900">{section.section_name}</h4>
                            <div className="overflow-x-auto rounded-[1rem] border border-slate-200">
                              <table className="min-w-[920px] w-full border-collapse text-sm">
                                <thead className="bg-slate-50 text-left text-slate-500">
                                  <tr>
                                    {['動作', '組數', '次數/時間', '工具', '強度', '重量', '休息時間', '影片連結'].map((label) => (
                                      <th key={label} className="border-b border-slate-200 px-3 py-3 font-semibold">{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.exercises.map((exercise, index) => (
                                    <tr key={`${section.section_name}-${index}`}>
                                      <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">{exercise.exercise_name}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.sets || '-'}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.reps_or_time || '-'}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.equipment || '-'}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.intensity || '-'}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.weight || '-'}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.rest || '-'}</td>
                                      <td className="border-b border-slate-100 px-3 py-3">{exercise.video_url || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      <article className="lab-card p-6 sm:p-7">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 text-left"
          onClick={() => setIsManualSectionOpen((current) => !current)}
          aria-expanded={isManualSectionOpen}
        >
          <div>
            <p className="lab-eyebrow">Manual Template</p>
            <h2 className="lab-section-title mt-3">直接填寫板塊模板</h2>
          </div>
          <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{isManualSectionOpen ? '收起' : '展開'}</span>
        </button>

        {isManualSectionOpen ? (
          <>
            <div className="mt-6">
              <p className="lab-copy">依照 LAB33 現有模板手動輸入區段與動作，建立可重複使用的板塊內容。</p>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Block Code</label>
                <input className="lab-input" value={blockCode} onChange={(event) => setBlockCode(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">顯示名稱</label>
                <input className="lab-input" value={blockName} onChange={(event) => setBlockName(event.target.value)} placeholder="留空時會用 Block Code" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">週期目標</label>
                <textarea className="lab-input min-h-28" value={goal} onChange={(event) => setGoal(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">訓練元素</label>
                <textarea className="lab-input min-h-28" value={trainingElement} onChange={(event) => setTrainingElement(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <label className="text-sm font-semibold text-slate-700">描述</label>
                <textarea className="lab-input min-h-32" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {MANUAL_BLOCK_SECTION_NAMES.map((sectionName) => (
                <section key={sectionName} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-bold text-slate-900">{sectionName}</h3>
                    <span className="lab-badge bg-slate-100 text-slate-600">{sections[sectionName].length} 列</span>
                  </div>
                  <ExerciseTable
                    rows={sections[sectionName]}
                    onChange={(rowIndex, field, value) => updateSectionRow(sectionName, rowIndex, field, value)}
                    onAddRow={() => addSectionRow(sectionName)}
                    onRemoveRow={(rowIndex) => removeSectionRow(sectionName, rowIndex)}
                  />
                </section>
              ))}
            </div>

            {createError ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</p> : null}
            {createMessage ? <p className="mt-5 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createMessage}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="lab-btn-primary" disabled={isCreating} onClick={() => void handleCreateBlock()}>
                {isCreating ? '建立中...' : '建立這個板塊模板'}
              </button>
              <button type="button" className="lab-btn-secondary" onClick={resetForm}>
                清空模板內容
              </button>
            </div>
          </>
        ) : null}
      </article>

      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="lab-eyebrow">Block Library</p>
            <h2 className="lab-section-title mt-3">板塊詳細內容</h2>
            <p className="lab-copy mt-3">保留 Streamlit 的查看與刪除流程。刪除板塊時，已安排給學員的對應課表也會一起移除。</p>
          </div>
          <span className="lab-badge-primary">{blocks.length} 個板塊</span>
        </div>

        {blocks.length === 0 ? (
          <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">目前尚未建立板塊。</div>
        ) : (
          <div className="mt-6 space-y-4">
            {blocks.map((block) => (
              <article key={block.id} className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{blockLabel(block)}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {block.goal || '未填寫週期目標'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="lab-badge bg-slate-100 text-slate-600">{block.sectionCount} 個區段</span>
                    <span className="lab-badge bg-slate-100 text-slate-600">{block.exerciseCount} 個動作</span>
                    <button
                      type="button"
                      className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                      onClick={() => toggleExpanded(block.id)}
                    >
                      {expandedBlockIds.includes(block.id) ? '收起內容' : '查看內容'}
                    </button>
                    <button
                      type="button"
                      className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                      onClick={() => setConfirmDeleteId((current) => (current === block.id ? null : block.id))}
                    >
                      刪除
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[1rem] bg-slate-50 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Block Code</dt>
                      <dd className="mt-2 font-medium text-slate-900">{block.block_code || '-'}</dd>
                    </div>
                    <div className="rounded-[1rem] bg-slate-50 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">顯示名稱</dt>
                      <dd className="mt-2 font-medium text-slate-900">{block.block_name || '-'}</dd>
                    </div>
                    <div className="rounded-[1rem] bg-slate-50 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">訓練元素</dt>
                      <dd className="mt-2 font-medium text-slate-900">{block.training_element || '-'}</dd>
                    </div>
                  </dl>

                  {block.description ? <div className="rounded-[1rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700"><strong>描述：</strong>{block.description}</div> : null}

                  {confirmDeleteId === block.id ? (
                    <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      <p className="font-semibold">確認要刪除 {blockLabel(block)} 嗎？</p>
                      <p className="mt-2">刪除後會移除板塊詳細內容，也會從已安排給學員的課表中移除。</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="lab-btn-primary !min-h-10 px-4 py-2 text-sm"
                          disabled={deletingBlockId === block.id}
                          onClick={() => void handleDeleteBlock(block)}
                        >
                          {deletingBlockId === block.id ? '刪除中...' : '確認刪除'}
                        </button>
                        <button
                          type="button"
                          className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {actionError[block.id] ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError[block.id]}</p> : null}
                  {actionMessage[block.id] ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionMessage[block.id]}</p> : null}

                  {expandedBlockIds.includes(block.id) ? <BlockDetailTable block={block} /> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
