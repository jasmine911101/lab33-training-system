'use client'

import { useMemo, useState } from 'react'

import { GENERAL_EVENT_TYPES, TRAINING_CATEGORIES } from '@/lib/types/schedule-management'
import type { AthleteScheduleBundle, AssignmentDetail, BlockRecord, GeneralEventDetail } from '@/services/schedule'

type ScheduleItem =
  | { kind: 'assignment'; id: string; recordId: number; startDate: string; endDate: string; title: string; meta: string }
  | { kind: 'event'; id: string; recordId: number; startDate: string; endDate: string; title: string; meta: string }

type CoachScheduleManagerProps = {
  athleteId: number
  initialSchedule: AthleteScheduleBundle
  blocks: BlockRecord[]
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

function AssignmentCard({ assignment, onUpdated, athleteId }: { assignment: AssignmentDetail; athleteId: number; onUpdated: (schedule: AthleteScheduleBundle, message?: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventName, setEventName] = useState(assignment.event_name)
  const [cycleGoal, setCycleGoal] = useState(assignment.cycle_goal)
  const [startDate, setStartDate] = useState(assignment.start_date || todayIso())
  const [endDate, setEndDate] = useState(assignment.end_date || assignment.start_date || todayIso())
  const [weekNum, setWeekNum] = useState(String(assignment.week_num ?? 1))
  const [dayNum, setDayNum] = useState(String(assignment.day_num ?? 1))
  const [trainingCategory, setTrainingCategory] = useState(assignment.training_category || TRAINING_CATEGORIES[0])
  const [notes, setNotes] = useState(assignment.coach_notes)
  const [editableSections, setEditableSections] = useState<EditableSection[]>(() => buildEditableSections(assignment))

  function resetAssignmentForm() {
    setEventName(assignment.event_name)
    setCycleGoal(assignment.cycle_goal)
    setStartDate(assignment.start_date || todayIso())
    setEndDate(assignment.end_date || assignment.start_date || todayIso())
    setWeekNum(String(assignment.week_num ?? 1))
    setDayNum(String(assignment.day_num ?? 1))
    setTrainingCategory(assignment.training_category || TRAINING_CATEGORIES[0])
    setNotes(assignment.coach_notes)
  }

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

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/assignments/${assignment.record_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          event_name: eventName,
          cycle_goal: cycleGoal,
          start_date: startDate,
          end_date: endDate,
          week_num: Number(weekNum || '1'),
          day_num: Number(dayNum || '1'),
          training_category: trainingCategory,
          notes,
        }),
      })
      onUpdated(payload.schedule, payload.message)
      setIsEditing(false)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '更新課表安排失敗。'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsSaving(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/assignments/${assignment.record_id}`, {
        method: 'DELETE',
      })
      onUpdated(payload.schedule, payload.message)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '刪除課表安排失敗。'))
    } finally {
      setIsSaving(false)
    }
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
        <div>
          <p className="lab-eyebrow">Assignment</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{assignment.block_label}</h3>
          <p className="mt-2 text-sm text-slate-500">{assignment.meta}</p>
        </div>
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
          <button
            type="button"
            className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
            onClick={() => {
              if (!isEditing) resetAssignmentForm()
              setIsEditing((value) => !value)
            }}
          >
            {isEditing ? '收起編輯' : '編輯安排'}
          </button>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setConfirmDelete((value) => !value)}>
            {confirmDelete ? '收起刪除' : '刪除安排'}
          </button>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
        <DetailMeta label="賽事 / 事件" value={assignment.event_name} />
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
        <div className="mt-6 space-y-6">
          {assignment.sections.map((section) => (
            <section key={`${assignment.id}-${section.name}`}>
              <h4 className="text-lg font-bold text-slate-900">{section.name}</h4>
              <div className="mt-3 space-y-3">
                {section.rows.map((row) => (
                  <article key={`${assignment.id}-${section.name}-${row.id || row.exercise_name}`} className="rounded-[1rem] border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h5 className="text-base font-bold text-slate-900">{row.exercise_name || '未命名動作'}</h5>
                        <p className="mt-1 text-sm text-slate-500">{[row.sets && `組數 ${row.sets}`, row.reps_or_time && `次數/時間 ${row.reps_or_time}`].filter(Boolean).join(' · ') || '未設定組數/次數'}</p>
                      </div>
                      {row.video_url ? <a href={row.video_url} target="_blank" rel="noreferrer" className="lab-badge-info">影片連結</a> : null}
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                      <DetailMeta label="工具" value={row.equipment} />
                      <DetailMeta label="強度" value={row.intensity} />
                      <DetailMeta label="重量" value={row.weight} />
                      <DetailMeta label="實際組數" value={row.actual_sets} />
                      <DetailMeta label="實際重量" value={row.actual_weight} />
                      <DetailMeta label="休息" value={row.rest} />
                      <DetailMeta label="備註" value={row.notes} />
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {isEditing ? (
        <div className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">編輯安排設定</p>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">賽事 / 事件</label>
              <input className="lab-input" value={eventName} onChange={(event) => setEventName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">週期目標</label>
              <input className="lab-input" value={cycleGoal} onChange={(event) => setCycleGoal(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">開始日期</label>
              <input type="date" className="lab-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">結束日期</label>
              <input type="date" className="lab-input" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Week</label>
              <input type="number" min="1" className="lab-input" value={weekNum} onChange={(event) => setWeekNum(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Day</label>
              <input type="number" min="1" className="lab-input" value={dayNum} onChange={(event) => setDayNum(event.target.value)} />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-semibold text-slate-700">訓練分類</label>
              <select className="lab-input" value={trainingCategory} onChange={(event) => setTrainingCategory(event.target.value)}>
                {TRAINING_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="space-y-2 xl:col-span-2">
              <label className="text-sm font-semibold text-slate-700">教練備註</label>
              <textarea className="lab-input min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary" disabled={isSaving} onClick={() => void handleSave()}>{isSaving ? '儲存中...' : '儲存安排'}</button>
            <button type="button" className="lab-btn-secondary" onClick={() => setIsEditing(false)}>取消</button>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="mt-6 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">確認要刪除這筆課表安排嗎？</p>
          <p className="mt-2">刪除後會一併移除這筆 assignment 的學員動作快照與回報內容。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary" disabled={isSaving} onClick={() => void handleDelete()}>{isSaving ? '刪除中...' : '確認刪除'}</button>
            <button type="button" className="lab-btn-secondary" onClick={() => setConfirmDelete(false)}>取消</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </article>
  )
}

function EventCard({ event, onUpdated, athleteId }: { event: GeneralEventDetail; athleteId: number; onUpdated: (schedule: AthleteScheduleBundle, message?: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    setIsSaving(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/events/${event.record_id}`, { method: 'DELETE' })
      onUpdated(payload.schedule, payload.message)
    } catch (requestError) {
      setError(apiErrorMessage(requestError, '刪除一般事件失敗。'))
    } finally {
      setIsSaving(false)
    }
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
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setConfirmDelete((value) => !value)}>{confirmDelete ? '收起刪除' : '刪除事件'}</button>
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

      {confirmDelete ? (
        <div className="mt-6 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">確認要刪除這筆一般事件嗎？</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary" disabled={isSaving} onClick={() => void handleDelete()}>{isSaving ? '刪除中...' : '確認刪除'}</button>
            <button type="button" className="lab-btn-secondary" onClick={() => setConfirmDelete(false)}>取消</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </article>
  )
}

export function CoachScheduleManager({ athleteId, initialSchedule, blocks }: CoachScheduleManagerProps) {
  const [schedule, setSchedule] = useState(initialSchedule)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayIso())
  const [visibleMonth, setVisibleMonth] = useState(todayIso().slice(0, 7))
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    blockId: String(blocks[0]?.id ?? ''),
    eventName: '',
    cycleGoal: '',
    startDate: todayIso(),
    endDate: todayIso(),
    weekNum: '1',
    dayNum: String(new Date().getDay() || 7),
    trainingCategory: TRAINING_CATEGORIES[0],
    notes: '',
  })
  const [eventForm, setEventForm] = useState<EventFormState>({
    title: '',
    eventType: GENERAL_EVENT_TYPES[0],
    startDate: todayIso(),
    endDate: todayIso(),
    notes: '',
  })

  const calendarItems = useMemo<ScheduleItem[]>(() => {
    const assignments = schedule.assignments.map((assignment) => ({
      kind: 'assignment' as const,
      id: assignment.id,
      recordId: assignment.record_id,
      startDate: assignment.start_date || assignment.date_range.split(' ~ ')[0] || todayIso(),
      endDate: assignment.end_date || assignment.start_date || assignment.date_range.split(' ~ ').slice(-1)[0] || todayIso(),
      title: assignment.block_label,
      meta: assignment.meta,
    }))
    const events = schedule.generalEvents.map((event) => ({
      kind: 'event' as const,
      id: event.id,
      recordId: event.record_id,
      startDate: event.start_date || todayIso(),
      endDate: event.end_date || event.start_date || todayIso(),
      title: event.event_name,
      meta: event.meta,
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

  const monthDays = useMemo(() => {
    const base = firstDayOfMonth(visibleMonth)
    const year = base.getFullYear()
    const month = base.getMonth()
    const firstWeekday = (base.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: Array<{ date: string; day: number; inCurrentMonth: boolean; items: ScheduleItem[] }> = []

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
  }, [calendarItems, visibleMonth])

  function applySchedule(nextSchedule: AthleteScheduleBundle, nextMessage?: string) {
    setSchedule(nextSchedule)
    setMessage(nextMessage ?? null)
    setError(null)
  }

  function selectDate(date: string) {
    setSelectedDate(date)
    setAssignmentForm((current) => ({ ...current, startDate: date, endDate: date, dayNum: String(new Date(`${date}T00:00:00`).getDay() || 7) }))
    setEventForm((current) => ({ ...current, startDate: date, endDate: date }))
  }

  async function handleCreateAssignment() {
    setIsCreatingAssignment(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string; schedule: AthleteScheduleBundle }>(`/api/coach/athletes/${athleteId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          block_id: Number(assignmentForm.blockId),
          event_name: assignmentForm.eventName,
          cycle_goal: assignmentForm.cycleGoal,
          start_date: assignmentForm.startDate,
          end_date: assignmentForm.endDate,
          week_num: Number(assignmentForm.weekNum || '1'),
          day_num: Number(assignmentForm.dayNum || '1'),
          training_category: assignmentForm.trainingCategory,
          notes: assignmentForm.notes,
        }),
      })
      applySchedule(payload.schedule, payload.message)
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
            <p className="lab-copy mt-3">先用月曆挑一天，再安排課表或新增一般事件。這一階段先完成月份瀏覽、選日預填、建立 / 編輯 / 刪除安排。</p>
          </div>
          <span className="lab-badge-primary">已選日期：{selectedDate}</span>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
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
                      onClick={() => selectDate(cell.date)}
                      className={`relative flex min-h-[132px] w-full min-w-0 flex-col bg-white p-3 text-left transition hover:z-10 hover:bg-slate-50 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${isSelected ? 'z-10 bg-orange-50 ring-2 ring-inset ring-orange-400' : ''} ${cell.inCurrentMonth ? 'text-slate-900' : 'text-slate-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${isSelected ? 'bg-orange-500 text-white' : isToday ? 'bg-slate-900 text-white' : cell.inCurrentMonth ? 'bg-slate-100 text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
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
                            className={`truncate rounded-full px-2.5 py-1 text-[11px] font-medium ${item.kind === 'assignment' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'} ${cell.inCurrentMonth ? '' : 'opacity-70'}`}
                            title={item.title}
                          >
                            {item.title}
                          </div>
                        ))}
                        {cell.items.length > 2 ? (
                          <div className="text-[11px] font-semibold text-slate-500">+{cell.items.length - 2} 筆安排</div>
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
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">選擇板塊</label>
              <select className="lab-input" value={assignmentForm.blockId} onChange={(event) => setAssignmentForm((current) => ({ ...current, blockId: event.target.value }))}>
                {blocks.map((block) => <option key={block.id} value={block.id}>{block.block_code && block.block_name ? `${block.block_code} | ${block.block_name}` : block.block_name || block.block_code || `Block ${block.id}`}</option>)}
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
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">開始日期</label><input type="date" className="lab-input" value={assignmentForm.startDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, startDate: event.target.value }))} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">結束日期</label><input type="date" className="lab-input" value={assignmentForm.endDate} onChange={(event) => setAssignmentForm((current) => ({ ...current, endDate: event.target.value }))} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Week</label><input type="number" min="1" className="lab-input" value={assignmentForm.weekNum} onChange={(event) => setAssignmentForm((current) => ({ ...current, weekNum: event.target.value }))} /></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">Day</label><input type="number" min="1" className="lab-input" value={assignmentForm.dayNum} onChange={(event) => setAssignmentForm((current) => ({ ...current, dayNum: event.target.value }))} /></div>
              <div className="space-y-2 xl:col-span-1 sm:col-span-2"><label className="text-sm font-semibold text-slate-700">訓練分類</label><select className="lab-input" value={assignmentForm.trainingCategory} onChange={(event) => setAssignmentForm((current) => ({ ...current, trainingCategory: event.target.value }))}>{TRAINING_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-semibold text-slate-700">教練備註</label><textarea className="lab-input min-h-24" value={assignmentForm.notes} onChange={(event) => setAssignmentForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <button type="button" className="lab-btn-primary w-full sm:w-auto" disabled={isCreatingAssignment || blocks.length === 0} onClick={() => void handleCreateAssignment()}>{isCreatingAssignment ? '建立中...' : '加入到這位學員課表'}</button>
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

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">Selected Day</p>
            <h2 className="lab-section-title mt-2">{selectedDate}</h2>
            <p className="lab-copy mt-3">下方只顯示覆蓋到這一天的課表安排與一般事件。</p>
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
              <AssignmentCard key={assignment.id} assignment={assignment} athleteId={athleteId} onUpdated={applySchedule} />
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
