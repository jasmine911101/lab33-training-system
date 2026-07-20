import Link from 'next/link'

import { AppShell } from '@/components/layout/app-shell'
import { StudentTeamProgramDetailPanel } from '@/components/student/team-programs-panel'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getStudentTeamProgramDetail } from '@/services/team-programs'

export default async function StudentTeamProgramDetailPage({ params }: { params: Promise<{ programId: string }> }) {
  const context = await requireStudentAccess('/student/login')
  const studentProfile = context.studentProfile!
  const { programId } = await params
  const parsedProgramId = Number(programId)
  const result = Number.isFinite(parsedProgramId) ? await getStudentTeamProgramDetail(studentProfile.id, parsedProgramId) : { error: '參數不正確。' }

  return (
    <AppShell title="團隊課表內容" description="查看 Team Program Sessions，並更新自己的完成狀態。" role="student" userEmail={studentProfile.email ?? context.user.email} roleLabel="學員" currentPath="/student/team-programs">
      <div className="mb-4"><Link href="/student/team-programs" className="lab-btn-secondary">返回我的團隊課表</Link></div>
      {result.data ? <StudentTeamProgramDetailPanel initialProgram={result.data} /> : <article className="lab-card p-6 sm:p-7"><p className="font-semibold text-rose-600">無法載入團隊課表</p><p className="lab-copy mt-3">{result.error ?? '你沒有權限查看這個團隊課表。'}</p></article>}
    </AppShell>
  )
}
