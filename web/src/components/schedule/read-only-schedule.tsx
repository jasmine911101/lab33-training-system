import { normalizeExternalUrl } from '@/lib/external-url'
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

function ExerciseRowCard({ row }: { row: ExerciseRow }) {
  return (
    <article className="rounded-[1rem] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-base font-bold text-slate-900">{row.exercise_name || '未命名動作'}</h5>
          <p className="mt-1 text-sm text-slate-500">{[row.sets && `組數 ${row.sets}`, row.reps_or_time && `次數/時間 ${row.reps_or_time}`].filter(Boolean).join(' · ') || '未設定組數/次數'}</p>
        </div>
        {normalizeExternalUrl(row.video_url) ? (
          <a href={normalizeExternalUrl(row.video_url) ?? undefined} target="_blank" rel="noreferrer" className="lab-badge-info">
            影片連結
          </a>
        ) : null}
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
  )
}

function AssignmentCard({ assignment }: { assignment: AssignmentDetail }) {
  return (
    <article className="lab-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="lab-eyebrow">Assignment Detail</p>
          <h3 className="mt-3 text-2xl font-bold text-slate-900">{assignment.block_label}</h3>
          <p className="mt-2 text-sm text-slate-500">{assignment.meta}</p>
        </div>
        <span className="lab-badge-primary">課表安排</span>
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
          {assignment.sections.map((section) => (
            <section key={`${assignment.id}-${section.name}`}>
              <h4 className="text-lg font-bold text-slate-900">{section.name}</h4>
              <div className="mt-3 space-y-3">
                {section.rows.map((row) => (
                  <ExerciseRowCard key={`${assignment.id}-${section.name}-${row.id || row.exercise_name}`} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
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

export function ReadOnlySchedule({ schedule, emptyMessage }: { schedule: AthleteScheduleBundle; emptyMessage: string }) {
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
            <h2 className="lab-section-title mt-2">課表內容</h2>
          </div>
          <span className="lab-badge-primary">{schedule.assignments.length} 筆</span>
        </div>
        {hasAssignments ? (
          <div className="space-y-4">
            {schedule.assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
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
