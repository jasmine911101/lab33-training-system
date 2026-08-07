import { PasswordUpdateForm } from '@/components/auth/password-update-form'
import { ProfileStatusCard } from '@/components/auth/profile-status-card'
import { StudentReportSchedule } from '@/components/schedule/student-report-schedule'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getAthleteScheduleBundle } from '@/services/schedule'
import { getStudentTeamScheduleBundle } from '@/services/team-training'

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

  // 團隊帳號沿用一般學員的完整行事曆；只將資料換成團隊共用課表。
  const teamSchedule = await getStudentTeamScheduleBundle(studentProfile.id)
  const isTeamAthlete = teamSchedule.assignments.length > 0
  const schedule = isTeamAthlete ? teamSchedule : await getAthleteScheduleBundle(studentProfile.id)

  return (
    <div className="lab-page px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <StudentReportSchedule
          schedule={schedule}
          emptyMessage={isTeamAthlete ? '目前還沒有被安排任何團隊課表。' : '目前還沒有被安排任何課表或一般事件。'}
          reportApiBase={isTeamAthlete ? '/api/student/team-assignments' : undefined}
        />
      </div>
    </div>
  )
}
