import { BlockTaxonomyBrowser } from '@/components/coach/block-taxonomy-browser'
import { BlockTaxonomyCreateForm } from '@/components/coach/block-taxonomy-create-form'
import { BlockTaxonomyErrorState } from '@/components/coach/block-taxonomy-error-state'
import { CoachBlocksShell } from '@/components/coach/coach-blocks-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { describeBlockTaxonomyError } from '@/services/block-taxonomy-error'
import { getTaxonomyRootSummary } from '@/services/block-taxonomy'

export default async function CoachBlocksPage() {
  const context = await requireCoachAccess('/coach/login')

  let snapshot: Awaited<ReturnType<typeof getTaxonomyRootSummary>> | null = null
  let failure: ReturnType<typeof describeBlockTaxonomyError> | null = null

  if (context.coachProfile) {
    try {
      snapshot = await getTaxonomyRootSummary()
    } catch (error) {
      failure = describeBlockTaxonomyError(error)
    }
  }

  return (
    <CoachBlocksShell
      coachProfile={context.coachProfile}
      userEmail={context.user.email ?? ''}
      title="板塊管理"
      description={failure ? '板塊分類頁面目前無法載入。' : '先從專項資料夾往下瀏覽，再進入年齡分級、訓練分類與最終板塊內容。'}
    >
      {failure ? (
        <BlockTaxonomyErrorState title={failure.title} description={failure.description} />
      ) : snapshot ? (
        <BlockTaxonomyBrowser
          eyebrow="Block Taxonomy"
          title="板塊分類"
          description="這一層先管理專項。點進專項後再進一步查看年齡分級與訓練分類。"
          entries={[
            ...snapshot.sports.map((sport) => ({
              id: sport.id,
              name: sport.name,
              href: `/coach/blocks/sport/${sport.id}`,
              meta: `${sport.ageGroupCount} 個年齡分級`,
            })),
            {
              id: 'uncategorized',
              name: '未分類',
              href: '/coach/blocks/uncategorized',
              meta: `${snapshot.uncategorizedBlockCount} 個板塊尚未分類`,
            },
          ]}
          emptyMessage="目前還沒有任何專項分類。"
          createForm={<BlockTaxonomyCreateForm actionLabel="新增專項" endpoint="/api/coach/block-taxonomy/sports" placeholder="例如：棒球、一般人、籃球" />}
        />
      ) : null}
    </CoachBlocksShell>
  )
}
