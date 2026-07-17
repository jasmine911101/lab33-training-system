import Link from 'next/link'

import { LogoutButton } from '@/components/auth/logout-button'
import { PasswordUpdateForm } from '@/components/auth/password-update-form'
import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { StudentReportSchedule } from '@/components/schedule/student-report-schedule'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getAthleteScheduleBundle } from '@/services/schedule'

export default async function StudentCalendarPage() {
  const context = await requireStudentAccess('/student/login')
  const studentProfile = context.studentProfile

  if (!studentProfile) {
    return (
      <div className="lab-page px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-4xl">
          <ProfileStatusCard
            title="找不到對應的 athlete profile"
            description="目前這個登入帳號尚未對應到 `athletes` 資料，因此無法顯示完整行事曆。請確認教練新增學員時填寫的 Email 和你的登入 Email 相同。"
            loginHref="/student/login"
            loginLabel="返回學員登入"
          />
        </div>
      </div>
    )
  }

  const requiresPasswordReset = Boolean(studentProfile.must_change_password) && !context.isGoogleSession

  if (requiresPasswordReset) {
    return (
      <div className="lab-page px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-2xl">
          <PasswordUpdateForm
            athleteId={studentProfile.id}
            forceReset
            title="請設定新密碼"
            description="你目前使用的是臨時密碼。更新後會清除強制改密碼狀態，之後才能正常查看自己的課表。"
            successMessage="密碼已更新，正在帶你進入學員端。"
            redirectTo="/student"
          />
        </div>
      </div>
    )
  }

  const schedule = await getAthleteScheduleBundle(studentProfile.id)

  return (
    <div className="lab-page px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <section className="lab-card p-6 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <p className="lab-eyebrow">Full Calendar</p>
              <h1 className="lab-section-title mt-3">我的完整行事曆</h1>
              <p className="lab-copy mt-3">
                這個頁面直接使用接近教練端單一學員頁的大型 Calendar Planner 版面，方便完整查看課表、一般事件與運動回報。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="lab-badge-info">學員</span>
                <span className="lab-badge bg-slate-100 text-slate-700">{studentProfile.name ?? '未命名學員'}</span>
                <span className="lab-badge bg-slate-100 text-slate-700">{studentProfile.email ?? context.user.email ?? '-'}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 xl:justify-end">
              <Link href="/student" className="lab-btn-secondary">
                返回 Dashboard
              </Link>
              <LogoutButton />
            </div>
          </div>
        </section>

        <StudentReportSchedule schedule={schedule} emptyMessage="目前還沒有被安排任何課表或一般事件。" />
      </div>
    </div>
  )
}
