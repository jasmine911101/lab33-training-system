import type { ReactNode } from 'react'

import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { AppShell } from '@/components/layout/app-shell'
import type { CoachProfile } from '@/services/coach'

type CoachBlocksShellProps = {
  coachProfile: CoachProfile | null
  userEmail: string
  title: string
  description: string
  hideHeaderCard?: boolean
  children: ReactNode
}

export function CoachBlocksShell({ coachProfile, userEmail, title, description, hideHeaderCard = false, children }: CoachBlocksShellProps) {
  if (!coachProfile) {
    return (
      <AppShell
        title={title}
        description="目前登入帳號尚未對應到 coach profile，因此無法顯示板塊管理內容。"
        role="coach"
        userEmail={userEmail}
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

  return (
    <AppShell
      title={title}
      description={description}
      role="coach"
      userEmail={userEmail}
      roleLabel={roleLabel}
      currentPath="/coach/blocks"
      hideHeaderCard={hideHeaderCard}
    >
      {children}
    </AppShell>
  )
}
