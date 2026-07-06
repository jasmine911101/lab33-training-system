import Link from 'next/link'
import { notFound } from 'next/navigation'

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

  const { athlete, schedule, blocks } = pageData

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="lab-stat-card"><p className="lab-eyebrow">Email</p><p className="mt-3 text-sm font-semibold text-slate-900">{athlete.email ?? '-'}</p></article>
        <article className="lab-stat-card"><p className="lab-eyebrow">Sport</p><p className="mt-3 text-sm font-semibold text-slate-900">{athlete.sport ?? '-'}</p></article>
        <article className="lab-stat-card"><p className="lab-eyebrow">Level</p><p className="mt-3 text-sm font-semibold text-slate-900">{athlete.level ?? '-'}</p></article>
        <article className="lab-stat-card"><p className="lab-eyebrow">Status</p><p className="mt-3 text-sm font-semibold text-slate-900">{athlete.must_change_password ? '需更新密碼' : '正常'}</p></article>
      </section>

      <CoachScheduleManager athleteId={athlete.id} initialSchedule={schedule} blocks={blocks} />
    </div>
  )
}
