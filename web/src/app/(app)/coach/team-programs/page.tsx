import { AppShell } from '@/components/layout/app-shell'
import { TeamProgramsPanel } from '@/components/coach/team-programs-panel'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getTeamProgramsSnapshot } from '@/services/team-programs'

export default async function CoachTeamProgramsPage() {
  const context = await requireCoachAccess('/coach/login')
  const coachProfile = context.coachProfile!
  const roleLabel = coachProfile.is_head_coach ? '總教練' : '教練'
  let snapshot: Awaited<ReturnType<typeof getTeamProgramsSnapshot>> | null = null
  let error: string | null = null

  try {
    snapshot = await getTeamProgramsSnapshot(coachProfile)
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : '團隊課表資料目前無法載入。'
  }

  return (
    <AppShell title="團隊課表" description="查看 Product Version 指派給 Team 後產生的 Enrollment、Program 與 Sessions。" role="coach" userEmail={context.user.email} roleLabel={roleLabel} currentPath="/coach/team-programs">
      {snapshot ? <TeamProgramsPanel enrollments={snapshot.enrollments} /> : (
        <article className="lab-card p-6 sm:p-7">
          <p className="font-semibold text-rose-600">團隊課表目前無法載入</p>
          <p className="lab-copy mt-3">{error ?? '請確認 Commerce Sprint 2 migration 已套用。'}</p>
        </article>
      )}
    </AppShell>
  )
}
