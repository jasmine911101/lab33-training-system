import { notFound } from 'next/navigation'

import { CoachAthleteDetailAdmin } from '@/components/coach/coach-athlete-detail-admin'
import { CoachScheduleManager } from '@/components/coach/coach-schedule-manager'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getCoachSchedulingPageData } from '@/services/coach-schedule-management'

export default async function CoachAthleteDetailPage({ params }: { params: Promise<{ athleteId: string }> }) {
  const { athleteId } = await params
  const parsedAthleteId = Number(athleteId)
  const context = await requireCoachAccess('/coach/login')
  const coachProfile = context.coachProfile!

  if (!Number.isFinite(parsedAthleteId)) {
    notFound()
  }

  const pageData = await getCoachSchedulingPageData(coachProfile, parsedAthleteId)
  if (!pageData) {
    notFound()
  }

  const { athlete, managedAthlete, assignableCoaches, schedule, blocks, taxonomy } = pageData

  return (
    <div className="space-y-6 px-4 sm:px-6 xl:px-8">
      <CoachAthleteDetailAdmin
        initialAthlete={managedAthlete}
        assignableCoaches={assignableCoaches}
        isHeadCoach={coachProfile.is_head_coach === true}
      />

      <CoachScheduleManager athleteId={athlete.id} initialSchedule={schedule} blocks={blocks} taxonomy={taxonomy} />
    </div>
  )
}
