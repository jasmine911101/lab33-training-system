import { AppShell } from '@/components/layout/app-shell'
import { StudentQaLibrary } from '@/components/student/student-qa-library'
import { requireStudentAccess } from '@/lib/auth/roles'
import { getQaEntries } from '@/services/qa-library'

export default async function StudentQaPage() {
  const context = await requireStudentAccess('/student/login')
  let entries: Awaited<ReturnType<typeof getQaEntries>> = []
  let setupError = false
  try {
    entries = await getQaEntries()
  } catch {
    setupError = true
  }
  return <AppShell title="QA 庫" description="查看常見問題與教練提供的影片解答。" role="student" userEmail={context.user.email} roleLabel="學員" currentPath="/student/qa">{setupError ? <section className="lab-card p-6 sm:p-7"><p className="lab-notice">QA 庫正在設定中，請稍後再回來查看。</p></section> : <StudentQaLibrary entries={entries} />}</AppShell>
}
