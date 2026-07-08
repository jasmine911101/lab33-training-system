import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { CoachAthleteManager } from '@/components/coach/coach-athlete-manager'
import { AppShell } from '@/components/layout/app-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getCoachManagementSnapshot } from '@/services/coach-management'

export default async function CoachHomePage() {
  const context = await requireCoachAccess('/coach/login')
  const coachProfile = context.coachProfile

  if (!coachProfile) {
    return (
      <AppShell
        title="Coach Dashboard"
        description="目前登入帳號尚未對應到 coach profile，因此無法顯示教練端內容。"
        role="coach"
        userEmail={context.user.email}
        roleLabel="教練"
        currentPath="/coach"
      >
        <ProfileStatusCard
          title="找不到對應的 coach profile"
          description="目前這個登入帳號尚未對應到 `coaches` 資料，因此無法顯示教練端內容。請使用教練帳號登入，或確認這個 Email 是否已建立教練端權限。"
          loginHref="/coach/login"
          loginLabel="返回教練登入"
        />
      </AppShell>
    )
  }

  const roleLabel = coachProfile.is_head_coach ? '總教練' : '教練'
  const managementSnapshot = await getCoachManagementSnapshot(coachProfile)

  return (
    <AppShell
      title="Coach Dashboard"
      description="這裡集中管理學員、查看已安排內容與維護教練帳號設定。"
      role="coach"
      userEmail={context.user.email}
      roleLabel={roleLabel}
      currentPath="/coach"
      hideHeaderCard
    >
      <CoachAthleteManager
        roleLabel={roleLabel}
        userEmail={context.user.email}
        coachName={coachProfile.name ?? coachProfile.email ?? null}
        currentCoachId={coachProfile.id}
        initialAthletes={managementSnapshot.athletes}
        assignableCoaches={managementSnapshot.assignableCoaches}
        isHeadCoach={coachProfile.is_head_coach === true}
      />
    </AppShell>
  )
}
