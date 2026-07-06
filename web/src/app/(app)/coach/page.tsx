import { PasswordUpdateForm } from '@/components/auth/password-update-form'
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
  const athletes = managementSnapshot.athletes

  return (
    <AppShell
      title="Coach Dashboard"
      description="目前保留既有資料查詢與權限邏輯，並逐步把 LAB33 教練端功能搬移到正式網站。學員管理、行事曆安排與板塊管理已可在這裡操作。"
      role="coach"
      userEmail={context.user.email}
      roleLabel={roleLabel}
      currentPath="/coach"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Role</p>
          <p className="mt-3 font-display text-4xl leading-none text-slate-900">{roleLabel}</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Athletes</p>
          <p className="mt-3 font-display text-4xl leading-none text-slate-900">{athletes.length}</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Auth</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">Supabase Session</p>
          <p className="mt-2 text-sm text-slate-500">Route protection 保持不變</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Stage</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">Phase 9</p>
          <p className="mt-2 text-sm text-slate-500">Coach athlete + block + Excel import</p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <article className="lab-card p-6 sm:p-7">
          <p className="lab-eyebrow">Coach Profile</p>
          <h2 className="lab-section-title mt-3">教練資料</h2>
          <dl className="mt-6 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between gap-4"><dt>姓名</dt><dd className="font-semibold text-slate-900">{coachProfile.name ?? '-'}</dd></div>
            <div className="flex justify-between gap-4"><dt>Email</dt><dd className="font-semibold text-slate-900">{coachProfile.email ?? context.user.email ?? '-'}</dd></div>
            <div className="flex justify-between gap-4"><dt>身份</dt><dd className="font-semibold text-slate-900">{roleLabel}</dd></div>
            <div className="flex justify-between gap-4"><dt>可管理學員數</dt><dd className="font-semibold text-slate-900">{athletes.length}</dd></div>
          </dl>
        </article>

        <PasswordUpdateForm
          title="修改密碼"
          description="需要時再更新自己的教練端密碼。更新成功後，下次請使用新密碼登入。"
          successMessage="密碼已更新。下次請使用新密碼登入。"
        />
      </section>

      <section className="mt-6">
        <CoachAthleteManager
          initialAthletes={managementSnapshot.athletes}
          assignableCoaches={managementSnapshot.assignableCoaches}
          isHeadCoach={coachProfile.is_head_coach === true}
        />
      </section>
    </AppShell>
  )
}
