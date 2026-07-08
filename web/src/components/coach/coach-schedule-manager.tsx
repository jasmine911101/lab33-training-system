'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { GENERAL_EVENT_TYPES, TRAINING_CATEGORIES } from '@/lib/types/schedule-management'
import type {
  BlockTaxonomyAgeGroupRecord,
  BlockTaxonomySportRecord,
  BlockTaxonomyTrainingCategoryRecord,
} from '@/lib/types/block-taxonomy'
import type { AthleteScheduleBundle, AssignmentDetail, BlockRecord, GeneralEventDetail } from '@/services/schedule'

const UNCATEGORIZED_SELECTOR = '__uncategorized__'

type ScheduleItem =
  | { kind: 'assignment'; id: string; recordId: number; startDate: string; endDate: string; title: string; meta: string; previewTop: string; previewBottom: string }
  | { kind: 'event'; id: string; recordId: number; startDate: string; endDate: string; title: string; meta: string; previewTop: string; previewBottom?: string }

type CoachScheduleManagerProps = {
  athleteId: number
  initialSchedule: AthleteScheduleBundle
  blocks: BlockRecord[]
  taxonomy: {
    sports: BlockTaxonomySportRecord[]
    ageGroups: BlockTaxonomyAgeGroupRecord[]
    trainingCategories: BlockTaxonomyTrainingCategoryRecord[]
  }
}

type AssignmentFormState = {
  blockId: string
  eventName: string
  cycleGoal: string
  startDate: string
  endDate: string
  weekNum: string
  dayNum: string
  trainingCategory: string
  notes: string
}

type EventFormState = {
  title: string
  eventType: string
  startDate: string
  endDate: string
  notes: string
}

type EditableExercise = {
  localId: string
  persisted: boolean
  sourceId: string
  exercise_name: string
  sets: string
  reps_or_time: string
  equipment: string
  intensity: string
  weight: string
  rest: string
  video_url: string
  notes: string
}

type EditableSection = {
  name: string
  rows: EditableExercise[]
}

type WeekMarker = {
  id: string
  startDate: string
  endDate: string
  weekNum: string
  note: string
  colorKey: string
}

const DEFAULT_WEEK_MARKER_COLOR_KEY = 'sky'

const WEEK_MARKER_COLORS = [
  {
    key: 'sky',
    name: '藍色',
    bandClass: 'bg-sky-100/90 text-sky-800',
    badgeClass: 'bg-sky-600 text-white',
    chipClass: 'bg-sky-100 text-sky-800',
    swatchClass: 'bg-sky-500',
  },
  {
    key: 'emerald',
    name: '綠色',
    bandClass: 'bg-emerald-100/90 text-emerald-800',
    badgeClass: 'bg-emerald-600 text-white',
    chipClass: 'bg-emerald-100 text-emerald-800',
    swatchClass: 'bg-emerald-500',
  },
  {
    key: 'amber',
    name: '橘色',
    bandClass: 'bg-amber-100/90 text-amber-900',
    badgeClass: 'bg-amber-500 text-white',
    chipClass: 'bg-amber-100 text-amber-900',
    swatchClass: 'bg-amber-500',
  },
  {
    key: 'violet',
    name: '紫色',
    bandClass: 'bg-violet-100/90 text-violet-800',
    badgeClass: 'bg-violet-600 text-white',
    chipClass: 'bg-violet-100 text-violet-800',
    swatchClass: 'bg-violet-500',
  },
  {
    key: 'rose',
    name: '粉色',
    bandClass: 'bg-rose-100/90 text-rose-800',
    badgeClass: 'bg-rose-500 text-white',
    chipClass: 'bg-rose-100 text-rose-800',
    swatchClass: 'bg-rose-500',
  },
  {
    key: 'slate',
    name: '灰色',
    bandClass: 'bg-slate-200/90 text-slate-800',
    badgeClass: 'bg-slate-600 text-white',
    chipClass: 'bg-slate-200 text-slate-800',
    swatchClass: 'bg-slate-500',
  },
] as const

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function padMonth(value: number) {
  return String(value).padStart(2, '0')
}

function firstDayOfMonth(isoMonth: string) {
  return new Date(`${isoMonth}-01T00:00:00`)
}

function shiftMonth(isoMonth: string, delta: number) {
  const [year, month] = isoMonth.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`
}

function formatMonthLabel(isoMonth: string) {
  const [year, month] = isoMonth.split('-').map(Number)
  return `${year}年 ${month}月`
}

function rangeIncludes(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate
}

function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function blockNameFromLabel(label: string) {
  if (!label.includes('|')) return label || '未命名板塊'
  const [, ...rest] = label.split('|')
  const extracted = rest.join('|').trim()
  return extracted || label.trim() || '未命名板塊'
}

function compactWeekLabel(weekLabel: string) {
  const matched = weekLabel.match(/(\d+)/)
  return matched ? `W${matched[1]}` : 'W-'
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function weekdayFromIso(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay() || 7
  return String(weekday)
}

function normalizeRange(startDate: string, endDate: string) {
  if (startDate <= endDate) {
    return { startDate, endDate }
  }

  return { startDate: endDate, endDate: startDate }
}

function resolveWeekMarker(date: string, markers: WeekMarker[]) {
  for (let index = markers.length - 1; index >= 0; index -= 1) {
    const marker = markers[index]
    if (rangeIncludes(date, marker.startDate, marker.endDate)) {
      return marker
    }
  }

  return null
}

function getWeekMarkerColor(colorKey?: string) {
  return WEEK_MARKER_COLORS.find((option) => option.key === colorKey) ?? WEEK_MARKER_COLORS[0]
}

function loadWeekMarkers(storageKey: string) {
  if (typeof window === 'undefined') return [] as WeekMarker[]

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return [] as WeekMarker[]

    const parsed = JSON.parse(raw) as WeekMarker[]
    if (!Array.isArray(parsed)) return [] as WeekMarker[]

    return parsed.filter(
      (marker) =>
        marker &&
        typeof marker.id === 'string' &&
        typeof marker.startDate === 'string' &&
        typeof marker.endDate === 'string' &&
        typeof marker.weekNum === 'string' &&
        typeof marker.note === 'string',
    )
    .map((marker) => ({
      ...marker,
      colorKey: typeof marker.colorKey === 'string' ? marker.colorKey : DEFAULT_WEEK_MARKER_COLOR_KEY,
    }))
  } catch {
    return [] as WeekMarker[]
  }
}

function defaultAssignmentForm(date: string, previous?: AssignmentFormState): AssignmentFormState {
  return {
    blockId: previous?.blockId ?? '',
    eventName: '',
    cycleGoal: '',
    startDate: date,
    endDate: date,
    weekNum: previous?.weekNum ?? '1',
    dayNum: weekdayFromIso(date),
    trainingCategory: previous?.trainingCategory ?? TRAINING_CATEGORIES[0],
    notes: '',
  }
}

function defaultEventForm(date: string, previous?: EventFormState): EventFormState {
  return {
    title: '',
    eventType: previous?.eventType ?? GENERAL_EVENT_TYPES[0],
    startDate: date,
    endDate: date,
    notes: '',
  }
}

function getInitialSportId(taxonomy: CoachScheduleManagerProps['taxonomy']) {
  return taxonomy.sports[0] ? String(taxonomy.sports[0].id) : UNCATEGORIZED_SELECTOR
}

function getInitialAgeGroupId(taxonomy: CoachScheduleManagerProps['taxonomy'], sportId: string) {
  return taxonomy.ageGroups.find((ageGroup) => String(ageGroup.sport_id) === sportId)?.id
}

function getInitialTrainingCategoryId(taxonomy: CoachScheduleManagerProps['taxonomy'], ageGroupId?: number) {
  if (!ageGroupId) return undefined
  return taxonomy.trainingCategories.find((category) => category.age_group_id === ageGroupId)?.id
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

  return payload as T
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="rounded-[1rem] bg-white px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}

function DeleteActionButton({
  label,
  pendingLabel,
  confirmMessage,
  onDelete,
  onError,
  className = 'lab-btn-secondary !min-h-10 px-4 py-2 text-sm',
}: {
  label: string
  pendingLabel: string
  confirmMessage: string
  onDelete: () => Promise<void>
  onError: (message: string) => void
  className?: string
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) return

    setIsDeleting(true)
    onError('')
    try {
      await onDelete()
    } catch (requestError) {
      onError(apiErrorMessage(requestError, '刪除失敗。'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button type="button" className={className} disabled={isDeleting} onClick={() => void handleDelete()}>
      {isDeleting ? pendingLabel : label}
    </button>
  )
}

function makeLocalId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildEditableSections(assignment: AssignmentDetail): EditableSection[] {
  if (assignment.sections.length === 0) {
    return [{ name: '未命名區段', rows: [] }]
  }

  return assignment.sections.map((section) => ({
    name: section.name || '未命名區段',
    rows: section.rows.map((row) => ({
      localId: makeLocalId(),
      persisted: row.can_report,
      sourceId: row.id,
      exercise_name: row.exercise_name,
      sets: row.sets,
      reps_or_time: row.reps_or_time,
      equipment: row.equipment,
      intensity: row.intensity,
      weight: row.weight,
      rest: row.rest,
      video_url: row.video_url,
      notes: row.notes,
    })),
  }))
}

function ExerciseReadTable({ rows }: { rows: AssignmentDetail['sections'][number]['rows'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left">
            <th className="rounded-tl-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">動作名稱</th>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">組數</th>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">次數 / 時間</th>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">強度</th>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">重量</th>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">休息</th>
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">工具</th>
            <th className="rounded-tr-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">影片</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.id || row.exercise_name}-${index}`} className={row.actual_sets || row.actual_weight ? 'bg-emerald-50/70' : 'bg-white'}>
              <td className="border border-slate-200 px-4 py-3 font-medium text-slate-900">{row.exercise_name || '-'}</td>
              <td className={`border border-slate-200 px-4 py-3 ${row.actual_sets ? 'bg-emerald-50/70' : 'text-slate-600'}`}>
                <div className="text-slate-700">{row.sets || '-'}</div>
                {row.actual_sets ? (
                  <div className="mt-1 text-xs font-semibold text-emerald-700">
                    回報：{row.actual_sets}
                    {row.actual_sets !== row.sets ? <span className="ml-2 text-sky-700">與安排不同</span> : null}
                  </div>
                ) : null}
              </td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.reps_or_time || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.intensity || '-'}</td>
              <td className={`border border-slate-200 px-4 py-3 ${row.actual_weight ? 'bg-emerald-50/70' : 'text-slate-600'}`}>
                <div className="text-slate-700">{row.weight || '-'}</div>
                {row.actual_weight ? (
                  <div className="mt-1 text-xs font-semibold text-emerald-700">
                    回報：{row.actual_weight}
                    {row.actual_weight !== row.weight ? <span className="ml-2 text-sky-700">與安排不同</span> : null}
                  </div>
                ) : null}
              </td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.rest || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.equipment || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">
                {row.video_url ? (
                  <a href={row.video_url} target="_blank" rel="noreferrer" className="lab-badge-info">
                    影片連結
                  </a>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AssignmentCard({ assignment, onUpdated, athleteId }: { assignment: AssignmentDetail; athleteId: number; onUpdated: (schedule: AthleteScheduleBundle, message?: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editableSections, setEditableSections] = useState<EditableSection[]>(() => buildEditableSections(assignment))
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const resolvedBlockName =
    (assignment.block_label ? blockNameFromLabel(assignment.block_label) : '') ||
    assignment.block_name ||
    '未命名板塊'
  const resolvedBlockLabel =
    assignment.block_code && resolvedBlockName !== '未命名板塊'
      ? `${assignment.block_code} | ${resolvedBlockName}`
      : assignment.block_label || resolvedBlockName

  function resetAssignmentContentForm() {
    setEditableSections(buildEditableSections(assignment))
  }

  function updateExercise(sectionIndex: number, rowLocalId: string, field: keyof Omit<EditableExercise, 'localId' | 'persisted' | 'sourceId'>, value: string) {
    setEditableSections((current) =>
      current.map((section, currentSectionIndex) =>
        currentSectionIndex !== sectionIndex
          ? section
          : {
              ...section,
              rows: section.rows.map((row) => (row.localId === rowLocalId ? { ...row, [field]: value } : row)),
            },
      ),
    )
  }

  function addExercise(sectionIndex: number) {
    setEditableSections((current) =>
      current.map((section, currentSectionIndex) =>
        currentSectionIndex !== sectionIndex
          ? section
          : {
              ...section,
              rows: [
                ...section.rows,
                {
                  localId: makeLocalId(),
                  persisted: false,
                  sourceId: '',
                  exercise_name: '',
                  sets: '',
                  reps_or_time: '',
                  equipment: '',
                  intensity: '',
                  weight: '',
                  rest: '',
                  video_url: '',
                  notes: '',
                },
              ],
            },
      ),
    )
  }

  function removeExercise(sectionIndex: number, rowLocalId: string) {
    setEditableSections((current) =>
      current.map((section, currentSectionIndex) =>
        currentSectionIndex !== sectionIndex
          ? section
          : {
              ...section,
              rows: section.rows.filter((row) => row.localId !== rowLocalId),
            },
      ),
    )
  }

  function cancelContentEditing() {
    resetAssignmentContentForm()
    setIsEditingContent(false)
    setError(null)
  }

  function toggleSection(sectionKey: string) {
    setExpandedSections((current) =>
      current.includes(sectionKey) ? current.filter((entry) => entry !== sectionKey) : [...current, sectionKey],
    )
  }

  async function handleDelete() {
    const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/assignments/${assignment.record_id}`, {
      method: 'DELETE',
    })
    onUpdated(payload.schedule, payload.message)
  }

  async function handleSaveContent() {
    setIsSavingContent(true)
    setError(null)

    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(
        `/api/coach/athletes/${athleteId}/assignments/${assignment.record_id}/content`,
        {
          method: 'PUT',
          body: JSON.stringify({
            sections: editableSections.map((section) => ({
              name: section.name,
              rows: section.rows.map((row) => ({
                id: row.persisted && row.sourceId ? Number(row.sourceId) : null,
                persisted: row.persisted,
                exercise_name: row.exercise_name,
                sets: row.sets,
                reps_or_time: row.reps_or_time,
                equipment: row.equipment,
                intensity: row.intensity,
                weight: row.weight,
                rest: row.rest,
                video_url: row.video_url,
                notes: row.notes,
              })),
            })),
          }),
        },
      )
      onUpdated(payload.schedule, payload.message)
      setIsEditingContent(false)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '更新這次安排的課表內容失敗。'))
    } finally {
      setIsSavingContent(false)
    }
  }

  return (
    <article className="lab-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setIsExpanded((value) => !value)}
        >
          <p className="lab-eyebrow">Assignment</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-2xl font-bold text-slate-900">{resolvedBlockName}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="lab-badge bg-slate-100 text-slate-700">{assignment.week_label}</span>
                <span className="lab-badge bg-slate-100 text-slate-700">事件：{assignment.event_display_name || '-'}</span>
                <span className="lab-badge bg-sky-100 text-sky-700">{assignment.category_label}</span>
                <span className="lab-badge bg-amber-100 text-amber-800">{assignment.block_code || '未設定代號'}</span>
                <span className="lab-badge bg-slate-100 text-slate-700">{assignment.date_range || '-'}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">板塊：{resolvedBlockLabel}</p>
            </div>
            <span className="pt-1 text-lg font-semibold text-slate-400">{isExpanded ? '▾' : '▸'}</span>
          </div>
        </button>
        <div className="flex flex-wrap gap-2">
          <span className="lab-badge-primary">課表安排</span>
          <button
            type="button"
            className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
            onClick={() => {
              if (!isEditingContent) resetAssignmentContentForm()
              setIsEditingContent((value) => !value)
            }}
          >
            {isEditingContent ? '收起課表內容編輯' : '編輯課表內容'}
          </button>
          <DeleteActionButton
            label="刪除安排"
            pendingLabel="刪除中..."
            confirmMessage="確認要刪除這筆課表安排嗎？這只會刪除這位學員這次安排與對應 snapshot，不會刪到原始板塊模板。"
            onDelete={handleDelete}
            onError={(message) => setError(message || null)}
          />
        </div>
      </div>

      {isExpanded ? (
        <>
          <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
            <DetailMeta label="Week" value={assignment.week_label} />
            <DetailMeta label="事件" value={assignment.event_display_name} />
            <DetailMeta label="分類" value={assignment.category_label} />
            <DetailMeta label="代號" value={assignment.block_code || '未設定'} />
            <DetailMeta label="日期" value={assignment.date_range} />
            <DetailMeta label="週期目標" value={assignment.cycle_goal} />
            <DetailMeta label="訓練元素" value={assignment.training_element} />
          </dl>

          {(assignment.goal || assignment.description || assignment.coach_notes) ? (
            <div className="mt-5 space-y-3">
              {assignment.goal ? <div className="rounded-[1rem] bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900"><strong>目標：</strong>{assignment.goal}</div> : null}
              {assignment.description ? <div className="rounded-[1rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700"><strong>描述：</strong>{assignment.description}</div> : null}
              {assignment.coach_notes ? <div className="rounded-[1rem] bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900"><strong>教練備註：</strong>{assignment.coach_notes}</div> : null}
            </div>
          ) : null}

          {isEditingContent ? (
            <div className="mt-6 space-y-6">
              {editableSections.map((section, sectionIndex) => (
                <section key={`${assignment.id}-edit-${section.name}-${sectionIndex}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-lg font-bold text-slate-900">{section.name}</h4>
                    <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => addExercise(sectionIndex)}>
                      新增動作
                    </button>
                  </div>

                  {section.rows.length === 0 ? (
                    <div className="mt-3 rounded-[1rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                      這個區段目前沒有動作，請點「新增動作」加入。
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {section.rows.map((row) => (
                        <article key={row.localId} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h5 className="text-base font-bold text-slate-900">{row.exercise_name || '未命名動作'}</h5>
                              <p className="mt-1 text-sm text-slate-500">這裡只會修改這一次 assignment 的個人化課表內容。</p>
                            </div>
                            <button
                              type="button"
                              className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm text-rose-700"
                              onClick={() => removeExercise(sectionIndex, row.localId)}
                            >
                              刪除動作
                            </button>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2 xl:col-span-2">
                              <label className="text-sm font-semibold text-slate-700">動作名稱</label>
                              <input className="lab-input" value={row.exercise_name} onChange={(event) => updateExercise(sectionIndex, row.localId, 'exercise_name', event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">組數</label>
                              <input className="lab-input" value={row.sets} onChange={(event) => updateExercise(sectionIndex, row.localId, 'sets', event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">次數 / 時間</label>
                              <input className="lab-input" value={row.reps_or_time} onChange={(event) => updateExercise(sectionIndex, row.localId, 'reps_or_time', event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">工具</label>
                              <input className="lab-input" value={row.equipment} onChange={(event) => updateExercise(sectionIndex, row.localId, 'equipment', event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">強度</label>
                              <input className="lab-input" value={row.intensity} onChange={(event) => updateExercise(sectionIndex, row.localId, 'intensity', event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">重量</label>
                              <input className="lab-input" value={row.weight} onChange={(event) => updateExercise(sectionIndex, row.localId, 'weight', event.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-slate-700">休息時間</label>
                              <input className="lab-input" value={row.rest} onChange={(event) => updateExercise(sectionIndex, row.localId, 'rest', event.target.value)} />
                            </div>
                            <div className="space-y-2 xl:col-span-2">
                              <label className="text-sm font-semibold text-slate-700">影片</label>
                              <input className="lab-input" value={row.video_url} onChange={(event) => updateExercise(sectionIndex, row.localId, 'video_url', event.target.value)} />
                            </div>
                            <div className="space-y-2 xl:col-span-2">
                              <label className="text-sm font-semibold text-slate-700">備註</label>
                              <textarea className="lab-input min-h-24" value={row.notes} onChange={(event) => updateExercise(sectionIndex, row.localId, 'notes', event.target.value)} />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}

              <div className="flex flex-wrap gap-3">
                <button type="button" className="lab-btn-primary" disabled={isSavingContent} onClick={() => void handleSaveContent()}>
                  {isSavingContent ? '儲存中...' : '儲存課表內容'}
                </button>
                <button type="button" className="lab-btn-secondary" disabled={isSavingContent} onClick={cancelContentEditing}>
                  取消編輯
                </button>
              </div>
            </div>
          ) : assignment.sections.length > 0 ? (
            <div className="mt-6 space-y-4">
              {assignment.sections.map((section, index) => {
                const sectionKey = `${assignment.id}-${index}-${section.name}`
                const isExpanded = expandedSections.includes(sectionKey)

                return (
                  <section key={sectionKey} className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                      onClick={() => toggleSection(sectionKey)}
                    >
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{section.name}</h4>
                        <p className="mt-1 text-sm text-slate-500">{section.rows.length} 個動作</p>
                      </div>
                      <span className="text-lg font-semibold text-slate-400">{isExpanded ? '▾' : '▸'}</span>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                        <ExerciseReadTable rows={section.rows} />
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </article>
  )
}

function DailyAssignmentSummaryCard({
  assignment,
  onViewDetail,
  athleteId,
  onUpdated,
}: {
  assignment: AssignmentDetail
  onViewDetail: (assignmentId: string) => void
  athleteId: number
  onUpdated: (schedule: AthleteScheduleBundle, message?: string) => void
}) {
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/assignments/${assignment.record_id}`, {
      method: 'DELETE',
    })
    onUpdated(payload.schedule, payload.message)
  }

  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">事件：{assignment.event_display_name || '未命名安排'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="lab-badge bg-slate-100 text-slate-700">Week：{assignment.week_label.replace(/^Week\s*/i, '') || '-'}</span>
            <span className="lab-badge bg-sky-100 text-sky-700">分類：{assignment.category_label || '未分類'}</span>
            <span className="lab-badge bg-amber-100 text-amber-800">代號：{assignment.block_code || '無代號'}</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">板塊：{blockNameFromLabel(assignment.block_label)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
            onClick={() => onViewDetail(assignment.id)}
          >
            查看 / 編輯課表內容
          </button>
          <DeleteActionButton
            label="刪除安排"
            pendingLabel="刪除中..."
            confirmMessage="確認要刪除這筆課表安排嗎？這只會刪除這位學員這次安排與對應 snapshot，不會刪到原始板塊模板。"
            onDelete={handleDelete}
            onError={(message) => setError(message || null)}
          />
        </div>
      </div>
      {error ? <p className="mt-4 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </article>
  )
}

function DailyEventSummaryCard({
  event,
  athleteId,
  onUpdated,
}: {
  event: GeneralEventDetail
  athleteId: number
  onUpdated: (schedule: AthleteScheduleBundle, message?: string) => void
}) {
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/events/${event.record_id}`, {
      method: 'DELETE',
    })
    onUpdated(payload.schedule, payload.message)
  }

  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{event.event_name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="lab-badge-success">{event.event_type || '一般事件'}</span>
            <span className="lab-badge bg-slate-100 text-slate-700">{event.date_range}</span>
          </div>
          {event.description ? <p className="mt-3 text-sm text-slate-600">備註：{event.description}</p> : null}
        </div>
        <DeleteActionButton
          label="刪除事件"
          pendingLabel="刪除中..."
          confirmMessage="確認要刪除這筆一般事件嗎？"
          onDelete={handleDelete}
          onError={(message) => setError(message || null)}
        />
      </div>
      {error ? <p className="mt-4 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </article>
  )
}

function EventCard({ event, onUpdated, athleteId }: { event: GeneralEventDetail; athleteId: number; onUpdated: (schedule: AthleteScheduleBundle, message?: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(event.event_name)
  const [eventType, setEventType] = useState(event.event_type || GENERAL_EVENT_TYPES[0])
  const [startDate, setStartDate] = useState(event.start_date || todayIso())
  const [endDate, setEndDate] = useState(event.end_date || event.start_date || todayIso())
  const [notes, setNotes] = useState(event.description)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/events/${event.record_id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, event_type: eventType, start_date: startDate, end_date: endDate, notes }),
      })
      onUpdated(payload.schedule, payload.message)
      setIsEditing(false)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '更新一般事件失敗。'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/events/${event.record_id}`, { method: 'DELETE' })
    onUpdated(payload.schedule, payload.message)
  }

  return (
    <article className="lab-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="lab-eyebrow">General Event</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{event.event_name}</h3>
          <p className="mt-2 text-sm text-slate-500">{event.meta}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="lab-badge-success">一般事件</span>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setIsEditing((value) => !value)}>{isEditing ? '收起編輯' : '編輯事件'}</button>
          <DeleteActionButton
            label="刪除事件"
            pendingLabel="刪除中..."
            confirmMessage="確認要刪除這筆一般事件嗎？"
            onDelete={handleDelete}
            onError={(message) => setError(message || null)}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <DetailMeta label="日期" value={event.date_range} />
        <DetailMeta label="說明" value={event.description} />
      </div>

      {isEditing ? (
        <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">編輯一般事件</p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-semibold text-slate-700">事件名稱</label>
              <input className="lab-input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">事件類型</label>
              <select className="lab-input" value={eventType} onChange={(event) => setEventType(event.target.value)}>
                {GENERAL_EVENT_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div />
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">開始日期</label>
              <input type="date" className="lab-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">結束日期</label>
              <input type="date" className="lab-input" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-semibold text-slate-700">備註</label>
              <textarea className="lab-input min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary" disabled={isSaving} onClick={() => void handleSave()}>{isSaving ? '儲存中...' : '儲存事件'}</button>
            <button type="button" className="lab-btn-secondary" onClick={() => setIsEditing(false)}>取消</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </article>
  )
}

export function CoachScheduleManager({ athleteId, initialSchedule, blocks, taxonomy }: CoachScheduleManagerProps) {
  const initialDate = todayIso()
  const initialSportId = getInitialSportId(taxonomy)
  const initialAgeGroupId = getInitialAgeGroupId(taxonomy, initialSportId)
  const initialTrainingCategoryId = getInitialTrainingCategoryId(taxonomy, initialAgeGroupId)
  const initialVisibleBlocks =
    initialSportId === UNCATEGORIZED_SELECTOR
      ? blocks.filter((block) => block.training_category_id == null)
      : blocks.filter((block) => block.training_category_id === initialTrainingCategoryId)
  const [schedule, setSchedule] = useState(initialSchedule)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [isDayModalOpen, setIsDayModalOpen] = useState(false)
  const detailSectionRef = useRef<HTMLElement | null>(null)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [visibleMonth, setVisibleMonth] = useState(initialDate.slice(0, 7))
  const weekMarkerStorageKey = `lab33-athlete-week-markers-${athleteId}`
  const [weekMarkers, setWeekMarkers] = useState<WeekMarker[]>(() => loadWeekMarkers(weekMarkerStorageKey))
  const [weekRangeStartDate, setWeekRangeStartDate] = useState(initialDate)
  const [weekRangeEndDate, setWeekRangeEndDate] = useState(initialDate)
  const [weekRangeNumber, setWeekRangeNumber] = useState('1')
  const [weekRangeNote, setWeekRangeNote] = useState('')
  const [weekRangeColorKey, setWeekRangeColorKey] = useState(DEFAULT_WEEK_MARKER_COLOR_KEY)
  const [selectedSportId, setSelectedSportId] = useState<string>(initialSportId)
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>(initialAgeGroupId ? String(initialAgeGroupId) : '')
  const [selectedTrainingCategoryId, setSelectedTrainingCategoryId] = useState<string>(initialTrainingCategoryId ? String(initialTrainingCategoryId) : '')
  const [blockSearch, setBlockSearch] = useState('')
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(() =>
    ({
      ...defaultAssignmentForm(initialDate),
      blockId: String(initialVisibleBlocks[0]?.id ?? ''),
      weekNum: resolveWeekMarker(initialDate, loadWeekMarkers(weekMarkerStorageKey))?.weekNum ?? '1',
      trainingCategory:
        taxonomy.trainingCategories.find((category) => category.id === initialTrainingCategoryId)?.name ??
        TRAINING_CATEGORIES[0],
    }),
  )
  const [eventForm, setEventForm] = useState<EventFormState>(() => defaultEventForm(initialDate))

  const isUncategorizedSelection = selectedSportId === UNCATEGORIZED_SELECTOR

  const availableAgeGroups = useMemo(
    () =>
      isUncategorizedSelection
        ? []
        : taxonomy.ageGroups.filter((ageGroup) => String(ageGroup.sport_id) === selectedSportId),
    [isUncategorizedSelection, selectedSportId, taxonomy.ageGroups],
  )

  const effectiveSelectedAgeGroupId = useMemo(() => {
    if (isUncategorizedSelection) return ''
    if (availableAgeGroups.some((ageGroup) => String(ageGroup.id) === selectedAgeGroupId)) return selectedAgeGroupId
    return availableAgeGroups[0] ? String(availableAgeGroups[0].id) : ''
  }, [availableAgeGroups, isUncategorizedSelection, selectedAgeGroupId])

  const availableTrainingCategories = useMemo(
    () =>
      effectiveSelectedAgeGroupId
        ? taxonomy.trainingCategories.filter((category) => String(category.age_group_id) === effectiveSelectedAgeGroupId)
        : [],
    [effectiveSelectedAgeGroupId, taxonomy.trainingCategories],
  )

  const effectiveSelectedTrainingCategoryId = useMemo(() => {
    if (availableTrainingCategories.some((category) => String(category.id) === selectedTrainingCategoryId)) return selectedTrainingCategoryId
    return availableTrainingCategories[0] ? String(availableTrainingCategories[0].id) : ''
  }, [availableTrainingCategories, selectedTrainingCategoryId])

  const filteredBlocksByCategory = useMemo(() => {
    if (isUncategorizedSelection) {
      return blocks.filter((block) => block.training_category_id == null)
    }

    if (!effectiveSelectedTrainingCategoryId) return []
    return blocks.filter((block) => String(block.training_category_id ?? '') === effectiveSelectedTrainingCategoryId)
  }, [blocks, effectiveSelectedTrainingCategoryId, isUncategorizedSelection])

  const visibleBlocks = useMemo(() => {
    const keyword = blockSearch.trim().toLocaleLowerCase('en-US')
    if (!keyword) return filteredBlocksByCategory

    return filteredBlocksByCategory.filter((block) =>
      [block.block_code, block.block_name, block.training_element, block.goal]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('en-US').includes(keyword)),
    )
  }, [blockSearch, filteredBlocksByCategory])

  const effectiveBlockId = useMemo(() => {
    if (visibleBlocks.some((block) => String(block.id) === assignmentForm.blockId)) return assignmentForm.blockId
    return visibleBlocks[0] ? String(visibleBlocks[0].id) : ''
  }, [assignmentForm.blockId, visibleBlocks])

  const calendarItems = useMemo<ScheduleItem[]>(() => {
    const assignments = schedule.assignments.map((assignment) => ({
      kind: 'assignment' as const,
      id: assignment.id,
      recordId: assignment.record_id,
      startDate: assignment.start_date || assignment.date_range.split(' ~ ')[0] || todayIso(),
      endDate: assignment.end_date || assignment.start_date || assignment.date_range.split(' ~ ').slice(-1)[0] || todayIso(),
      title: assignment.event_display_name,
      meta: assignment.meta,
      previewTop: `${compactWeekLabel(assignment.week_label)}・${truncateText(assignment.event_display_name || '未命名安排', 8)}`,
      previewBottom: `${truncateText(assignment.category_label || '未分類', 6)}・${truncateText(assignment.block_code || '無代號', 10)}`,
    }))
    const events = schedule.generalEvents.map((event) => ({
      kind: 'event' as const,
      id: event.id,
      recordId: event.record_id,
      startDate: event.start_date || todayIso(),
      endDate: event.end_date || event.start_date || todayIso(),
      title: event.event_name,
      meta: event.meta,
      previewTop: truncateText(event.event_name, 14),
    }))
    return [...assignments, ...events].sort((left, right) => {
      if (left.startDate !== right.startDate) return left.startDate.localeCompare(right.startDate)
      return left.recordId - right.recordId
    })
  }, [schedule])

  const selectedDateAssignments = useMemo(
    () => schedule.assignments.filter((assignment) => rangeIncludes(selectedDate, assignment.start_date || selectedDate, assignment.end_date || assignment.start_date || selectedDate)),
    [schedule.assignments, selectedDate],
  )
  const selectedDateEvents = useMemo(
    () => schedule.generalEvents.filter((event) => rangeIncludes(selectedDate, event.start_date || selectedDate, event.end_date || event.start_date || selectedDate)),
    [schedule.generalEvents, selectedDate],
  )

  const selectedDateWeekMarker = useMemo(() => resolveWeekMarker(selectedDate, weekMarkers), [selectedDate, weekMarkers])

  const monthDays = useMemo(() => {
    const base = firstDayOfMonth(visibleMonth)
    const year = base.getFullYear()
    const month = base.getMonth()
    const firstWeekday = (base.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: Array<{ date: string; day: number; inCurrentMonth: boolean; items: ScheduleItem[]; weekMarker: WeekMarker | null }> = []

    for (let index = 0; index < firstWeekday; index += 1) {
      const date = new Date(year, month, index - firstWeekday + 1)
      const iso = `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`
      cells.push({
        date: iso,
        day: date.getDate(),
        inCurrentMonth: false,
        items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)),
        weekMarker: resolveWeekMarker(iso, weekMarkers),
      })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${visibleMonth}-${padMonth(day)}`
      cells.push({
        date: iso,
        day,
        inCurrentMonth: true,
        items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)),
        weekMarker: resolveWeekMarker(iso, weekMarkers),
      })
    }

    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1]
      const date = new Date(`${last.date}T00:00:00`)
      date.setDate(date.getDate() + 1)
      const iso = `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`
      cells.push({
        date: iso,
        day: date.getDate(),
        inCurrentMonth: false,
        items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)),
        weekMarker: resolveWeekMarker(iso, weekMarkers),
      })
    }

    return cells
  }, [calendarItems, visibleMonth, weekMarkers])

  useEffect(() => {
    window.localStorage.setItem(weekMarkerStorageKey, JSON.stringify(weekMarkers))
  }, [weekMarkerStorageKey, weekMarkers])

  useEffect(() => {
    if (!isDayModalOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDayModalOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isDayModalOpen])

  function applySchedule(nextSchedule: AthleteScheduleBundle, nextMessage?: string) {
    setSchedule(nextSchedule)
    setMessage(nextMessage ?? null)
    setError(null)
  }

  function selectDate(date: string, shouldOpenModal: boolean) {
    const marker = resolveWeekMarker(date, weekMarkers)
    setSelectedDate(date)
    setAssignmentForm((current) => ({
      ...current,
      startDate: date,
      endDate: date,
      dayNum: weekdayFromIso(date),
      weekNum: marker?.weekNum ?? current.weekNum,
    }))
    setEventForm((current) => ({ ...current, startDate: date, endDate: date }))
    setIsDayModalOpen(shouldOpenModal)
  }

  function handleApplyWeekMarker() {
    const normalized = normalizeRange(weekRangeStartDate, weekRangeEndDate)
    if (!normalized.startDate || !normalized.endDate || !weekRangeNumber.trim()) {
      setError('請先完整選擇週期開始日期、結束日期與 Week 編號。')
      return
    }

    const nextMarker: WeekMarker = {
      id: `marker-${Date.now()}`,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      weekNum: weekRangeNumber.trim(),
      note: weekRangeNote.trim(),
      colorKey: weekRangeColorKey || DEFAULT_WEEK_MARKER_COLOR_KEY,
    }

    setWeekMarkers((current) => [...current, nextMarker])
    setMessage(`已套用 Week ${nextMarker.weekNum}：${normalized.startDate} ～ ${normalized.endDate}`)
    setError(null)

    if (rangeIncludes(selectedDate, normalized.startDate, normalized.endDate)) {
      setAssignmentForm((current) => ({ ...current, weekNum: nextMarker.weekNum }))
    }
  }

  function handleDeleteWeekMarker(markerId: string) {
    const targetMarker = weekMarkers.find((marker) => marker.id === markerId)
    if (!targetMarker) return

    const confirmed = window.confirm(`確認要刪除 Week ${targetMarker.weekNum}（${targetMarker.startDate} ～ ${targetMarker.endDate}）嗎？`)
    if (!confirmed) return

    setWeekMarkers((current) => current.filter((marker) => marker.id !== markerId))
    setMessage(`已刪除 Week ${targetMarker.weekNum}：${targetMarker.startDate} ～ ${targetMarker.endDate}`)
    setError(null)

    const nextSelectedDateMarker = resolveWeekMarker(
      selectedDate,
      weekMarkers.filter((marker) => marker.id !== markerId),
    )

    if (!nextSelectedDateMarker) {
      setAssignmentForm((current) => ({
        ...current,
        weekNum: current.startDate === selectedDate ? '1' : current.weekNum,
      }))
    }
  }

  function jumpToDetail(assignmentId: string) {
    setIsDayModalOpen(false)
    window.requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const target = document.getElementById(`assignment-detail-${assignmentId}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function handleCreateAssignment() {
    setIsCreatingAssignment(true)
    setError(null)
    try {
      const selectedCategoryName =
        availableTrainingCategories.find((category) => String(category.id) === effectiveSelectedTrainingCategoryId)?.name ??
        (isUncategorizedSelection ? '未分類' : assignmentForm.trainingCategory)

      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          block_id: Number(effectiveBlockId),
          event_name: assignmentForm.eventName,
          cycle_goal: assignmentForm.cycleGoal,
          start_date: assignmentForm.startDate,
          end_date: assignmentForm.endDate,
          week_num: Number(assignmentForm.weekNum || '1'),
          day_num: Number(assignmentForm.dayNum || '1'),
          training_category: selectedCategoryName,
          notes: assignmentForm.notes,
        }),
      })
      applySchedule(payload.schedule, payload.message)
      setSelectedDate(assignmentForm.startDate)
      setVisibleMonth(assignmentForm.startDate.slice(0, 7))
      setAssignmentForm((current) => ({
        ...defaultAssignmentForm(assignmentForm.startDate, current),
        blockId: effectiveBlockId || String(visibleBlocks[0]?.id ?? ''),
        trainingCategory: selectedCategoryName,
      }))
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '新增課表安排失敗。'))
    } finally {
      setIsCreatingAssignment(false)
    }
  }

  async function handleCreateEvent() {
    setIsCreatingEvent(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          title: eventForm.title,
          event_type: eventForm.eventType,
          start_date: eventForm.startDate,
          end_date: eventForm.endDate,
          notes: eventForm.notes,
        }),
      })
      applySchedule(payload.schedule, payload.message)
      setSelectedDate(eventForm.startDate)
      setVisibleMonth(eventForm.startDate.slice(0, 7))
      setEventForm((current) => defaultEventForm(eventForm.startDate, current))
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '新增一般事件失敗。'))
    } finally {
      setIsCreatingEvent(false)
    }
  }

  return (
    <div className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <p className="lab-eyebrow">Calendar Planner</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="lab-section-title">課表行事曆</h2>
            <p className="lab-copy mt-3">先用月曆挑一天，再安排課表或新增一般事件。這裡可建立 / 刪除安排，並直接編輯這次 assignment 的課表內容。</p>
          </div>
          <span className="lab-badge-primary">已選日期：{selectedDate}</span>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="mb-5 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">行事曆週期標示</p>
                <p className="text-sm text-slate-500">先設定日期區間，再標示這段時間屬於哪個 Week。這次實作採用此頁面的本地儲存，不會修改資料庫。</p>
                <p className="text-sm font-medium text-slate-700">
                  已選週期範圍：{normalizeRange(weekRangeStartDate, weekRangeEndDate).startDate} ～ {normalizeRange(weekRangeStartDate, weekRangeEndDate).endDate}
                </p>
              </div>
              {selectedDateWeekMarker ? (
                <div className={`rounded-full px-4 py-2 text-sm font-semibold ${getWeekMarkerColor(selectedDateWeekMarker.colorKey).chipClass}`}>
                  {selectedDate} 屬於 Week {selectedDateWeekMarker.weekNum}{selectedDateWeekMarker.note ? `・${selectedDateWeekMarker.note}` : ''}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1 space-y-2 lg:max-w-[220px]">
                <label className="text-sm font-semibold text-slate-700">開始日期</label>
                <input type="date" className="lab-input" value={weekRangeStartDate} onChange={(event) => setWeekRangeStartDate(event.target.value)} />
              </div>
              <div className="min-w-[180px] flex-1 space-y-2 lg:max-w-[220px]">
                <label className="text-sm font-semibold text-slate-700">結束日期</label>
                <input type="date" className="lab-input" value={weekRangeEndDate} onChange={(event) => setWeekRangeEndDate(event.target.value)} />
              </div>
              <div className="w-[132px] space-y-2">
                <label className="text-sm font-semibold text-slate-700">Week</label>
                <input type="number" min="1" className="lab-input" value={weekRangeNumber} onChange={(event) => setWeekRangeNumber(event.target.value)} />
              </div>
              <div className="min-w-[220px] flex-[1.15] space-y-2">
                <label className="text-sm font-semibold text-slate-700">備註</label>
                <input className="lab-input" value={weekRangeNote} onChange={(event) => setWeekRangeNote(event.target.value)} placeholder="例如：第一週、恢復週" />
              </div>
              <button type="button" className="lab-btn-primary w-full sm:w-auto" onClick={handleApplyWeekMarker}>
                套用週期
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-700">週期顏色</p>
              <div className="flex flex-wrap gap-2">
                {WEEK_MARKER_COLORS.map((option) => {
                  const isSelected = option.key === weekRangeColorKey
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setWeekRangeColorKey(option.key)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                      aria-pressed={isSelected}
                    >
                      <span className={`h-3 w-3 rounded-full ${option.swatchClass}`} />
                      <span>{option.name}</span>
                      <span className="text-xs">{isSelected ? '✓' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {weekMarkers.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {weekMarkers.map((marker) => (
                  <div key={marker.id} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${getWeekMarkerColor(marker.colorKey).chipClass}`}>
                    <span>
                      Week {marker.weekNum}｜{marker.startDate} ～ {marker.endDate}{marker.note ? `｜${marker.note}` : ''}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-current/20 bg-white/50 px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white/80"
                      onClick={() => handleDeleteWeekMarker(marker.id)}
                    >
                      刪除週期
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setVisibleMonth((current) => shiftMonth(current, -1))}>上個月</button>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{formatMonthLabel(visibleMonth)}</h3>
              <p className="mt-1 text-xs text-slate-500">點一天即可預填下方的課表安排與一般事件表單</p>
            </div>
            <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setVisibleMonth((current) => shiftMonth(current, 1))}>下個月</button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid gap-px rounded-t-[1.25rem] bg-slate-200" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
                  <div
                    key={day}
                    className={`bg-white px-3 py-3 text-center text-xs font-semibold tracking-[0.16em] ${index >= 5 ? 'text-orange-500' : 'text-slate-500'}`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid gap-px rounded-b-[1.25rem] bg-slate-200" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                {monthDays.map((cell, cellIndex) => {
                  const assignmentCount = cell.items.filter((item) => item.kind === 'assignment').length
                  const eventCount = cell.items.filter((item) => item.kind === 'event').length
                  const isSelected = cell.date === selectedDate
                  const isToday = cell.date === todayIso()
                  const previewItems = cell.items.slice(0, 2)
                  const weekMarker = cell.weekMarker
                  const previousCell = cellIndex % 7 === 0 ? null : monthDays[cellIndex - 1]
                  const nextCell = cellIndex % 7 === 6 ? null : monthDays[cellIndex + 1]
                  const isWeekSegmentStart = weekMarker ? previousCell?.weekMarker?.id !== weekMarker.id : false
                  const isWeekSegmentEnd = weekMarker ? nextCell?.weekMarker?.id !== weekMarker.id : false
                  const weekColor = getWeekMarkerColor(weekMarker?.colorKey)

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => selectDate(cell.date, cell.items.length > 2)}
                      className={`relative flex min-h-[132px] w-full min-w-0 flex-col bg-white p-3 text-left transition hover:z-10 hover:bg-slate-50 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${isSelected ? 'z-10 bg-orange-50 ring-2 ring-inset ring-orange-400' : ''} ${cell.inCurrentMonth ? 'text-slate-900' : 'text-slate-300'}`}
                    >
                      {weekMarker ? (
                        <div
                          className={`pointer-events-none absolute left-1 right-1 top-12 h-7 ${weekColor.bandClass} ${isWeekSegmentStart ? 'rounded-l-xl pl-1' : 'rounded-l-md'} ${isWeekSegmentEnd ? 'rounded-r-xl pr-1' : 'rounded-r-md'}`}
                        />
                      ) : null}

                      <div className="flex items-start justify-between gap-2">
                        <div className="relative z-10 space-y-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-orange-500 text-white' : isToday ? 'bg-slate-900 text-white' : cell.inCurrentMonth ? 'bg-slate-100 text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
                            {cell.day}
                          </div>
                          {weekMarker ? (
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${weekColor.badgeClass}`}>
                              W{weekMarker.weekNum}
                            </span>
                          ) : null}
                        </div>
                        {(assignmentCount > 0 || eventCount > 0) ? (
                          <div className="flex flex-col items-end gap-1 text-[10px] font-semibold">
                            {assignmentCount > 0 ? <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">課表 {assignmentCount}</span> : null}
                            {eventCount > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">事件 {eventCount}</span> : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="relative z-10 mt-3 space-y-2">
                        {previewItems.map((item) => (
                          <div
                            key={`${cell.date}-${item.kind}-${item.id}`}
                            className={`rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-4 ${item.kind === 'assignment' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'} ${cell.inCurrentMonth ? '' : 'opacity-70'}`}
                            title={`${item.title}｜${item.meta}`}
                          >
                            <div className="truncate">{item.previewTop}</div>
                            {item.previewBottom ? <div className="mt-0.5 truncate">{item.previewBottom}</div> : null}
                          </div>
                        ))}
                        {cell.items.length > 2 ? (
                          <div className="text-[11px] font-semibold text-slate-500">+{cell.items.length - 2} 筆</div>
                        ) : null}
                        {cell.items.length === 0 ? <div className="pt-4 text-[11px] text-slate-300">&nbsp;</div> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </article>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="lab-card p-6 sm:p-7">
          <p className="lab-eyebrow">Add Assignment</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">加入板塊</h3>
          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">專項 / 類型</label>
                <select
                  className="lab-input"
                  value={selectedSportId}
                  onChange={(event) => {
                    const nextSportId = event.target.value
                    setSelectedSportId(nextSportId)
                    if (nextSportId === UNCATEGORIZED_SELECTOR) {
                      setSelectedAgeGroupId('')
                      setSelectedTrainingCategoryId('')
                    } else {
                      const nextAgeGroupId = taxonomy.ageGroups.find((ageGroup) => String(ageGroup.sport_id) === nextSportId)?.id
                      const nextTrainingCategoryId = nextAgeGroupId
                        ? taxonomy.trainingCategories.find((category) => category.age_group_id === nextAgeGroupId)?.id
                        : undefined
                      setSelectedAgeGroupId(nextAgeGroupId ? String(nextAgeGroupId) : '')
                      setSelectedTrainingCategoryId(nextTrainingCategoryId ? String(nextTrainingCategoryId) : '')
                    }
                    setBlockSearch('')
                  }}
                >
                  {taxonomy.sports.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                  <option value={UNCATEGORIZED_SELECTOR}>未分類</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">年齡分級</label>
                <select
                  className="lab-input"
                  value={effectiveSelectedAgeGroupId}
                  disabled={isUncategorizedSelection || availableAgeGroups.length === 0}
                  onChange={(event) => {
                    const nextAgeGroupId = event.target.value
                    setSelectedAgeGroupId(nextAgeGroupId)
                    const nextTrainingCategoryId = taxonomy.trainingCategories.find((category) => String(category.age_group_id) === nextAgeGroupId)?.id
                    setSelectedTrainingCategoryId(nextTrainingCategoryId ? String(nextTrainingCategoryId) : '')
                    setBlockSearch('')
                  }}
                >
                  {availableAgeGroups.length === 0 ? <option value="">{isUncategorizedSelection ? '未分類板塊不需選擇年齡' : '請先選擇專項'}</option> : null}
                  {availableAgeGroups.map((ageGroup) => (
                    <option key={ageGroup.id} value={ageGroup.id}>{ageGroup.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">訓練分類</label>
                <select
                  className="lab-input"
                  value={effectiveSelectedTrainingCategoryId}
                  disabled={isUncategorizedSelection || availableTrainingCategories.length === 0}
                  onChange={(event) => {
                    setSelectedTrainingCategoryId(event.target.value)
                    setBlockSearch('')
                  }}
                >
                  {availableTrainingCategories.length === 0 ? <option value="">{isUncategorizedSelection ? '未分類板塊不需選擇分類' : '請先選擇年齡分級'}</option> : null}
                  {availableTrainingCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">搜尋板塊</label>
                <input
                  className="lab-input"
                  value={blockSearch}
                  onChange={(event) => setBlockSearch(event.target.value)}
                  placeholder="搜尋代號、名稱、訓練元素、週期目標"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">選擇板塊</label>
              <select
                className="lab-input"
                value={effectiveBlockId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, blockId: event.target.value }))}
                disabled={visibleBlocks.length === 0}
              >
                {visibleBlocks.length === 0 ? <option value="">{isUncategorizedSelection ? '這個未分類條件下沒有板塊' : '目前分類下沒有板塊'}</option> : null}
                {visibleBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.block_code && block.block_name ? `${block.block_code} | ${block.block_name}` : block.block_name || block.block_code || `Block ${block.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">賽事 / 事件</label>
              <input className="lab-input" value={assignmentForm.eventName} onChange={(event) => setAssignmentForm((current) => ({ ...current, eventName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">週期目標</label>
              <textarea className="lab-input min-h-24" value={assignmentForm.cycleGoal} onChange={(event) => setAssignmentForm((current) => ({ ...current, cycleGoal: event.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">開始日期</label><input type="date" className="lab-input" value={assignmentForm.startDate} onChange={(event) => {
                const nextDate = event.target.value
                const marker = resolveWeekMarker(nextDate, weekMarkers)
                setAssignmentForm((current) => ({ ...current, startDate: nextDate, weekNum: marker?.weekNum ?? current.weekNum }))
              }} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">結束日期</label><input type="date" className="lab-input" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, endDate: event.target.value }))} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Week</label><input type="number" min="1" className="lab-input" value={assignmentForm.weekNum} onChange={(event) => setAssignmentForm((current) => ({ ...current, weekNum: event.target.value }))} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Day</label><input type="number" min="1" className="lab-input" value={assignmentForm.dayNum} onChange={(event) => setAssignmentForm((current) => ({ ...current, dayNum: event.target.value }))} /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">教練備註</label><textarea className="lab-input min-h-24" value={assignmentForm.notes} onChange={(event) => setAssignmentForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <button type="button" className="lab-btn-primary w-full sm:w-auto" disabled={isCreatingAssignment || visibleBlocks.length === 0 || !assignmentForm.blockId} onClick={() => void handleCreateAssignment()}>{isCreatingAssignment ? '建立中...' : '加入到這位學員課表'}</button>
          </div>
        </article>

        <article className="lab-card p-6 sm:p-7">
          <p className="lab-eyebrow">Add Event</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">新增一般事件</h3>
          <div className="mt-5 grid gap-4">
            <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">事件名稱</label><input className="lab-input" value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：季前檢測、友誼賽、體能測驗" /></div>
            <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">事件類型</label><select className="lab-input" value={eventForm.eventType} onChange={(event) => setEventForm((current) => ({ ...current, eventType: event.target.value }))}>{GENERAL_EVENT_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">開始日期</label><input type="date" className="lab-input" value={eventForm.startDate} onChange={(event) => setEventForm((current) => ({ ...current, startDate: event.target.value }))} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">結束日期</label><input type="date" className="lab-input" value={eventForm.endDate} onChange={(event) => setEventForm((current) => ({ ...current, endDate: event.target.value }))} /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">備註</label><textarea className="lab-input min-h-24" value={eventForm.notes} onChange={(event) => setEventForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <button type="button" className="lab-btn-primary w-full sm:w-auto" disabled={isCreatingEvent} onClick={() => void handleCreateEvent()}>{isCreatingEvent ? '建立中...' : '新增一般事件'}</button>
          </div>
        </article>
      </section>

      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {isDayModalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6"
          onClick={() => setIsDayModalOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-[#fefcf7] shadow-[0_30px_80px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-5 backdrop-blur sm:px-7">
              <div>
                <p className="lab-eyebrow">Daily Schedule</p>
                <h2 className="lab-section-title mt-2">{selectedDate}</h2>
                <p className="lab-copy mt-3">這一天的板塊安排與一般事件都會完整列在這裡。</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="lab-badge-primary">課表 {selectedDateAssignments.length}</span>
                <span className="lab-badge-success">事件 {selectedDateEvents.length}</span>
                <button
                  type="button"
                  className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                  onClick={() => setIsDayModalOpen(false)}
                >
                  關閉
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto overscroll-contain px-6 py-6 sm:px-7">
              {selectedDateAssignments.length === 0 && selectedDateEvents.length === 0 ? (
                <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">當日沒有安排。</div>
              ) : (
                <div className="space-y-4">
                  {selectedDateAssignments.map((assignment) => (
                    <DailyAssignmentSummaryCard key={assignment.id} assignment={assignment} athleteId={athleteId} onUpdated={applySchedule} onViewDetail={jumpToDetail} />
                  ))}
                  {selectedDateEvents.map((event) => (
                    <DailyEventSummaryCard key={event.id} event={event} athleteId={athleteId} onUpdated={applySchedule} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <section ref={detailSectionRef}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">Selected Day</p>
            <h2 className="lab-section-title mt-2">{selectedDate}</h2>
            <p className="lab-copy mt-3">下方顯示這一天的完整課表安排與一般事件；課表內容編輯也在這裡進行。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="lab-badge-primary">課表 {selectedDateAssignments.length}</span>
            <span className="lab-badge-success">事件 {selectedDateEvents.length}</span>
          </div>
        </div>

        {selectedDateAssignments.length === 0 && selectedDateEvents.length === 0 ? (
          <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">這一天目前沒有任何安排。</div>
        ) : (
          <div className="space-y-4">
            {selectedDateAssignments.map((assignment) => (
              <div key={assignment.id} id={`assignment-detail-${assignment.id}`}>
                <AssignmentCard assignment={assignment} athleteId={athleteId} onUpdated={applySchedule} />
              </div>
            ))}
            {selectedDateEvents.map((event) => (
              <EventCard key={event.id} event={event} athleteId={athleteId} onUpdated={applySchedule} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
