'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { GENERAL_EVENT_TYPES } from '@/lib/types/schedule-management'
import { normalizeExternalUrl } from '@/lib/external-url'
import { AssignmentCalendarPreview, CycleBadge, cycleNameFromAssignment, weekNumberLabel } from '@/components/schedule/cycle-info'
import type { AthleteScheduleBundle, AssignmentDetail, ExerciseRow, GeneralEventDetail, StudentDashboardSummary, WeekMarker } from '@/services/schedule'

type ScheduleItem =
  | {
      kind: 'assignment'
      id: string
      recordId: number
      startDate: string
      endDate: string
      weekLabel: string
      cycleName: string
      eventName: string
      categoryLabel: string
      blockCode: string
    }
  | { kind: 'event'; id: string; recordId: number; startDate: string; endDate: string; previewTop: string; previewBottom?: string }

type CalendarCell = {
  date: string
  day: number
  inCurrentMonth: boolean
  items: ScheduleItem[]
  weekMarkers: WeekMarker[]
}

const WEEK_MARKER_COLORS = [
  { key: 'sky', name: '藍色', badgeClass: 'lab-week-sky-badge', chipClass: 'lab-week-sky-chip' },
  { key: 'emerald', name: '綠色', badgeClass: 'lab-week-emerald-badge', chipClass: 'lab-week-emerald-chip' },
  { key: 'amber', name: '橘色', badgeClass: 'lab-week-amber-badge', chipClass: 'lab-week-amber-chip' },
  { key: 'violet', name: '紫色', badgeClass: 'lab-week-violet-badge', chipClass: 'lab-week-violet-chip' },
  { key: 'rose', name: '粉色', badgeClass: 'lab-week-rose-badge', chipClass: 'lab-week-rose-chip' },
  { key: 'slate', name: '灰色', badgeClass: 'lab-week-slate-badge', chipClass: 'lab-week-slate-chip' },
] as const

type StudentReportScheduleProps = {
  schedule: AthleteScheduleBundle
  emptyMessage: string
  reportApiBase?: string
  title?: string
  allowPersonalEvents?: boolean
  showWeekMarkerPanel?: boolean
}

type StudentCalendarPreviewProps = {
  summary: StudentDashboardSummary
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

function resolveWeekMarkers(date: string, markers: WeekMarker[]) {
  return markers.filter((marker) => rangeIncludes(date, marker.startDate, marker.endDate))
}

function getWeekMarkerLaneKey(marker: WeekMarker) {
  return [marker.id, marker.startDate, marker.endDate, marker.weekNum, marker.note, marker.colorKey].join('|')
}

function getWeekMarkerLanes(markers: WeekMarker[]) {
  const laneEndDates: string[] = []
  const lanes = new Map<string, number>()

  for (const marker of [...markers].sort((left, right) => left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id))) {
    let lane = laneEndDates.findIndex((endDate) => endDate < marker.startDate)
    if (lane === -1) lane = laneEndDates.length
    laneEndDates[lane] = marker.endDate
    lanes.set(getWeekMarkerLaneKey(marker), lane)
  }

  return lanes
}

function getWeekMarkerColor(colorKey?: string) {
  return WEEK_MARKER_COLORS.find((option) => option.key === colorKey) ?? WEEK_MARKER_COLORS[0]
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
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
    weekLabel: assignment.week_label,
    cycleName: assignment.cycle_name,
    eventName: truncateText(assignment.event_display_name || assignment.block_name || '未命名安排', 8),
    categoryLabel: truncateText(assignment.category_label || '未分類', 6),
    blockCode: truncateText(assignment.block_code || '無代號', 10),
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

function buildMonthDays(calendarItems: ScheduleItem[], visibleMonth: string, weekMarkers: WeekMarker[]): CalendarCell[] {
  const base = firstDayOfMonth(visibleMonth)
  const year = base.getFullYear()
  const month = base.getMonth()
  const firstWeekday = (base.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: CalendarCell[] = []

  for (let index = 0; index < firstWeekday; index += 1) {
    const date = new Date(year, month, index - firstWeekday + 1)
    const iso = `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`
    cells.push({ date: iso, day: date.getDate(), inCurrentMonth: false, items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)), weekMarkers: resolveWeekMarkers(iso, weekMarkers) })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${visibleMonth}-${padMonth(day)}`
    cells.push({ date: iso, day, inCurrentMonth: true, items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)), weekMarkers: resolveWeekMarkers(iso, weekMarkers) })
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const date = new Date(`${last.date}T00:00:00`)
    date.setDate(date.getDate() + 1)
    const iso = `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${padMonth(date.getDate())}`
    cells.push({ date: iso, day: date.getDate(), inCurrentMonth: false, items: calendarItems.filter((item) => rangeIncludes(iso, item.startDate, item.endDate)), weekMarkers: resolveWeekMarkers(iso, weekMarkers) })
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
                <td className="border border-slate-200 px-4 py-3 text-slate-600">
                  {row.notes ? <div>{row.notes}</div> : null}
                  {isReported || diffLabel ? (
                    <div className={`${row.notes ? 'mt-2' : ''} flex flex-wrap gap-2`}>
                      {diffLabel ? <span className="lab-badge-info">與安排不同</span> : null}
                      {isReported && row.can_report ? <span className="lab-badge-success">已回報</span> : null}
                    </div>
                  ) : null}
                  {!row.notes && !isReported && !diffLabel ? '-' : null}
                </td>
                <td className="border border-slate-200 px-4 py-3 text-slate-600">
                  {normalizeExternalUrl(row.video_url) ? (
                    <a href={normalizeExternalUrl(row.video_url) ?? undefined} target="_blank" rel="noreferrer" className="lab-badge-info">
                      影片連結
                    </a>
                  ) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StudentPreviewExerciseTable({ rows }: { rows: ExerciseRow[] }) {
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
          {rows.map((row, index) => (
            <tr key={`${row.id || row.exercise_name}-${index}`} className="bg-white">
              <td className="border border-slate-200 px-4 py-3 font-medium text-slate-900">{row.exercise_name || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.sets || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.reps_or_time || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.intensity || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.weight || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.rest || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.equipment || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">{row.notes || '-'}</td>
              <td className="border border-slate-200 px-4 py-3 text-slate-600">
                {normalizeExternalUrl(row.video_url) ? (
                  <a href={normalizeExternalUrl(row.video_url) ?? undefined} target="_blank" rel="noreferrer" className="lab-badge-info">
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

function StudentPreviewAssignmentCard({
  assignment,
  href,
}: {
  assignment: AssignmentDetail
  href: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  const resolvedBlockName =
    (assignment.block_label ? blockNameFromLabel(assignment.block_label) : '') ||
    assignment.block_name ||
    '未命名板塊'
  const resolvedBlockLabel =
    assignment.block_code && resolvedBlockName !== '未命名板塊'
      ? `${assignment.block_code} | ${resolvedBlockName}`
      : assignment.block_label || resolvedBlockName

  function toggleSection(sectionName: string) {
    setExpandedSections((current) =>
      current.includes(sectionName) ? current.filter((item) => item !== sectionName) : [...current, sectionName],
    )
  }

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <article className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
        <button type="button" className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setIsOpen(true)}>
          <div className="min-w-0">
            <p className="lab-eyebrow">Next Assignment</p>
            <h3 className="mt-3 text-lg font-bold text-slate-900">下一個課表</h3>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-slate-500">{assignment.start_date || assignment.date_range || '-'}</p>
              <p className="text-base font-semibold text-slate-900 transition hover:text-orange-500">{resolvedBlockName}</p>
            </div>
          </div>
          <span className="lab-btn-secondary !min-h-10 shrink-0 px-4 py-2 text-sm">查看內容</span>
        </button>
      </article>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setIsOpen(false)}>
          <div
            className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:px-7">
              <div className="min-w-0">
                <p className="lab-eyebrow">Assignment Preview</p>
                <h3 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">{resolvedBlockName}</h3>
              </div>
              <button type="button" className="lab-btn-secondary !min-h-10 shrink-0 px-4 py-2 text-sm" onClick={() => setIsOpen(false)}>
                關閉
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-7">
              <div className="flex flex-wrap gap-2">
                <CycleBadge weekLabel={assignment.week_label} cycleName={assignment.cycle_name} />
                <span className="lab-badge bg-slate-100 text-slate-700">事件：{assignment.event_display_name || '-'}</span>
                <span className="lab-badge bg-sky-100 text-sky-700">{assignment.category_label}</span>
                <span className="lab-badge bg-amber-100 text-amber-800">{assignment.block_code || '未設定代號'}</span>
                <span className="lab-badge bg-slate-100 text-slate-700">{assignment.date_range || '-'}</span>
              </div>

              <p className="mt-4 text-sm text-slate-600">板塊：{resolvedBlockLabel}</p>

              <dl className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                <DetailMeta label="Week" value={assignment.week_label} />
                <DetailMeta label="事件" value={assignment.event_display_name} />
                <DetailMeta label="分類" value={assignment.category_label} />
                <DetailMeta label="代號" value={assignment.block_code || '未設定'} />
                <DetailMeta label="日期" value={assignment.date_range} />
                <DetailMeta label="目標" value={assignment.goal} />
                <DetailMeta label="描述" value={assignment.description} />
                <DetailMeta label="訓練元素" value={assignment.training_element} />
              </dl>

              {assignment.sections.length === 0 ? (
                <div className="lab-card-muted mt-6 px-4 py-4 text-sm text-slate-600">{assignment.empty_message}</div>
              ) : (
                <div className="mt-6 space-y-4">
                  {assignment.sections.map((section) => {
                    const isSectionOpen = expandedSections.includes(section.name)
                    return (
                      <section key={`${assignment.id}-preview-${section.name}`} className="rounded-[1rem] border border-slate-200 bg-slate-50/60">
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
                            <StudentPreviewExerciseTable rows={section.rows} />
                          </div>
                        ) : null}
                      </section>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-5 sm:px-7">
              <div className="rounded-[1rem] bg-sky-50 px-4 py-4 text-sm text-sky-800">
                這裡提供首頁快速查看。若要回報實際訓練狀況，請進入完整行事曆。
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setIsOpen(false)}>
                  關閉
                </button>
                <Link href={href} className="lab-btn-primary !min-h-10 px-4 py-2 text-sm !text-white" onClick={() => setIsOpen(false)}>
                  前往完整行事曆回報
                </Link>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  )
}

function StudentAssignmentCard({
  assignment,
  onSaved,
  forceOpen = false,
  reportApiBase = '/api/student/assignments',
}: {
  assignment: AssignmentDetail
  onSaved: (assignmentId: number, sections: AssignmentDetail['sections']) => void
  forceOpen?: boolean
  reportApiBase?: string
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
      const response = await fetch(`${reportApiBase}/${assignment.record_id}/report`, {
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
            <CycleBadge weekLabel={assignment.week_label} cycleName={assignment.cycle_name} />
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
        <CycleBadge weekLabel={assignment.week_label} cycleName={assignment.cycle_name} />
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
  weekMarkerLanes,
  maxWeekMarkerLane,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
  compact = false,
}: {
  visibleMonth: string
  monthDays: CalendarCell[]
  selectedDate: string
  weekMarkerLanes: Map<string, number>
  maxWeekMarkerLane: number
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
            {monthDays.map((cell, cellIndex) => {
              const assignmentCount = cell.items.filter((item) => item.kind === 'assignment').length
              const eventCount = cell.items.filter((item) => item.kind === 'event').length
              const isSelected = cell.date === selectedDate
              const isToday = cell.date === todayIso()
              const previewItems = cell.items.slice(0, 2)
              const cellWeekMarkers = cell.weekMarkers
              const previousCell = cellIndex % 7 === 0 ? null : monthDays[cellIndex - 1]
              const nextCell = cellIndex % 7 === 6 ? null : monthDays[cellIndex + 1]
        const highestCellLane = Math.max(-1, ...cellWeekMarkers.map((marker) => weekMarkerLanes.get(getWeekMarkerLaneKey(marker)) ?? 0))

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => onSelectDate(cell)}
                  className={`relative flex ${compact ? 'min-h-[108px]' : 'min-h-[132px]'} w-full min-w-0 flex-col bg-white p-3 text-left transition hover:z-10 hover:bg-slate-50 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${isSelected ? 'z-10 bg-sky-50 ring-2 ring-inset ring-sky-400' : ''} ${cell.inCurrentMonth ? 'text-slate-900' : 'text-slate-300'}`}
                  style={{ minHeight: `${(compact ? 108 : 132) + Math.max(0, maxWeekMarkerLane) * 30}px` }}
                >
                  {cellWeekMarkers.map((weekMarker) => {
              const lane = weekMarkerLanes.get(getWeekMarkerLaneKey(weekMarker)) ?? 0
                    const previousHasMarker = previousCell?.weekMarkers.some((marker) => marker.id === weekMarker.id) ?? false
                    const nextHasMarker = nextCell?.weekMarkers.some((marker) => marker.id === weekMarker.id) ?? false
                    const weekColor = getWeekMarkerColor(weekMarker.colorKey)
                    return (
                      <div
                        key={weekMarker.id}
                        className={`pointer-events-none absolute -left-px -right-px z-0 flex h-7 items-center ${weekColor.badgeClass} ${!previousHasMarker ? 'rounded-l-lg pl-2' : ''} ${!nextHasMarker ? 'rounded-r-lg pr-2' : ''}`}
                        style={{ top: `${44 + lane * 30}px` }}
                      >
                        {!previousHasMarker ? <span className="min-w-0 truncate text-[11px] font-semibold leading-none">Week {weekMarker.weekNum}{weekMarker.note ? ` · ${weekMarker.note}` : ''}</span> : null}
                      </div>
                    )
                  })}
                  <div className="flex items-start justify-between gap-2">
                    <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-sky-500 text-white' : isToday ? 'bg-slate-900 text-white' : cell.inCurrentMonth ? 'bg-slate-100 text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
                      {cell.day}
                    </div>
                    {(assignmentCount > 0 || eventCount > 0) ? (
                      <div className="relative z-10 flex flex-col items-end gap-1 text-[10px] font-semibold">
                        {assignmentCount > 0 ? <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">課表 {assignmentCount}</span> : null}
                        {eventCount > 0 ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">事件 {eventCount}</span> : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative z-10 space-y-2" style={{ marginTop: `${cellWeekMarkers.length > 0 ? 44 + Math.max(0, highestCellLane) * 30 : 12}px` }}>
                    {previewItems.map((item) => (
                      <div
                        key={`${cell.date}-${item.kind}-${item.id}`}
                        className={`rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-4 ${item.kind === 'assignment' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'} ${cell.inCurrentMonth ? '' : 'opacity-70'}`}
                      >
                        {item.kind === 'assignment' ? (
                          <AssignmentCalendarPreview
                            weekLabel={item.weekLabel}
                            cycleName={item.cycleName}
                            eventName={item.eventName}
                            categoryLabel={item.categoryLabel}
                            blockCode={item.blockCode}
                          />
                        ) : (
                          <>
                            <div className="truncate">{item.previewTop}</div>
                            {item.previewBottom ? <div className="mt-0.5 truncate">{item.previewBottom}</div> : null}
                          </>
                        )}
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

export function StudentCalendarPreview({ summary, href }: StudentCalendarPreviewProps) {
  const initialDate = todayIso()
  const visibleMonth = initialDate.slice(0, 7)
  const monthLabel = formatMonthLabel(visibleMonth)
  const monthlyAssignmentCount = summary.monthlyAssignmentCount
  const monthlyEventCount = summary.monthlyEventCount
  const nextAssignment = summary.nextAssignment
  const nextEvent = summary.nextEvent
  const currentCycleName = nextAssignment ? cycleNameFromAssignment(nextAssignment.cycle_name, nextAssignment.cycle_goal) : ''
  const currentWeekNumber = nextAssignment ? weekNumberLabel(nextAssignment.week_label) : '-'
  const currentTrainingDay = nextAssignment?.day_num ? `Day ${nextAssignment.day_num}` : '尚未設定'

  return (
    <article className="lab-card overflow-hidden p-7 sm:p-8">
      <div className="lab-section-heading lab-section-heading-flush flex-wrap items-end justify-between gap-3">
        <div>
          <p className="lab-eyebrow">Calendar Preview</p>
          <h2 className="lab-section-title mt-3">本月課表預覽</h2>
        </div>
      </div>

      <p className="lab-copy mt-4 px-1">首頁只保留本月摘要；需要完整查看課表、事件與回報時，再進入完整行事曆。</p>

      <div className="mt-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="lab-badge bg-slate-100 text-slate-700">{monthLabel}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="lab-eyebrow">Assignments</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{monthlyAssignmentCount}</p>
            <p className="mt-2 text-sm text-slate-500">本月課表安排</p>
          </article>
          <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="lab-eyebrow">Events</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{monthlyEventCount}</p>
            <p className="mt-2 text-sm text-slate-500">本月一般事件</p>
          </article>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4">
            <p className="lab-eyebrow">Current Cycle Name</p>
            <p className="mt-3 truncate text-base font-bold text-slate-900" title={currentCycleName || undefined}>
              {currentCycleName || '尚未設定'}
            </p>
          </article>
          <article className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4">
            <p className="lab-eyebrow">Week Number</p>
            <p className="mt-3 text-base font-bold text-slate-900">Week {currentWeekNumber}</p>
          </article>
          <article className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4">
            <p className="lab-eyebrow">Current Training Day</p>
            <p className="mt-3 text-base font-bold text-slate-900">{currentTrainingDay}</p>
          </article>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {nextAssignment ? (
            <StudentPreviewAssignmentCard assignment={nextAssignment} href={href} />
          ) : (
            <article className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
              <p className="lab-eyebrow">Next Assignment</p>
              <h3 className="mt-3 text-lg font-bold text-slate-900">下一個課表</h3>
              <p className="mt-4 text-sm text-slate-500">目前沒有即將到來的課表</p>
            </article>
          )}

          <article className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
            <p className="lab-eyebrow">Next Event</p>
            <h3 className="mt-3 text-lg font-bold text-slate-900">下一個事件</h3>
            {nextEvent ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-slate-500">{nextEvent.start_date || nextEvent.date_range || '-'}</p>
                <p className="text-base font-semibold text-slate-900">{nextEvent.event_name || '一般事件'}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">目前沒有即將到來的事件</p>
            )}
          </article>
        </div>

        <div>
          <Link href={href} className="lab-btn-secondary">
            查看完整行事曆
          </Link>
        </div>
      </div>
    </article>
  )
}

export function StudentReportSchedule({ schedule, emptyMessage, reportApiBase, title = '我的完整行事曆', allowPersonalEvents = true, showWeekMarkerPanel = false }: StudentReportScheduleProps) {
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

  const selectedDateWeekMarkers = useMemo(
    () => resolveWeekMarkers(selectedDate, scheduleState.weekMarkers),
    [scheduleState.weekMarkers, selectedDate],
  )
  const primaryWeekMarker = selectedDateWeekMarkers[0] ?? null
  const weekMarkerLanes = useMemo(() => getWeekMarkerLanes(scheduleState.weekMarkers), [scheduleState.weekMarkers])
  const maxWeekMarkerLane = useMemo(
    () => Math.max(-1, ...Array.from(weekMarkerLanes.values())),
    [weekMarkerLanes],
  )

  const monthDays = useMemo(
    () => buildMonthDays(calendarItems, visibleMonth, scheduleState.weekMarkers),
    [calendarItems, scheduleState.weekMarkers, visibleMonth],
  )

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
      <article className="lab-card overflow-hidden p-7 sm:p-8">
        <div className="lab-section-heading lab-section-heading-flush flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="lab-eyebrow">Calendar Planner</p>
            <h2 className="lab-section-title mt-3">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="lab-badge bg-white/90 text-slate-900">已選日期：{selectedDate}</span>
            <Link href="/student" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">返回 Dashboard</Link>
          </div>
        </div>

        <p className="lab-copy mt-5 px-1">用和教練端一致的月曆方式查看課表與一般事件，日期內容過多時可打開當日摘要框。</p>

        {showWeekMarkerPanel ? (
          <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 sm:p-6">
              <p className="lab-eyebrow">Calendar Week Marker</p>
              <h3 className="mt-3 text-xl font-bold text-slate-900">行事曆週期標示</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">週期由教練統一設定，團隊成員可在行事曆中查看所屬 Week。</p>
              <p className="mt-3 text-sm font-semibold text-slate-600">已選週期範圍：{primaryWeekMarker ? `${primaryWeekMarker.startDate} ～ ${primaryWeekMarker.endDate}` : '尚未設定週期'}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.6fr_1.8fr_auto]">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">開始日期<input readOnly className="lab-input" value={primaryWeekMarker?.startDate ?? selectedDate} /></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">結束日期<input readOnly className="lab-input" value={primaryWeekMarker?.endDate ?? selectedDate} /></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">Week<input readOnly className="lab-input" value={primaryWeekMarker?.weekNum ?? '1'} /></label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">備註<input readOnly className="lab-input" value={primaryWeekMarker?.note ?? '尚未設定'} /></label>
                <div className="flex items-end"><span className="lab-btn-secondary w-full !cursor-default !opacity-70">教練設定</span></div>
              </div>
              <div className="mt-5"><p className="text-sm font-semibold text-slate-700">週期顏色</p><div className="mt-3 flex flex-wrap gap-2">{WEEK_MARKER_COLORS.map((color) => <span key={color.key} className={`lab-badge ${color.chipClass} ${primaryWeekMarker?.colorKey === color.key ? 'ring-2 ring-slate-500 ring-offset-2' : ''}`}>{color.name}{primaryWeekMarker?.colorKey === color.key ? ' ✓' : ''}</span>)}</div></div>
            </div>
          </section>
        ) : null}

        <div className="mt-6">
          <CalendarMonthGrid
            visibleMonth={visibleMonth}
            monthDays={monthDays}
            selectedDate={selectedDate}
            onPreviousMonth={() => setVisibleMonth((current) => shiftMonth(current, -1))}
            onNextMonth={() => setVisibleMonth((current) => shiftMonth(current, 1))}
            onSelectDate={(cell) => selectDate(cell.date, cell.items.length > 2)}
            weekMarkerLanes={weekMarkerLanes}
            maxWeekMarkerLane={maxWeekMarkerLane}
          />
        </div>
      </article>

      <section className="space-y-6">
        <article ref={detailSectionRef} className="lab-card overflow-hidden p-7 sm:p-8">
          <div className="lab-section-heading lab-section-heading-flush flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="lab-eyebrow">Selected Day</p>
              <h2 className="lab-section-title mt-3">{selectedDate}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="lab-badge bg-white/90 text-slate-900">課表 {selectedDateAssignments.length}</span>
              <span className="lab-badge bg-white/90 text-slate-900">事件 {selectedDateEvents.length}</span>
              {selectedDateWeekMarkers.map((marker) => (
                <span key={marker.id} className={`lab-badge ${getWeekMarkerColor(marker.colorKey).chipClass}`}>
                  Week {marker.weekNum}{marker.note ? `・${marker.note}` : ''}
                </span>
              ))}
            </div>
          </div>

          <p className="lab-copy mt-5 px-1">下方顯示這一天的完整課表安排與一般事件；目前可直接回報的欄位為組數與重量，其餘欄位保留教練原始安排內容。</p>

          <div className="mt-6 space-y-4">
            {selectedDateAssignments.map((assignment) => (
              <div key={assignment.id} id={`student-assignment-detail-${assignment.id}`}>
                <StudentAssignmentCard assignment={assignment} onSaved={updateAssignmentRows} forceOpen={highlightedAssignmentId === assignment.id} reportApiBase={reportApiBase} />
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

        {allowPersonalEvents ? <article className="lab-card overflow-hidden p-7 sm:p-8">
          <div className="lab-section-heading lab-section-heading-flush !p-0">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6 sm:py-6"
              onClick={() => setIsEventFormOpen((current) => !current)}
              aria-expanded={isEventFormOpen}
            >
              <div>
                <p className="lab-eyebrow">Add Event</p>
                <h2 className="lab-section-title mt-3">新增自己的事件</h2>
              </div>
              <span className="lab-badge bg-white/90 text-slate-900" aria-hidden="true">{isEventFormOpen ? '收起' : '展開'}</span>
            </button>
          </div>

          <p className="lab-copy mt-5 px-1">沿用教練端相同風格的事件表單。新增後會寫入自己的 athlete_events，教練查看你的行事曆時也會同步看到。</p>

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
        </article> : null}
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
