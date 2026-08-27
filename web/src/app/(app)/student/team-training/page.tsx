import { AppShell } from '@/components/layout/app-shell'
import { StudentReportSchedule } from '@/components/schedule/student-report-schedule'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getStudentTeamScheduleBundle } from '@/services/team-training'

export default async function StudentTeamTrainingPage() {
  const context = await requireStudentAccess('/student/login')
  const schedule = await getStudentTeamScheduleBundle(context.studentProfile!.id)
  return <AppShell title="團隊課表" description="查看團隊共用訓練內容，並記錄只有自己可見的實際重量與組數。" role="student" userEmail={context.user.email} roleLabel="學員" currentPath="/student/team-training"><div className="px-4 pb-8 sm:px-6 lg:px-8"><StudentReportSchedule schedule={schedule} emptyMessage="你目前尚未加入有課表安排的團隊。" reportApiBase="/api/student/team-assignments" title="團隊完整行事曆" allowPersonalEvents={false} /></div></AppShell>
}
