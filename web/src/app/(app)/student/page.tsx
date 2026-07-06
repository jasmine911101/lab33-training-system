import { AppShell } from '@/components/layout/app-shell'
import { PasswordUpdateForm } from '@/components/auth/password-update-form'
import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { StudentReportSchedule } from '@/components/schedule/student-report-schedule'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getAthleteScheduleBundle } from '@/services/schedule'

export default async function StudentHomePage() {
  const context = await requireStudentAccess('/student/login')
  const studentProfile = context.studentProfile

  if (!studentProfile) {
    return (
      <AppShell
        title="Student Dashboard"
        description="目前登入帳號尚未對應到 athlete profile，因此無法顯示學員端內容。"
        role="student"
        userEmail={context.user.email}
        roleLabel="學員"
        currentPath="/student"
      >
        <ProfileStatusCard
          title="找不到對應的 athlete profile"
          description="目前這個登入帳號尚未對應到 `athletes` 資料，因此無法顯示課表與學員資訊。請確認教練新增學員時填寫的 Email 和你的登入 Email 相同。"
          loginHref="/student/login"
          loginLabel="返回學員登入"
        />
      </AppShell>
    )
  }

  if (studentProfile.must_change_password) {
    return (
      <AppShell
        title="請設定新密碼"
        description="你目前使用的是臨時密碼。設定新密碼後才能查看課表。"
        role="student"
        userEmail={context.user.email}
        roleLabel="學員"
        currentPath="/student"
      >
        <section className="mx-auto max-w-2xl">
          <PasswordUpdateForm
            athleteId={studentProfile.id}
            forceReset
            title="請設定新密碼"
            description="你目前使用的是臨時密碼。更新後會清除強制改密碼狀態，之後才能正常查看自己的課表。"
            successMessage="密碼已更新。重新整理後即可正常查看課表。"
          />
        </section>
      </AppShell>
    )
  }

  const schedule = await getAthleteScheduleBundle(studentProfile.id)

  return (
    <AppShell
      title="Student Dashboard"
      description="目前保留現有身份與基本資料邏輯，並搬移自己的課表、一般事件與學員回報。這一階段先不搬 Calendar 互動。"
      role="student"
      userEmail={context.user.email}
      roleLabel="學員"
      currentPath="/student"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Profile</p>
          <p className="mt-3 font-display text-4xl leading-none text-slate-900">{studentProfile.name ?? 'Athlete'}</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Sport</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{studentProfile.sport ?? '-'}</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Assignments</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{schedule.assignments.length} 筆</p>
        </article>
        <article className="lab-stat-card">
          <p className="lab-eyebrow">Events</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{schedule.generalEvents.length} 筆</p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="lab-card p-6 sm:p-7">
          <p className="lab-eyebrow">Athlete Profile</p>
          <h2 className="lab-section-title mt-3">目前登入學員</h2>
          <p className="lab-copy mt-3">
            這裡沿用現有 Supabase Auth 帳號，自動對應 `athletes` 中的資料，不變更任何資料結構。
          </p>
          <dl className="mt-6 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between gap-4"><dt>姓名</dt><dd className="font-semibold text-slate-900">{studentProfile.name ?? '-'}</dd></div>
            <div className="flex justify-between gap-4"><dt>Email</dt><dd className="font-semibold text-slate-900">{studentProfile.email ?? context.user.email ?? '-'}</dd></div>
            <div className="flex justify-between gap-4"><dt>學員 ID</dt><dd className="font-semibold text-slate-900">{studentProfile.id}</dd></div>
            <div className="flex justify-between gap-4"><dt>運動項目</dt><dd className="font-semibold text-slate-900">{studentProfile.sport ?? '-'}</dd></div>
            <div className="flex justify-between gap-4"><dt>程度</dt><dd className="font-semibold text-slate-900">{studentProfile.level ?? '-'}</dd></div>
          </dl>
        </article>

        <PasswordUpdateForm
          title="修改密碼"
          description="需要時再打開修改。更新成功後，下次請使用新密碼登入。"
          successMessage="密碼已更新。下次請使用新密碼登入。"
        />
      </section>

      <section className="mt-6">
        <StudentReportSchedule schedule={schedule} emptyMessage="目前還沒有被安排任何課表或一般事件。" />
      </section>
    </AppShell>
  )
}
