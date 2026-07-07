import { BlockTaxonomyBrowser } from '@/components/coach/block-taxonomy-browser'
import { BlockTaxonomyErrorState } from '@/components/coach/block-taxonomy-error-state'
import { CoachBlockLibraryPanel } from '@/components/coach/coach-block-library-panel'
import { CoachBlocksShell } from '@/components/coach/coach-blocks-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getUncategorizedBlocks } from '@/services/block-management'
import { describeBlockTaxonomyError } from '@/services/block-taxonomy-error'

export default async function UncategorizedBlocksPage() {
  const context = await requireCoachAccess('/coach/login')

  let snapshot: Awaited<ReturnType<typeof getUncategorizedBlocks>> | null = null
  let failure: ReturnType<typeof describeBlockTaxonomyError> | null = null

  if (context.coachProfile) {
    try {
      snapshot = await getUncategorizedBlocks()
    } catch (error) {
      failure = describeBlockTaxonomyError(error)
    }
  }

  return (
    <CoachBlocksShell
      coachProfile={context.coachProfile}
      userEmail={context.user.email ?? ''}
      title="未分類板塊"
      description={failure ? '未分類板塊頁面目前無法載入。' : '這裡集中顯示目前尚未對應到 training category 的舊板塊。'}
    >
      {failure ? (
        <BlockTaxonomyErrorState title={failure.title} description={failure.description} />
      ) : snapshot ? (
        <div className="space-y-6">
          <BlockTaxonomyBrowser
            eyebrow="Uncategorized"
            title="未分類板塊"
            description="這一區保留所有 `training_category_id is null` 的板塊，方便之後再整理進分類資料夾。"
            breadcrumbs={[
              { label: '板塊管理', href: '/coach/blocks' },
              { label: '未分類' },
            ]}
            entries={[]}
            emptyMessage="未分類入口固定顯示，實際板塊請看下方內容。"
          />
          <CoachBlockLibraryPanel
            initialBlocks={snapshot.blocks}
            title="未分類板塊內容"
            description="這裡顯示所有尚未歸類的板塊。"
            badgeLabel="未分類"
          />
        </div>
      ) : null}
    </CoachBlocksShell>
  )
}
