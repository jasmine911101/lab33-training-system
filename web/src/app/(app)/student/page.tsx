import { AppShell } from '@/components/layout/app-shell'
import { PasswordUpdateForm } from '@/components/auth/password-update-form'
import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { StudentCalendarPreview } from '@/components/schedule/student-report-schedule'
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
      description="查看自己的課表、一般事件與回報內容。"
      role="student"
      userEmail={context.user.email}
      roleLabel="學員"
      currentPath="/student"
      hideHeaderCard
    >
      <section className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="lab-eyebrow">Logged In Experience</p>
            <h2 className="lab-section-title mt-3">{studentProfile.name ?? 'Athlete Dashboard'}</h2>
            <p className="lab-copy mt-3">以行事曆查看自己的課表與一般事件，並直接回報實際訓練狀況。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="lab-badge-info">{studentProfile.must_change_password ? '需更新密碼' : '可正常登入'}</span>
            <span className="lab-badge bg-slate-100 text-slate-700">{studentProfile.email ?? context.user.email ?? '-'}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="lab-eyebrow">Email</p>
            <p className="mt-3 text-sm font-semibold text-slate-900 break-all">{studentProfile.email ?? context.user.email ?? '-'}</p>
          </article>
          <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="lab-eyebrow">Sport</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{studentProfile.sport ?? '-'}</p>
          </article>
          <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="lab-eyebrow">Assignments</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{schedule.assignments.length} 筆</p>
          </article>
          <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="lab-eyebrow">Events</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{schedule.generalEvents.length} 筆</p>
          </article>
        </div>
      </section>

      <section className="mt-6">
        <StudentCalendarPreview schedule={schedule} href="/student/calendar" />
      </section>

      <section className="mt-6">
        <div className="lab-card p-5 sm:p-6">
          <PasswordUpdateForm
            title="修改密碼"
            description="需要時再打開修改。更新成功後，下次請使用新密碼登入。"
            successMessage="密碼已更新。下次請使用新密碼登入。"
            collapsible
            defaultOpen={false}
            surface="plain"
          />
        </div>
      </section>
    </AppShell>
  )
}
