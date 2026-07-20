import { notFound } from 'next/navigation'

import { BlockTaxonomyBrowser } from '@/components/coach/block-taxonomy-browser'
import { BlockTaxonomyCreateForm } from '@/components/coach/block-taxonomy-create-form'
import { BlockTaxonomyErrorState } from '@/components/coach/block-taxonomy-error-state'
import { CoachBlocksShell } from '@/components/coach/coach-blocks-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { describeBlockTaxonomyError } from '@/services/block-taxonomy-error'
import { getAgeGroupById, getSportById, getTrainingCategoriesForAgeGroup } from '@/services/block-taxonomy'

export default async function AgeGroupBlocksPage({ params }: { params: Promise<{ sportId: string; ageGroupId: string }> }) {
  const context = await requireCoachAccess('/coach/login')
  const { sportId, ageGroupId } = await params
  const parsedSportId = Number(sportId)
  const parsedAgeGroupId = Number(ageGroupId)
  if (!Number.isFinite(parsedSportId) || !Number.isFinite(parsedAgeGroupId)) notFound()

  let sport: Awaited<ReturnType<typeof getSportById>> = null
  let ageGroup: Awaited<ReturnType<typeof getAgeGroupById>> = null
  let trainingCategories: Awaited<ReturnType<typeof getTrainingCategoriesForAgeGroup>> = []
  let failure: ReturnType<typeof describeBlockTaxonomyError> | null = null

  if (context.coachProfile) {
    try {
      sport = await getSportById(parsedSportId)
      ageGroup = await getAgeGroupById(parsedAgeGroupId)
      if (!sport || !ageGroup || ageGroup.sport_id !== sport.id) notFound()
      trainingCategories = await getTrainingCategoriesForAgeGroup(ageGroup.id)
    } catch (error) {
      failure = describeBlockTaxonomyError(error)
    }
  }

  return (
    <CoachBlocksShell
      coachProfile={context.coachProfile}
      userEmail={context.user.email ?? ''}
      title={ageGroup ? `${ageGroup.name} 訓練分類` : '訓練分類'}
      description={failure ? '年齡分級頁面目前無法載入。' : '這一層管理某個年齡分級底下的訓練分類。'}
    >
      {failure ? (
        <BlockTaxonomyErrorState title={failure.title} description={failure.description} />
      ) : sport && ageGroup ? (
        <BlockTaxonomyBrowser
          eyebrow="Training Category"
          title={`${sport.name} / ${ageGroup.name}`}
          description="點進某個訓練分類後，就會看到該分類底下的板塊清單。"
          backHref={`/coach/blocks/sport/${sport.id}`}
          backLabel={`返回 ${sport.name}`}
          breadcrumbs={[
            { label: '板塊管理', href: '/coach/blocks' },
            { label: sport.name, href: `/coach/blocks/sport/${sport.id}` },
            { label: ageGroup.name },
          ]}
          entries={trainingCategories.map((trainingCategory) => ({
            id: trainingCategory.id,
            name: trainingCategory.name,
            href: `/coach/blocks/sport/${sport.id}/age/${ageGroup.id}/category/${trainingCategory.id}`,
            meta: `${trainingCategory.blockCount} 個板塊`,
            nodeType: 'training-categories' as const,
            canManage: true,
          }))}
          emptyMessage="這個年齡分級底下還沒有訓練分類。"
          createForm={<BlockTaxonomyCreateForm actionLabel="新增訓練分類" endpoint={`/api/coach/block-taxonomy/age-groups/${ageGroup.id}/training-categories`} placeholder="例如：功能性訓練、爆發力、恢復" />}
        />
      ) : null}
    </CoachBlocksShell>
  )
}
