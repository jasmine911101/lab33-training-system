import { AppShell } from '@/components/layout/app-shell'
import { TeamManagementPanel } from '@/components/coach/team-management-panel'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getTeamManagementSnapshot } from '@/services/team-programs'

export default async function CoachTeamsPage() {
  const context = await requireCoachAccess('/coach/login')
  const coachProfile = context.coachProfile!
  const roleLabel = coachProfile.is_head_coach ? '總教練' : '教練'
  let snapshot: Awaited<ReturnType<typeof getTeamManagementSnapshot>> | null = null
  let error: string | null = null

  try {
    snapshot = await getTeamManagementSnapshot(coachProfile)
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : '球隊資料目前無法載入。'
  }

  return (
    <AppShell title="球隊管理" description="建立 Team、管理 roster，作為 Commerce Team Program Delivery 的基礎。" role="coach" userEmail={context.user.email} roleLabel={roleLabel} currentPath="/coach/teams">
      {snapshot ? <TeamManagementPanel teams={snapshot.teams} athleteOptions={snapshot.athleteOptions} coachOptions={snapshot.coachOptions} /> : (
        <article className="lab-card p-6 sm:p-7">
          <p className="font-semibold text-rose-600">球隊管理目前無法載入</p>
          <p className="lab-copy mt-3">{error ?? '請確認 Commerce Sprint 2 migration 已套用。'}</p>
        </article>
      )}
    </AppShell>
  )
}
