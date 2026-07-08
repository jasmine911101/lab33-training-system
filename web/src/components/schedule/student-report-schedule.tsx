'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { GENERAL_EVENT_TYPES } from '@/lib/types/schedule-management'
import type { AthleteScheduleBundle, AssignmentDetail, ExerciseRow, GeneralEventDetail } from '@/services/schedule'

type ScheduleItem =
  | { kind: 'assignment'; id: string; recordId: number; startDate: string; endDate: string; previewTop: string; previewBottom: string }
  | { kind: 'event'; id: string; recordId: number; startDate: string; endDate: string; previewTop: string; previewBottom?: string }

type CalendarCell = {
  date: string
  day: number
  inCurrentMonth: boolean
  items: ScheduleItem[]
}

type StudentReportScheduleProps = {
  schedule: AthleteScheduleBundle
  emptyMessage: string
}

type StudentCalendarPreviewProps = {
  schedule: AthleteScheduleBundle
  href: string
}

type EventFormState = {
  title: string
  eventType: string
  startDate: string
  endDate: string
  notes: string
}

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

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function compactWeekLabel(weekLabel: string) {
  const matched = weekLabel.match(/(\d+)/)
  return matched ? `W${matched[1]}` : 'W-'
}

function blockNameFromLabel(label: string) {
  if (!label.includes('|')) return label || '未命名板塊'
  const [, ...rest] = label.split('|')
  const extracted = rest.join('|').trim()
  return extracted || label.trim() || '未命名板塊'
}

function defaultEventForm(date: string): EventFormState {
  return {
    title: '',
    eventType: GENERAL_EVENT_TYPES[0],
    startDate: date,
    endDate: date,
    notes: '',
  }
}

function copySections(assignment: AssignmentDetail) {
  return assignment.sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      draft_actual_sets: row.actual_sets || row.sets,
      draft_actual_weight: row.actual_weight || row.weight,
    })),
  }))
}

function hasStudentReport(row: ExerciseRow) {
  return Boolean(row.actual_sets.trim() || row.actual_weight.trim())
}

function differenceLabel(row: ExerciseRow) {
  const changes: string[] = []
  if (row.actual_sets.trim() && row.actual_sets.trim() !== row.sets.trim()) changes.push('組數不同')
  if (row.actual_weight.trim() && row.actual_weight.trim() !== row.weight.trim()) changes.push('重量不同')
  return changes.join('、')
}

function buildScheduleItems(scheduleState: AthleteScheduleBundle): ScheduleItem[] {
  const assignments = scheduleState.assignments.map((assignment) => ({
    kind: 'assignment' as const,
    id: assignment.id,
    recordId: assignment.record_id,
    startDate: assignment.start_date || assignment.date_range.split(' ~ ')[0] || todayIso(),
    endDate: assignment.end_date || assignment.start_date || assignment.date_range.split(' ~ ').slice(-1)[0] || todayIso(),
    previewTop: `${compactWeekLabel(assignment.week_label)}・${truncateText(assignment.event_display_name || assignment.block_name || '未命名安排', 8)}`,
    previewBottom: `${truncateText(assignment.category_label || '未分類', 6)}・${truncateText(assignment.block_code || '無代號', 10)}`,
  }))

  const events = scheduleState.generalEvents.map((event) => ({
    kind: 'event' as const,
    id: event.id,
    recordId: event.record_id,
    startDate: event.start_date || todayIso(),
    endDate: event.end_date || event.start_date || todayIso(),
    previewTop: truncateText(event.event_name, 14),
    previewBottom: truncateText(event.event_type || '一般事件', 12),
  }))

  return [...assignments, ...events].sort((left, right) => {
    if (left.startDate !== right.startDate) return left.startDate.localeCompare(right.startDate)
    return left.recordId - right.recordId
  })
}

function buildMonthDays(calendarItems: ScheduleItem[], visibleMonth: string): CalendarCell[] {
  const base = firstDayOfMonth(visibleMonth)
  const year = base.getFullYear()
  const month = base.getMonth()
  const firstWeekday = (base.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: CalendarCell[] = []

  for (let index = 0; index < firstWeekday; index += 1) {
    const date = new Date(year, month, index - firstWeekday + 1)
    const iso = `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`
    cells.push({ date: iso, day: date.getDate(), inCurrentMonth: false, items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)) })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${visibleMonth}-${padMonth(day)}`
    cells.push({ date: iso, day, inCurrentMonth: true, items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)) })
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const date = new Date(`${last.date}T00:00:00`)
    date.setDate(date.getDate() + 1)
    const iso = `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`
    cells.push({ date: iso, day: date.getDate(), inCurrentMonth: false, items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)) })
  }

  return cells
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

type StudentEditableRow = ExerciseRow & {
  draft_actual_sets: string
  draft_actual_weight: string
}

function StudentExerciseReportTable({
  rows,
  onChange,
}: {
  rows: StudentEditableRow[]
  onChange: (rowId: string, field: 'draft_actual_sets' | 'draft_actual_weight', value: string) => void
}) {
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
            <th className="border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">備註</th>
            <th className="rounded-tr-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">影片</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isReported = hasStudentReport(row)
            const diffLabel = differenceLabel(row)
            return (
              <tr key={`${row.id || row.exercise_name}-${index}`} className={isReported ? 'bg-emerald-50/70' : 'bg-white'}>
                <td className="border border-slate-200 px-4 py-3 font-medium text-slate-900">
                  <div>{row.exercise_name || '-'}</div>
                  {!row.can_report ? <div className="mt-1 text-xs font-semibold text-amber-700">僅可查看</div> : null}
                </td>
                <td className={`border border-slate-200 px-4 py-3 align-top ${row.actual_sets ? 'bg-emerald-50/70' : ''}`}>
                  {row.can_report ? (
                    <div className="space-y-2">
                      <input
                        className={`lab-input !min-h-10 px-3 py-2 text-sm ${row.actual_sets ? '!border-emerald-300 !bg-emerald-50' : ''}`}
                        value={row.draft_actual_sets}
                        onChange={(event) => onChange(row.id, 'draft_actual_sets', event.target.value)}
                        placeholder={row.sets || '-'}
                      />
                      {row.actual_sets ? <div className="text-xs text-slate-500">原始：{row.sets || '-'}</div> : null}
                    </div>
                  ) : (
                    <span className="text-slate-600">{row.sets || '-'}</span>
                  )}
                </td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.reps_or_time || '-'}</td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.intensity || '-'}</td>
                <td className={`border border-slate-200 px-4 py-3 align-top ${row.actual_weight ? 'bg-emerald-50/70' : ''}`}>
                  {row.can_report ? (
                    <div className="space-y-2">
                      <input
                        className={`lab-input !min-h-10 px-3 py-2 text-sm ${row.actual_weight ? '!border-emerald-300 !bg-emerald-50' : ''}`}
                        value={row.draft_actual_weight}
                        onChange={(event) => onChange(row.id, 'draft_actual_weight', event.target.value)}
                        placeholder={row.weight || '-'}
                      />
                      {row.actual_weight ? <div className="text-xs text-slate-500">原始：{row.weight || '-'}</div> : null}
                    </div>
                  ) : (
                    <span className="text-slate-600">{row.weight || '-'}</span>
                  )}
                </td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.rest || '-'}</td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.equipment || '-'}</td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.notes || '-'}</td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">
                  {row.video_url ? (
                    <a href={row.video_url} target="_blank" rel="noreferrer" className="lab-badge-info">
                      影片連結
                    </a>
                  ) : '-'}
                  {row.actual_sets && row.actual_sets !== row.sets ? (
                        <div className="text-xs font-semibold text-sky-700">與安排不同</div>
                      ) : null}
                  {row.actual_weight && row.actual_weight !== row.weight ? (
                        <div className="text-xs font-semibold text-sky-700">與安排不同</div>
                      ) : null}
                  {diffLabel && row.can_report ? <div className="mt-2 text-xs font-semibold text-emerald-700">已回報</div> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StudentAssignmentCard({
  assignment,
  onSaved,
  forceOpen = false,
}: {
  assignment: AssignmentDetail
  onSaved: (assignmentId: number, sections: AssignmentDetail['sections']) => void
  forceOpen?: boolean
}) {
  const [sections, setSections] = useState(() => copySections(assignment))
  const [isOpen, setIsOpen] = useState(forceOpen)
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!forceOpen) return

    const frameId = window.requestAnimationFrame(() => {
      setIsOpen(true)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [forceOpen])

  const reportableRows = useMemo(
    () => sections.flatMap((section) => section.rows.filter((row) => row.can_report)),
    [sections],
  )

  const reportedRowCount = useMemo(
    () => sections.flatMap((section) => section.rows).filter((row) => hasStudentReport(row)).length,
    [sections],
  )
  const resolvedBlockName =
    (assignment.block_label ? blockNameFromLabel(assignment.block_label) : '') ||
    assignment.block_name ||
    '未命名板塊'
  const resolvedBlockLabel =
    assignment.block_code && resolvedBlockName !== '未命名板塊'
      ? `${assignment.block_code} | ${resolvedBlockName}`
      : assignment.block_label || resolvedBlockName

  function updateRow(rowId: string, field: 'draft_actual_sets' | 'draft_actual_weight', value: string) {
    setSections((current) =>
      current.map((section) => ({
        ...section,
        rows: section.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
      })),
    )
  }

  function toggleSection(sectionName: string) {
    setExpandedSections((current) =>
      current.includes(sectionName) ? current.filter((item) => item !== sectionName) : [...current, sectionName],
    )
  }

  async function handleSave() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch(`/api/student/assignments/${assignment.record_id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: reportableRows.map((row) => ({
            id: Number(row.id),
            actual_sets: row.draft_actual_sets.trim() === row.sets.trim() ? '' : row.draft_actual_sets,
            actual_weight: row.draft_actual_weight.trim() === row.weight.trim() ? '' : row.draft_actual_weight,
          })),
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? '儲存訓練回報失敗。')
      }

      const normalizedSections = sections.map((section) => ({
        ...section,
        rows: section.rows.map((row) => ({
          ...row,
          actual_sets: row.draft_actual_sets.trim() === row.sets.trim() ? '' : row.draft_actual_sets,
          actual_weight: row.draft_actual_weight.trim() === row.weight.trim() ? '' : row.draft_actual_weight,
        })),
      }))
      setSections(normalizedSections)
      setMessage(payload?.message ?? '已儲存訓練回報。')
      onSaved(
        assignment.record_id,
        normalizedSections.map((section) => ({
          ...section,
          rows: section.rows.map((row) => {
            const { draft_actual_sets, draft_actual_weight, ...persistedRow } = row
            void draft_actual_sets
            void draft_actual_weight
            return persistedRow
          }),
        })),
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '儲存訓練回報失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="lab-card p-5 sm:p-6">
      <button type="button" className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setIsOpen((current) => !current)}>
        <div className="min-w-0">
          <p className="lab-eyebrow">Training Assignment</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{resolvedBlockName}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="lab-badge bg-slate-100 text-slate-700">{assignment.week_label}</span>
            <span className="lab-badge bg-slate-100 text-slate-700">事件：{assignment.event_display_name || '-'}</span>
            <span className="lab-badge bg-sky-100 text-sky-700">{assignment.category_label}</span>
            <span className="lab-badge bg-amber-100 text-amber-800">{assignment.block_code || '未設定代號'}</span>
            <span className="lab-badge bg-slate-100 text-slate-700">{assignment.date_range || '-'}</span>
            {reportedRowCount > 0 ? <span className="lab-badge-success">已回報 {reportedRowCount} 項</span> : null}
          </div>
          <p className="mt-3 text-sm text-slate-600">板塊：{resolvedBlockLabel}</p>
        </div>
        <span className="pt-1 text-lg font-semibold text-slate-400">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen ? (
        <>
          <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
            <DetailMeta label="Week" value={assignment.week_label} />
            <DetailMeta label="事件" value={assignment.event_display_name} />
            <DetailMeta label="分類" value={assignment.category_label} />
            <DetailMeta label="代號" value={assignment.block_code || '未設定'} />
            <DetailMeta label="日期" value={assignment.date_range} />
            <DetailMeta label="週期目標" value={assignment.cycle_goal} />
            <DetailMeta label="訓練元素" value={assignment.training_element} />
            <DetailMeta label="教練備註" value={assignment.coach_notes} />
          </dl>

          {(assignment.goal || assignment.description) ? (
            <div className="mt-5 space-y-3">
              {assignment.goal ? <div className="rounded-[1rem] bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900"><strong>目標：</strong>{assignment.goal}</div> : null}
              {assignment.description ? <div className="rounded-[1rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700"><strong>描述：</strong>{assignment.description}</div> : null}
            </div>
          ) : null}

          {assignment.sections.length === 0 ? (
            <div className="lab-card-muted mt-5 px-4 py-4 text-sm text-slate-600">{assignment.empty_message}</div>
          ) : (
            <div className="mt-6 space-y-4">
              {sections.map((section) => {
                const isSectionOpen = expandedSections.includes(section.name)
                return (
                  <section key={`${assignment.id}-${section.name}`} className="rounded-[1rem] border border-slate-200 bg-slate-50/60">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                      onClick={() => toggleSection(section.name)}
                    >
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{section.name}</h4>
                        <p className="mt-1 text-sm text-slate-500">{section.rows.length} 個動作</p>
                      </div>
                      <span className="text-base font-semibold text-slate-400">{isSectionOpen ? '▾' : '▸'}</span>
                    </button>
                    {isSectionOpen ? (
                      <div className="border-t border-slate-200 px-4 py-4">
                        <StudentExerciseReportTable
                          rows={section.rows}
                          onChange={(rowId, field, value) => updateRow(rowId, field, value)}
                        />
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary w-full sm:w-auto" disabled={isSaving || reportableRows.length === 0} onClick={() => void handleSave()}>
              {isSaving ? '儲存中...' : '儲存回報'}
            </button>
            {reportableRows.length === 0 ? <span className="lab-badge-warning">這筆課表目前沒有可儲存的學員專屬動作內容</span> : null}
          </div>

          {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {message ? <p className="mt-5 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
        </>
      ) : null}
    </article>
  )
}

function StudentGeneralEventCard({ event }: { event: GeneralEventDetail }) {
  return (
    <article className="lab-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="lab-eyebrow">General Event</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{event.event_name}</h3>
          <p className="mt-2 text-sm text-slate-500">{event.meta}</p>
        </div>
        <span className="lab-badge-success">一般事件</span>
      </div>
      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <DetailMeta label="事件類型" value={event.event_type} />
        <DetailMeta label="日期" value={event.date_range} />
        <DetailMeta label="備註" value={event.description} />
      </div>
      {!event.description ? <div className="lab-card-muted mt-5 px-4 py-4 text-sm text-slate-600">{event.empty_message}</div> : null}
    </article>
  )
}

function DailyAssignmentSummaryCard({
  assignment,
  onViewDetail,
}: {
  assignment: AssignmentDetail
  onViewDetail: (assignmentId: string) => void
}) {
  return (
    <article className="rounded-[1.25rem] border border-orange-200 bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">{assignment.event_display_name || assignment.block_name || '未命名安排'}</p>
          <p className="mt-2 text-sm font-medium text-slate-600">板塊：{assignment.block_code || '無代號'} | {assignment.block_name || assignment.block_label}</p>
        </div>
        <span className="lab-badge-primary">課表安排</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="lab-badge bg-slate-100 text-slate-700">Week：{assignment.week_label.replace(/^Week\s*/i, '') || '-'}</span>
        <span className="lab-badge bg-sky-100 text-sky-700">分類：{assignment.category_label}</span>
        <span className="lab-badge bg-amber-100 text-amber-800">代號：{assignment.block_code || '無代號'}</span>
      </div>
      <div className="mt-5">
        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => onViewDetail(assignment.id)}>
          查看 / 回報課表內容
        </button>
      </div>
    </article>
  )
}

function DailyEventSummaryCard({ event }: { event: GeneralEventDetail }) {
  return (
    <article className="rounded-[1.25rem] border border-emerald-200 bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">{event.event_name}</p>
          <p className="mt-2 text-sm font-medium text-slate-600">{event.event_type}</p>
        </div>
        <span className="lab-badge-success">一般事件</span>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <DetailMeta label="日期" value={event.date_range} />
        <DetailMeta label="備註" value={event.description} />
      </div>
    </article>
  )
}

function CalendarMonthGrid({
  visibleMonth,
  monthDays,
  selectedDate,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
  compact = false,
}: {
  visibleMonth: string
  monthDays: CalendarCell[]
  selectedDate: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onSelectDate: (cell: CalendarCell) => void
  compact?: boolean
}) {
  return (
    <div className={`rounded-[1.5rem] border border-slate-200 bg-slate-50/80 ${compact ? 'p-4' : 'p-4 sm:p-5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onPreviousMonth}>上個月</button>
        <div className="text-center">
          <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{formatMonthLabel(visibleMonth)}</h3>
          <p className="mt-1 text-xs text-slate-500">{compact ? '點日期前往完整行事曆。' : '點日期即可預覽當天安排；出現 +N 筆時會展開當日摘要框。'}</p>
        </div>
        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onNextMonth}>下個月</button>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className={compact ? 'min-w-[680px]' : 'min-w-[760px]'}>
          <div className="grid gap-px rounded-t-[1.25rem] bg-slate-200" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => (
              <div key={day} className={`bg-white px-3 py-3 text-center text-xs font-semibold tracking-[0.16em] ${index >= 5 ? 'text-orange-500' : 'text-slate-500'}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid gap-px rounded-b-[1.25rem] bg-slate-200" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {monthDays.map((cell) => {
              const assignmentCount = cell.items.filter((item) => item.kind === 'assignment').length
              const eventCount = cell.items.filter((item) => item.kind === 'event').length
              const isSelected = cell.date === selectedDate
              const isToday = cell.date === todayIso()
              const previewItems = cell.items.slice(0, 2)

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onSelectDate(cell)}
                  className={`relative flex ${compact ? 'min-h-[108px]' : 'min-h-[132px]'} w-full min-w-0 flex-col bg-white p-3 text-left transition hover:z-10 hover:bg-slate-50 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isSelected ? 'z-10 bg-sky-50 ring-2 ring-inset ring-sky-400' : ''} ${cell.inCurrentMonth ? 'text-slate-900' : 'text-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-sky-500 text-white' : isToday ? 'bg-slate-900 text-white' : cell.inCurrentMonth ? 'bg-slate-100 text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
                      {cell.day}
                    </div>
                    {(assignmentCount > 0 || eventCount > 0) ? (
                      <div className="flex flex-col items-end gap-1 text-[10px] font-semibold">
                        {assignmentCount > 0 ? <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">課表 {assignmentCount}</span> : null}
                        {eventCount > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">事件 {eventCount}</span> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {previewItems.map((item) => (
                      <div
                        key={`${cell.date}-${item.kind}-${item.id}`}
                        className={`rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-4 ${item.kind === 'assignment' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'} ${cell.inCurrentMonth ? '' : 'opacity-70'}`}
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
  )
}

export function StudentCalendarPreview({ schedule, href }: StudentCalendarPreviewProps) {
  const router = useRouter()
  const initialDate = todayIso()
  const [visibleMonth, setVisibleMonth] = useState(initialDate.slice(0, 7))
  const calendarItems = useMemo(() => buildScheduleItems(schedule), [schedule])
  const monthDays = useMemo(() => buildMonthDays(calendarItems, visibleMonth), [calendarItems, visibleMonth])

  return (
    <article className="lab-card p-6 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lab-eyebrow">Calendar Preview</p>
          <h2 className="lab-section-title mt-3">本月課表預覽</h2>
          <p className="lab-copy mt-3">保留首頁的小型月曆摘要；需要完整查看課表、事件與回報時，再進入完整行事曆。</p>
        </div>
        <Link href={href} className="lab-btn-secondary">
          查看完整行事曆
        </Link>
      </div>

      <div className="mt-6">
        <CalendarMonthGrid
          compact
          visibleMonth={visibleMonth}
          monthDays={monthDays}
          selectedDate={initialDate}
          onPreviousMonth={() => setVisibleMonth((current) => shiftMonth(current, -1))}
          onNextMonth={() => setVisibleMonth((current) => shiftMonth(current, 1))}
          onSelectDate={() => router.push(href)}
        />
      </div>
    </article>
  )
}

export function StudentReportSchedule({ schedule, emptyMessage }: StudentReportScheduleProps) {
  const initialDate = todayIso()
  const [scheduleState, setScheduleState] = useState(schedule)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [visibleMonth, setVisibleMonth] = useState(initialDate.slice(0, 7))
  const [eventForm, setEventForm] = useState<EventFormState>(() => defaultEventForm(initialDate))
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [isDayModalOpen, setIsDayModalOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [highlightedAssignmentId, setHighlightedAssignmentId] = useState<string | null>(null)
  const [isEventFormOpen, setIsEventFormOpen] = useState(false)
  const detailSectionRef = useRef<HTMLElement | null>(null)

  const calendarItems = useMemo(() => buildScheduleItems(scheduleState), [scheduleState])

  const selectedDateAssignments = useMemo(
    () => scheduleState.assignments.filter((assignment) => rangeIncludes(selectedDate, assignment.start_date || selectedDate, assignment.end_date || assignment.start_date || selectedDate)),
    [scheduleState.assignments, selectedDate],
  )

  const selectedDateEvents = useMemo(
    () => scheduleState.generalEvents.filter((event) => rangeIncludes(selectedDate, event.start_date || selectedDate, event.end_date || event.start_date || selectedDate)),
    [scheduleState.generalEvents, selectedDate],
  )

  const monthDays = useMemo(() => buildMonthDays(calendarItems, visibleMonth), [calendarItems, visibleMonth])

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

  function updateAssignmentRows(assignmentId: number, sections: AssignmentDetail['sections']) {
    setScheduleState((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) =>
        assignment.record_id === assignmentId ? { ...assignment, sections } : assignment,
      ),
    }))
  }

  function selectDate(date: string, shouldOpenModal: boolean) {
    setSelectedDate(date)
    setEventForm((current) => ({ ...current, startDate: date, endDate: date }))
    setIsDayModalOpen(shouldOpenModal)
  }

  function jumpToDetail(assignmentId: string) {
    setHighlightedAssignmentId(assignmentId)
    setIsDayModalOpen(false)
    window.requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.getElementById(`student-assignment-detail-${assignmentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function handleCreateEvent() {
    setIsCreatingEvent(true)
    setError(null)
    try {
      const response = await fetch('/api/student/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventForm.title,
          event_type: eventForm.eventType,
          start_date: eventForm.startDate,
          end_date: eventForm.endDate,
          notes: eventForm.notes,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string; schedule?: AthleteScheduleBundle } | null
      if (!response.ok || !payload?.schedule) {
        throw new Error(payload?.error ?? '新增一般事件失敗。')
      }

      setScheduleState(payload.schedule)
      setSelectedDate(eventForm.startDate)
      setVisibleMonth(eventForm.startDate.slice(0, 7))
      setEventForm(defaultEventForm(eventForm.startDate))
      setMessage(payload.message ?? '已新增一般事件。')
      setIsEventFormOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '新增一般事件失敗。')
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
            <h2 className="lab-section-title">我的完整行事曆</h2>
            <p className="lab-copy mt-3">用和教練端一致的月曆方式查看課表與一般事件，日期內容過多時可打開當日摘要框。</p>
          </div>
          <span className="lab-badge-info">已選日期：{selectedDate}</span>
        </div>

        <div className="mt-6">
          <CalendarMonthGrid
            visibleMonth={visibleMonth}
            monthDays={monthDays}
            selectedDate={selectedDate}
            onPreviousMonth={() => setVisibleMonth((current) => shiftMonth(current, -1))}
            onNextMonth={() => setVisibleMonth((current) => shiftMonth(current, 1))}
            onSelectDate={(cell) => selectDate(cell.date, cell.items.length > 2)}
          />
        </div>
      </article>

      <section className="space-y-6">
        <article ref={detailSectionRef} className="lab-card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="lab-eyebrow">Selected Day</p>
              <h2 className="lab-section-title mt-2">{selectedDate}</h2>
              <p className="lab-copy mt-3">下方顯示這一天的完整課表安排與一般事件；目前可直接回報的欄位為組數與重量，其餘欄位保留教練原始安排內容。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="lab-badge-primary">課表 {selectedDateAssignments.length}</span>
              <span className="lab-badge-success">事件 {selectedDateEvents.length}</span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {selectedDateAssignments.map((assignment) => (
              <div key={assignment.id} id={`student-assignment-detail-${assignment.id}`}>
                <StudentAssignmentCard assignment={assignment} onSaved={updateAssignmentRows} forceOpen={highlightedAssignmentId === assignment.id} />
              </div>
            ))}
            {selectedDateEvents.map((event) => (
              <StudentGeneralEventCard key={event.id} event={event} />
            ))}
            {selectedDateAssignments.length === 0 && selectedDateEvents.length === 0 ? (
              <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">
                {scheduleState.assignments.length === 0 && scheduleState.generalEvents.length === 0 ? emptyMessage : '這一天目前沒有任何安排。'}
              </div>
            ) : null}
          </div>
        </article>

        <article className="lab-card p-6 sm:p-7">
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 text-left"
            onClick={() => setIsEventFormOpen((current) => !current)}
          >
            <div>
              <p className="lab-eyebrow">Add Event</p>
              <h2 className="lab-section-title mt-3">新增自己的事件</h2>
              <p className="lab-copy mt-3">沿用教練端相同風格的事件表單。新增後會寫入自己的 `athlete_events`，教練查看你的行事曆時也會同步看到。</p>
            </div>
            <span className="pt-1 text-lg font-semibold text-slate-400">{isEventFormOpen ? '▾' : '▸'}</span>
          </button>

          {isEventFormOpen ? (
            <div className="mt-5 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">事件名稱</label>
                <input className="lab-input" value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="例如：自主訓練、友誼賽、復健" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">事件類型</label>
                <select className="lab-input" value={eventForm.eventType} onChange={(event) => setEventForm((current) => ({ ...current, eventType: event.target.value }))}>
                  {GENERAL_EVENT_TYPES.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">開始日期</label>
                  <input type="date" className="lab-input" value={eventForm.startDate} onChange={(event) => setEventForm((current) => ({ ...current, startDate: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">結束日期</label>
                  <input type="date" className="lab-input" value={eventForm.endDate} onChange={(event) => setEventForm((current) => ({ ...current, endDate: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">備註</label>
                <textarea className="lab-input min-h-24" value={eventForm.notes} onChange={(event) => setEventForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
              <button type="button" className="lab-btn-primary w-full sm:w-auto" disabled={isCreatingEvent || !eventForm.title.trim()} onClick={() => void handleCreateEvent()}>
                {isCreatingEvent ? '建立中...' : '新增一般事件'}
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {message ? <p className="mt-5 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
        </article>
      </section>

      {isDayModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6" onClick={() => setIsDayModalOpen(false)}>
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-[#fefcf7] shadow-[0_30px_80px_rgba(15,23,42,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-5 backdrop-blur sm:px-7">
              <div>
                <p className="lab-eyebrow">Daily Schedule</p>
                <h2 className="lab-section-title mt-2">{selectedDate}</h2>
                <p className="lab-copy mt-3">這一天的課表安排與一般事件摘要都會完整列在這裡。</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="lab-badge-primary">課表 {selectedDateAssignments.length}</span>
                <span className="lab-badge-success">事件 {selectedDateEvents.length}</span>
                <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setIsDayModalOpen(false)}>
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
                    <DailyAssignmentSummaryCard key={assignment.id} assignment={assignment} onViewDetail={jumpToDetail} />
                  ))}
                  {selectedDateEvents.map((event) => (
                    <DailyEventSummaryCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
