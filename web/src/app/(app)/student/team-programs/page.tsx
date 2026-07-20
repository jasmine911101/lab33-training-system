import { AppShell } from '@/components/layout/app-shell'
import { StudentTeamProgramsPanel } from '@/components/student/team-programs-panel'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getStudentTeamPrograms } from '@/services/team-programs'

export default async function StudentTeamProgramsPage() {
  const context = await requireStudentAccess('/student/login')
  const studentProfile = context.studentProfile!
  let programs: Awaited<ReturnType<typeof getStudentTeamPrograms>> = []
  let error: string | null = null

  try {
    programs = await getStudentTeamPrograms(studentProfile.id)
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : '我的團隊課表目前無法載入。'
  }

  return (
    <AppShell title="我的團隊課表" description="查看自己所屬 Team 的有效訓練商品與完成狀態。" role="student" userEmail={studentProfile.email ?? context.user.email} roleLabel="學員" currentPath="/student/team-programs">
      {error ? <article className="lab-card p-6 sm:p-7"><p className="font-semibold text-rose-600">我的團隊課表目前無法載入</p><p className="lab-copy mt-3">{error}</p></article> : <StudentTeamProgramsPanel programs={programs} />}
    </AppShell>
  )
}
