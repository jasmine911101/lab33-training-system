'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  MANUAL_BLOCK_SECTION_NAMES,
  type BlockExerciseTemplateInput,
  type BlockTemplateRecord,
} from '@/lib/types/block-management'

type SectionState = Record<string, BlockExerciseTemplateInput[]>

type Props = {
  trainingCategoryId: number
  categoryName: string
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

export function CoachCategoryBlockManual({ trainingCategoryId, categoryName }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [blockCode, setBlockCode] = useState('')
  const [blockName, setBlockName] = useState('')
  const [goal, setGoal] = useState('')
  const [trainingElement, setTrainingElement] = useState('')
  const [description, setDescription] = useState('')
  const [sections, setSections] = useState<SectionState>(buildInitialSections)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createMessage, setCreateMessage] = useState<string | null>(null)

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
          trainingCategoryId,
          sections: MANUAL_BLOCK_SECTION_NAMES.map((sectionName) => ({
            section_name: sectionName,
            exercises: sections[sectionName],
          })),
        }),
      })

      setCreateMessage(payload.message ?? '已建立板塊模板。')
      resetForm()
      router.refresh()
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : '建立板塊失敗。')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <article className="lab-card p-6 sm:p-7">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <div>
          <p className="lab-eyebrow">Manual Template</p>
          <h2 className="lab-section-title mt-3">直接填寫板塊模板</h2>
          <p className="lab-copy mt-3">目前手動建立的板塊會自動歸到「{categoryName}」這個訓練分類。</p>
        </div>
        <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{isOpen ? '收起' : '展開'}</span>
      </button>

      {isOpen ? (
        <>
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
  )
}
