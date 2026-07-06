'use client'

import { useMemo, useState } from 'react'

import type { AthleteScheduleBundle, AssignmentDetail, ExerciseRow, GeneralEventDetail } from '@/services/schedule'

function DetailMeta({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="rounded-[1rem] bg-white px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}

type EditableExerciseRow = ExerciseRow

type AssignmentCardProps = {
  assignment: AssignmentDetail
}

function copySections(assignment: AssignmentDetail) {
  return assignment.sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({ ...row })),
  }))
}

function ExerciseEditor({ row, onChange }: { row: EditableExerciseRow; onChange: (field: keyof EditableExerciseRow, value: string) => void }) {
  const inputClass = 'lab-input !min-h-11 px-4 py-3 text-sm'

  if (!row.can_report) {
    return (
      <article className="rounded-[1rem] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h5 className="text-base font-bold text-slate-900">{row.exercise_name || '未命名動作'}</h5>
            <p className="mt-1 text-sm text-slate-500">這筆內容目前只有模板資料，尚未建立可儲存的學員專屬回報列。</p>
          </div>
          <span className="lab-badge-warning">僅可查看</span>
        </div>
        <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
          <DetailMeta label="組數" value={row.sets} />
          <DetailMeta label="次數 / 時間" value={row.reps_or_time} />
          <DetailMeta label="工具" value={row.equipment} />
          <DetailMeta label="強度" value={row.intensity} />
          <DetailMeta label="重量" value={row.weight} />
          <DetailMeta label="實際組數" value={row.actual_sets} />
          <DetailMeta label="實際重量" value={row.actual_weight} />
          <DetailMeta label="休息" value={row.rest} />
          <DetailMeta label="影片連結" value={row.video_url} />
          <DetailMeta label="備註" value={row.notes} />
        </dl>
      </article>
    )
  }

  return (
    <article className="rounded-[1rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-base font-bold text-slate-900">{row.exercise_name || '未命名動作'}</h5>
          <p className="mt-1 text-sm text-slate-500">可直接修改這筆動作的安排內容與學員實際回報。</p>
        </div>
        <span className="lab-badge-info">可回報</span>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">動作</label>
          <input className={inputClass} value={row.exercise_name} onChange={(event) => onChange('exercise_name', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">組數</label>
          <input className={inputClass} value={row.sets} onChange={(event) => onChange('sets', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">次數 / 時間</label>
          <input className={inputClass} value={row.reps_or_time} onChange={(event) => onChange('reps_or_time', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">工具</label>
          <input className={inputClass} value={row.equipment} onChange={(event) => onChange('equipment', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">強度</label>
          <input className={inputClass} value={row.intensity} onChange={(event) => onChange('intensity', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">重量</label>
          <input className={inputClass} value={row.weight} onChange={(event) => onChange('weight', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">實際組數</label>
          <input className={inputClass} value={row.actual_sets} onChange={(event) => onChange('actual_sets', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">實際重量</label>
          <input className={inputClass} value={row.actual_weight} onChange={(event) => onChange('actual_weight', event.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">休息時間</label>
          <input className={inputClass} value={row.rest} onChange={(event) => onChange('rest', event.target.value)} />
        </div>
        <div className="space-y-2 xl:col-span-2">
          <label className="text-sm font-semibold text-slate-700">影片連結</label>
          <input className={inputClass} value={row.video_url} onChange={(event) => onChange('video_url', event.target.value)} />
        </div>
        <div className="space-y-2 xl:col-span-2">
          <label className="text-sm font-semibold text-slate-700">備註</label>
          <textarea className="lab-input min-h-28 px-4 py-3 text-sm" value={row.notes} onChange={(event) => onChange('notes', event.target.value)} />
        </div>
      </div>
    </article>
  )
}

function StudentAssignmentReportCard({ assignment }: AssignmentCardProps) {
  const [sections, setSections] = useState(() => copySections(assignment))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reportableRows = useMemo(() => sections.flatMap((section) => section.rows.filter((row) => row.can_report)), [sections])

  function updateRow(rowId: string, field: keyof EditableExerciseRow, value: string) {
    setSections((current) =>
      current.map((section) => ({
        ...section,
        rows: section.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
      })),
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
            exercise_name: row.exercise_name,
            sets: row.sets,
            reps_or_time: row.reps_or_time,
            equipment: row.equipment,
            intensity: row.intensity,
            weight: row.weight,
            actual_sets: row.actual_sets,
            actual_weight: row.actual_weight,
            rest: row.rest,
            video_url: row.video_url,
            notes: row.notes,
          })),
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? '儲存訓練回報失敗。')
      }

      setMessage(payload?.message ?? '已儲存訓練回報。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '儲存訓練回報失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="lab-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="lab-eyebrow">Assignment Detail</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{assignment.block_label}</h3>
          <p className="mt-2 text-sm text-slate-500">{assignment.meta}</p>
        </div>
        <span className="lab-badge-primary">可回報課表</span>
      </div>

      {(assignment.event_name || assignment.date_range) ? (
        <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
          <DetailMeta label="賽事 / 事件" value={assignment.event_name} />
          <DetailMeta label="日期" value={assignment.date_range} />
          <DetailMeta label="週期目標" value={assignment.cycle_goal} />
          <DetailMeta label="訓練元素" value={assignment.training_element} />
        </dl>
      ) : null}

      {(assignment.goal || assignment.description || assignment.coach_notes) ? (
        <div className="mt-5 space-y-3">
          {assignment.goal ? <div className="rounded-[1rem] bg-blue-50 px-4 py-4 text-sm leading-7 text-blue-900"><strong>目標：</strong>{assignment.goal}</div> : null}
          {assignment.description ? <div className="rounded-[1rem] bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700"><strong>描述：</strong>{assignment.description}</div> : null}
          {assignment.coach_notes ? <div className="rounded-[1rem] bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900"><strong>教練備註：</strong>{assignment.coach_notes}</div> : null}
        </div>
      ) : null}

      {assignment.sections.length === 0 ? (
        <div className="lab-card-muted mt-5 px-4 py-4 text-sm text-slate-600">{assignment.empty_message}</div>
      ) : (
        <div className="mt-6 space-y-6">
          {sections.map((section) => (
            <section key={`${assignment.id}-${section.name}`}>
              <h4 className="text-lg font-bold text-slate-900">{section.name}</h4>
              <div className="mt-3 space-y-3">
                {section.rows.map((row) => (
                  <ExerciseEditor key={`${assignment.id}-${section.name}-${row.id || row.exercise_name}`} row={row} onChange={(field, value) => updateRow(row.id, field, value)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="mt-5 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="lab-btn-primary w-full sm:w-auto" disabled={isSaving || reportableRows.length === 0} onClick={() => void handleSave()}>
          {isSaving ? '儲存中...' : '儲存回報'}
        </button>
        {reportableRows.length === 0 ? <span className="lab-badge-warning">這筆課表目前沒有可儲存的學員專屬動作內容</span> : null}
      </div>
    </article>
  )
}

function GeneralEventCard({ event }: { event: GeneralEventDetail }) {
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
        <DetailMeta label="日期" value={event.date_range} />
        <DetailMeta label="說明" value={event.description} />
      </div>
      {!event.description ? <div className="lab-card-muted mt-5 px-4 py-4 text-sm text-slate-600">{event.empty_message}</div> : null}
    </article>
  )
}

export function StudentReportSchedule({ schedule, emptyMessage }: { schedule: AthleteScheduleBundle; emptyMessage: string }) {
  const hasAssignments = schedule.assignments.length > 0
  const hasEvents = schedule.generalEvents.length > 0

  if (!hasAssignments && !hasEvents) {
    return <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">{emptyMessage}</div>
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">Assignments</p>
            <h2 className="lab-section-title mt-2">課表內容與學員回報</h2>
          </div>
          <span className="lab-badge-primary">{schedule.assignments.length} 筆</span>
        </div>
        {hasAssignments ? (
          <div className="space-y-4">
            {schedule.assignments.map((assignment) => (
              <StudentAssignmentReportCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        ) : (
          <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">目前沒有課表安排。</div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">General Events</p>
            <h2 className="lab-section-title mt-2">一般事件</h2>
          </div>
          <span className="lab-badge-success">{schedule.generalEvents.length} 筆</span>
        </div>
        {hasEvents ? (
          <div className="space-y-4">
            {schedule.generalEvents.map((event) => (
              <GeneralEventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">目前沒有一般事件。</div>
        )}
      </section>
    </div>
  )
}
