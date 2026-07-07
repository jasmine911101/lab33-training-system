'use client'

import { useEffect, useMemo, useState } from 'react'

import type {
  BlockExerciseTemplateInput,
  BlockSectionTemplateInput,
  BlockTemplateRecord,
} from '@/lib/types/block-management'

type Props = {
  initialBlocks: BlockTemplateRecord[]
  title?: string
  description?: string
  badgeLabel?: string
}

type EditableExercise = BlockExerciseTemplateInput & {
  localId: string
}

type EditableSection = {
  localId: string
  section_name: string
  exercises: EditableExercise[]
}

type EditableBlockDraft = {
  blockCode: string
  blockName: string
  goal: string
  trainingElement: string
  description: string
  sections: EditableSection[]
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
  { key: 'notes', label: '備註' },
] as const

function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyExerciseRow(): EditableExercise {
  return {
    localId: makeLocalId('exercise'),
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

function blockLabel(block: BlockTemplateRecord) {
  if (block.block_code && block.block_name) return `${block.block_code} | ${block.block_name}`
  return block.block_name || block.block_code || `Block ${block.id}`
}

function createDraftFromBlock(block: BlockTemplateRecord): EditableBlockDraft {
  return {
    blockCode: block.block_code ?? '',
    blockName: block.block_name ?? '',
    goal: block.goal ?? '',
    trainingElement: block.training_element ?? '',
    description: block.description ?? '',
    sections:
      block.sections.length > 0
        ? block.sections.map((section) => ({
            localId: makeLocalId('section'),
            section_name: section.section_name ?? '',
            exercises:
              section.exercises.length > 0
                ? section.exercises.map((exercise) => ({
                    localId: makeLocalId('exercise'),
                    exercise_name: exercise.exercise_name ?? '',
                    sets: exercise.sets ?? '',
                    reps_or_time: exercise.reps_or_time ?? '',
                    equipment: exercise.equipment ?? '',
                    intensity: exercise.intensity ?? '',
                    weight: exercise.weight ?? '',
                    rest: exercise.rest ?? '',
                    video_url: exercise.video_url ?? '',
                    notes: exercise.notes ?? '',
                  }))
                : [emptyExerciseRow()],
          }))
        : [
            {
              localId: makeLocalId('section'),
              section_name: '',
              exercises: [emptyExerciseRow()],
            },
          ],
  }
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

  return (payload ?? {}) as T & { message?: string }
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
            <table className="min-w-[1080px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  {['動作', '組數', '次數/時間', '工具', '強度', '重量', '休息時間', '影片連結', '備註'].map((label) => (
                    <th key={label} className="border-b border-slate-200 px-3 py-3 font-semibold">{label}</th>
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

function ExerciseEditorTable({
  rows,
  onChange,
  onAddRow,
  onRemoveRow,
}: {
  rows: EditableExercise[]
  onChange: (rowIndex: number, field: keyof BlockExerciseTemplateInput, value: string) => void
  onAddRow: () => void
  onRemoveRow: (rowIndex: number) => void
}) {
  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
      <table className="min-w-[1180px] w-full border-collapse text-sm">
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
            <tr key={row.localId} className="align-top">
              {EXERCISE_HEADERS.map((header) => (
                <td key={`${header.key}-${row.localId}`} className="border-b border-slate-100 p-2">
                  {header.key === 'notes' ? (
                    <textarea
                      value={row[header.key] ?? ''}
                      onChange={(event) => onChange(rowIndex, header.key, event.target.value)}
                      className="lab-input min-h-24 rounded-2xl px-3 py-2 text-sm"
                      placeholder={header.label}
                    />
                  ) : (
                    <input
                      value={row[header.key] ?? ''}
                      onChange={(event) => onChange(rowIndex, header.key, event.target.value)}
                      className="lab-input !min-h-10 rounded-2xl px-3 py-2 text-sm"
                      placeholder={header.label}
                    />
                  )}
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

function BlockEditor({
  draft,
  saving,
  error,
  message,
  onChangeField,
  onChangeSectionName,
  onChangeExercise,
  onAddSection,
  onRemoveSection,
  onAddExercise,
  onRemoveExercise,
  onCancel,
  onSave,
}: {
  draft: EditableBlockDraft
  saving: boolean
  error?: string
  message?: string
  onChangeField: (field: keyof Omit<EditableBlockDraft, 'sections'>, value: string) => void
  onChangeSectionName: (sectionIndex: number, value: string) => void
  onChangeExercise: (sectionIndex: number, rowIndex: number, field: keyof BlockExerciseTemplateInput, value: string) => void
  onAddSection: () => void
  onRemoveSection: (sectionIndex: number) => void
  onAddExercise: (sectionIndex: number) => void
  onRemoveExercise: (sectionIndex: number, rowIndex: number) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="space-y-6 rounded-[1.5rem] border border-orange-200 bg-orange-50/50 p-5 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">Block Code</label>
          <input className="lab-input" value={draft.blockCode} onChange={(event) => onChangeField('blockCode', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">顯示名稱</label>
          <input className="lab-input" value={draft.blockName} onChange={(event) => onChangeField('blockName', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">週期目標</label>
          <textarea className="lab-input min-h-28" value={draft.goal} onChange={(event) => onChangeField('goal', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">訓練元素</label>
          <textarea className="lab-input min-h-28" value={draft.trainingElement} onChange={(event) => onChangeField('trainingElement', event.target.value)} />
        </div>
        <div className="space-y-2 xl:col-span-2">
          <label className="text-sm font-semibold text-slate-700">描述</label>
          <textarea className="lab-input min-h-32" value={draft.description} onChange={(event) => onChangeField('description', event.target.value)} />
        </div>
      </div>

      <div className="space-y-6">
        {draft.sections.map((section, sectionIndex) => (
          <section key={section.localId} className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-semibold text-slate-700">Section 名稱</label>
                <input
                  className="lab-input"
                  value={section.section_name}
                  onChange={(event) => onChangeSectionName(sectionIndex, event.target.value)}
                  placeholder="輸入 section 名稱"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:pt-7">
                <span className="lab-badge bg-slate-100 text-slate-600">{section.exercises.length} 列</span>
                <button type="button" className="lab-btn-secondary !min-h-10 px-3 py-2 text-sm" onClick={() => onRemoveSection(sectionIndex)}>
                  刪除區段
                </button>
              </div>
            </div>
            <ExerciseEditorTable
              rows={section.exercises}
              onChange={(rowIndex, field, value) => onChangeExercise(sectionIndex, rowIndex, field, value)}
              onAddRow={() => onAddExercise(sectionIndex)}
              onRemoveRow={(rowIndex) => onRemoveExercise(sectionIndex, rowIndex)}
            />
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onAddSection}>
          新增 section
        </button>
      </div>

      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="lab-btn-primary" disabled={saving} onClick={onSave}>
          {saving ? '儲存中...' : '儲存板塊修改'}
        </button>
        <button type="button" className="lab-btn-secondary" disabled={saving} onClick={onCancel}>
          取消編輯
        </button>
      </div>
    </div>
  )
}

export function CoachBlockLibraryPanel({ initialBlocks, title = '板塊內容', description = '顯示目前分類下的板塊內容。', badgeLabel }: Props) {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<number | null>(null)
  const [draft, setDraft] = useState<EditableBlockDraft | null>(null)
  const [deletingBlockId, setDeletingBlockId] = useState<number | null>(null)
  const [savingBlockId, setSavingBlockId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<Record<number, string>>({})
  const [actionMessage, setActionMessage] = useState<Record<number, string>>({})

  const totalExercises = useMemo(() => blocks.reduce((sum, block) => sum + block.exerciseCount, 0), [blocks])

  const filteredBlocks = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return blocks

    return blocks.filter((block) => {
      const haystack = [block.block_code, block.block_name, block.goal, block.training_element, block.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(keyword)
    })
  }, [blocks, searchQuery])

  useEffect(() => {
    setBlocks(initialBlocks)
  }, [initialBlocks])

  function clearBlockFeedback(blockId: number) {
    setActionError((current) => ({ ...current, [blockId]: '' }))
    setActionMessage((current) => ({ ...current, [blockId]: '' }))
  }

  function handleOpenDetail(blockId: number) {
    setActiveBlockId((current) => (current === blockId && editingBlockId === null ? null : blockId))
    if (editingBlockId !== null && editingBlockId !== blockId) {
      setEditingBlockId(null)
      setDraft(null)
    }
  }

  function handleStartEdit(block: BlockTemplateRecord) {
    clearBlockFeedback(block.id)
    setActiveBlockId(block.id)
    setEditingBlockId(block.id)
    setDraft(createDraftFromBlock(block))
  }

  function handleCancelEdit() {
    setEditingBlockId(null)
    setDraft(null)
  }

  function updateDraftField(field: keyof Omit<EditableBlockDraft, 'sections'>, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function updateSectionName(sectionIndex: number, value: string) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        sections: current.sections.map((section, index) =>
          index === sectionIndex ? { ...section, section_name: value } : section,
        ),
      }
    })
  }

  function updateExerciseField(sectionIndex: number, rowIndex: number, field: keyof BlockExerciseTemplateInput, value: string) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        sections: current.sections.map((section, index) => {
          if (index !== sectionIndex) return section
          return {
            ...section,
            exercises: section.exercises.map((exercise, exerciseIndex) =>
              exerciseIndex === rowIndex ? { ...exercise, [field]: value } : exercise,
            ),
          }
        }),
      }
    })
  }

  function addSection() {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        sections: [
          ...current.sections,
          {
            localId: makeLocalId('section'),
            section_name: '',
            exercises: [emptyExerciseRow()],
          },
        ],
      }
    })
  }

  function removeSection(sectionIndex: number) {
    setDraft((current) => {
      if (!current) return current
      const nextSections = current.sections.filter((_, index) => index !== sectionIndex)
      return {
        ...current,
        sections:
          nextSections.length > 0
            ? nextSections
            : [
                {
                  localId: makeLocalId('section'),
                  section_name: '',
                  exercises: [emptyExerciseRow()],
                },
              ],
      }
    })
  }

  function addExercise(sectionIndex: number) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        sections: current.sections.map((section, index) =>
          index === sectionIndex ? { ...section, exercises: [...section.exercises, emptyExerciseRow()] } : section,
        ),
      }
    })
  }

  function removeExercise(sectionIndex: number, rowIndex: number) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        sections: current.sections.map((section, index) => {
          if (index !== sectionIndex) return section
          const nextRows = section.exercises.filter((_, exerciseIndex) => exerciseIndex !== rowIndex)
          return {
            ...section,
            exercises: nextRows.length > 0 ? nextRows : [emptyExerciseRow()],
          }
        }),
      }
    })
  }

  async function handleSaveBlock(blockId: number) {
    if (!draft) return

    setSavingBlockId(blockId)
    clearBlockFeedback(blockId)

    try {
      const payload = await requestJson<{ block: BlockTemplateRecord }>(`/api/coach/blocks/${blockId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          blockCode: draft.blockCode,
          blockName: draft.blockName,
          goal: draft.goal,
          trainingElement: draft.trainingElement,
          description: draft.description,
          sections: draft.sections.map((section): BlockSectionTemplateInput => ({
            section_name: section.section_name,
            exercises: section.exercises.map((exercise) => ({
              exercise_name: exercise.exercise_name,
              sets: exercise.sets,
              reps_or_time: exercise.reps_or_time,
              equipment: exercise.equipment,
              intensity: exercise.intensity,
              weight: exercise.weight,
              rest: exercise.rest,
              video_url: exercise.video_url,
              notes: exercise.notes,
            })),
          })),
        }),
      })

      setBlocks((current) => current.map((entry) => (entry.id === blockId ? payload.block : entry)))
      setActionMessage((current) => ({ ...current, [blockId]: payload.message ?? '已更新板塊內容。' }))
      setEditingBlockId(null)
      setDraft(null)
      setActiveBlockId(blockId)
    } catch (requestError) {
      setActionError((current) => ({
        ...current,
        [blockId]: requestError instanceof Error ? requestError.message : '更新板塊失敗。',
      }))
    } finally {
      setSavingBlockId(null)
    }
  }

  async function handleDeleteBlock(block: BlockTemplateRecord) {
    setDeletingBlockId(block.id)
    clearBlockFeedback(block.id)

    try {
      const payload = await requestJson<{ blockId: number; message?: string }>(`/api/coach/blocks/${block.id}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      })

      setBlocks((current) => current.filter((entry) => entry.id !== payload.blockId))
      if (activeBlockId === payload.blockId) setActiveBlockId(null)
      if (editingBlockId === payload.blockId) {
        setEditingBlockId(null)
        setDraft(null)
      }
      setActionMessage((current) => ({ ...current, [block.id]: payload.message ?? '已刪除板塊。' }))
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

  return (
    <article className="lab-card p-6 sm:p-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="lab-eyebrow">Block Library</p>
          <h2 className="lab-section-title mt-3">{title}</h2>
          <p className="lab-copy mt-3">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {badgeLabel ? <span className="lab-badge bg-orange-100 text-orange-700">{badgeLabel}</span> : null}
          <span className="lab-badge-primary">{filteredBlocks.length} / {blocks.length} 個板塊</span>
          <span className="lab-badge bg-slate-100 text-slate-600">{totalExercises} 個動作</span>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <label className="text-sm font-semibold text-slate-700">搜尋板塊</label>
        <input
          className="lab-input"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="搜尋 Block Code、顯示名稱、週期目標、訓練元素或描述"
        />
      </div>

      {filteredBlocks.length === 0 ? (
        <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">
          {blocks.length === 0 ? '目前這個分類底下還沒有板塊。' : '找不到符合搜尋條件的板塊。'}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
          {filteredBlocks.map((block, index) => {
            const isActive = activeBlockId === block.id
            const isEditing = editingBlockId === block.id

            return (
              <div key={block.id} className={index > 0 ? 'border-t border-slate-200' : ''}>
                <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(block.id)}
                    className={`flex-1 rounded-[1rem] px-3 py-3 text-left transition ${
                      isActive ? 'bg-orange-50 text-slate-900' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
                      <span>{block.block_code || '-'}</span>
                      <span className="text-slate-300">|</span>
                      <span>{block.block_name || '未命名板塊'}</span>
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      className={`lab-btn-secondary !min-h-10 px-4 py-2 text-sm ${isActive && !isEditing ? '!border-orange-300 !bg-orange-50 !text-orange-700' : ''}`}
                      onClick={() => handleOpenDetail(block.id)}
                    >
                      {isActive && !isEditing ? '收起內容' : '查看內容'}
                    </button>
                    <button
                      type="button"
                      className={`lab-btn-secondary !min-h-10 px-4 py-2 text-sm ${isEditing ? '!border-orange-300 !bg-orange-50 !text-orange-700' : ''}`}
                      onClick={() => handleStartEdit(block)}
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                      onClick={() => {
                        setActiveBlockId(block.id)
                        setConfirmDeleteId((current) => (current === block.id ? null : block.id))
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </div>

                {isActive ? (
                  <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-5 sm:py-6">
                    {isEditing && draft ? (
                      <BlockEditor
                        draft={draft}
                        saving={savingBlockId === block.id}
                        error={actionError[block.id]}
                        message={actionMessage[block.id]}
                        onChangeField={updateDraftField}
                        onChangeSectionName={updateSectionName}
                        onChangeExercise={updateExerciseField}
                        onAddSection={addSection}
                        onRemoveSection={removeSection}
                        onAddExercise={addExercise}
                        onRemoveExercise={removeExercise}
                        onCancel={handleCancelEdit}
                        onSave={() => void handleSaveBlock(block.id)}
                      />
                    ) : (
                      <div className="space-y-5">
                        <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-[1rem] bg-white px-4 py-3">
                            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">週期目標</dt>
                            <dd className="mt-2 whitespace-pre-wrap leading-6 text-slate-900">{block.goal || '-'}</dd>
                          </div>
                          <div className="rounded-[1rem] bg-white px-4 py-3">
                            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">訓練元素</dt>
                            <dd className="mt-2 whitespace-pre-wrap leading-6 text-slate-900">{block.training_element || '-'}</dd>
                          </div>
                          <div className="rounded-[1rem] bg-white px-4 py-3">
                            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">描述</dt>
                            <dd className="mt-2 whitespace-pre-wrap leading-6 text-slate-900">{block.description || '-'}</dd>
                          </div>
                        </dl>

                        {confirmDeleteId === block.id ? (
                          <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                            <p className="font-semibold">確認要刪除 {blockLabel(block)} 嗎？</p>
                            <p className="mt-2">這只會刪除 block template 本身與它的 sections / exercises，不會改動已安排給學員的 snapshot。</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                className="lab-btn-primary !min-h-10 px-4 py-2 text-sm"
                                disabled={deletingBlockId === block.id}
                                onClick={() => void handleDeleteBlock(block)}
                              >
                                {deletingBlockId === block.id ? '刪除中...' : '確認刪除'}
                              </button>
                              <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setConfirmDeleteId(null)}>
                                取消
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {actionError[block.id] ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError[block.id]}</p> : null}
                        {actionMessage[block.id] ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionMessage[block.id]}</p> : null}

                        <BlockDetailTable block={block} />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
