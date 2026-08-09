import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CoachScheduleManager } from '@/components/coach/coach-schedule-manager'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getCoachTeamSchedulePageData } from '@/services/team-training'

export default async function CoachTeamCalendarPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const context = await requireCoachAccess('/coach/login')
  const data = await getCoachTeamSchedulePageData(context.coachProfile!, Number(teamId))
  if (!data) notFound()
  return (
    <div className="space-y-6 px-4 sm:px-6 xl:px-8">
      <article className="lab-card overflow-hidden p-7 sm:p-8">
        <div className="lab-section-heading lab-section-heading-flush flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="lab-eyebrow">Team Profile</p>
            <h2 className="lab-section-title mt-3">{data.team.name}</h2>
          </div>
          <Link href="/coach/teams" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">返回團隊列表</Link>
        </div>
        <p className="mt-6 text-sm leading-7 text-slate-600">{data.team.description || '以同一份行事曆安排全隊共用課表；每位成員仍可保留自己的訓練重量與完成紀錄。'}</p>
      </article>
      <CoachScheduleManager
        athleteId={data.team.id}
        scheduleApiBase={`/api/coach/teams/${data.team.id}`}
        allowAssignmentContentEditing
        initialSchedule={data.schedule}
        blocks={data.blocks}
        taxonomy={data.taxonomy}
      />
    </div>
  )
}
