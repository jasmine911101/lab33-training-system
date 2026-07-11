import Link from 'next/link'
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="lab-eyebrow">Coach Schedule Manager</p>
          <h2 className="lab-section-title mt-2">{athlete.name ?? '未命名學員'}</h2>
          <p className="lab-copy mt-3">這一頁負責教練端課表安排、一般事件與月曆選日流程；板塊模板本身則已搬到獨立的板塊管理頁面。</p>
        </div>
        <Link href="/coach" className="lab-btn-secondary">
          返回學員列表
        </Link>
      </div>

      <CoachAthleteDetailAdmin
        initialAthlete={managedAthlete}
        assignableCoaches={assignableCoaches}
        isHeadCoach={coachProfile.is_head_coach === true}
      />

      <CoachScheduleManager athleteId={athlete.id} initialSchedule={schedule} blocks={blocks} taxonomy={taxonomy} />
    </div>
  )
}
