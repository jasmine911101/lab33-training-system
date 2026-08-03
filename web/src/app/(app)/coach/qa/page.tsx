import { QaLibraryManager } from '@/components/coach/qa-library-manager'
import { AppShell } from '@/components/layout/app-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getQaEntries } from '@/services/qa-library'

export default async function CoachQaPage() {
  const context = await requireCoachAccess('/coach/login')
  let entries: Awaited<ReturnType<typeof getQaEntries>> = []
  let setupError: string | null = null
  try {
    entries = await getQaEntries()
  } catch (error) {
    setupError = error instanceof Error ? error.message : 'Q&A 資料庫尚未完成設定。'
  }
  return <AppShell title="Q&A 庫" description="管理學員可查看的常見問題與影片解答。" role="coach" userEmail={context.user.email} roleLabel={context.coachProfile?.is_head_coach ? '總教練' : '教練'} currentPath="/coach/qa" hideHeaderCard>{setupError ? <section className="lab-card p-6 sm:p-7"><p className="lab-eyebrow">Setup required</p><h1 className="lab-section-title mt-3">Q&A 資料庫尚未啟用</h1><p role="alert" className="lab-notice mt-5">請先套用 `20260731100000_add_qa_library.sql` migration，完成後重新整理此頁即可使用 Q&A 庫。</p></section> : <QaLibraryManager initialEntries={entries} />}</AppShell>
}
