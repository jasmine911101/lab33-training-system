import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { CoachBlockManager } from '@/components/coach/coach-block-manager'
import { AppShell } from '@/components/layout/app-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getBlockManagementSnapshot } from '@/services/block-management'

export default async function CoachBlocksPage() {
  const context = await requireCoachAccess('/coach/login')
  const coachProfile = context.coachProfile

  if (!coachProfile) {
    return (
      <AppShell
        title="板塊管理"
        description="目前登入帳號尚未對應到 coach profile，因此無法顯示板塊管理內容。"
        role="coach"
        userEmail={context.user.email}
        roleLabel="教練"
        currentPath="/coach/blocks"
      >
        <ProfileStatusCard
          title="找不到對應的 coach profile"
          description="目前這個登入帳號尚未對應到 `coaches` 資料，因此無法顯示教練端板塊內容。請使用教練帳號登入，或確認這個 Email 是否已建立教練端權限。"
          loginHref="/coach/login"
          loginLabel="返回教練登入"
        />
      </AppShell>
    )
  }

  const roleLabel = coachProfile.is_head_coach ? '總教練' : '教練'
  const snapshot = await getBlockManagementSnapshot()

  return (
    <AppShell
      title="板塊管理"
      description="搬移 Streamlit 的板塊模板管理流程。這一階段已補上手動建立、查看詳細內容、刪除板塊，以及 Excel 多工作表匯入。"
      role="coach"
      userEmail={context.user.email}
      roleLabel={roleLabel}
      currentPath="/coach/blocks"
    >
      <CoachBlockManager initialBlocks={snapshot.blocks} />
    </AppShell>
  )
}
