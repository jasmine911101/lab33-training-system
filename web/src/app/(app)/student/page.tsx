import { AppShell } from '@/components/layout/app-shell'
import { PasswordUpdateForm } from '@/components/auth/password-update-form'
import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { StudentCalendarPreview } from '@/components/schedule/student-report-schedule'
import { StudentDashboardHeader } from '@/components/student/student-dashboard-header'
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
      <StudentDashboardHeader
        athleteId={studentProfile.id}
        studentName={studentProfile.name ?? null}
        userEmail={studentProfile.email ?? context.user.email ?? null}
        sport={studentProfile.sport ?? null}
        mustChangePassword={Boolean(studentProfile.must_change_password)}
      />

      <section className="mt-6">
        <StudentCalendarPreview schedule={schedule} href="/student/calendar" />
      </section>
    </AppShell>
  )
}
