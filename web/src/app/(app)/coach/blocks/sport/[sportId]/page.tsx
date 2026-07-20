import { notFound } from 'next/navigation'

import { BlockTaxonomyBrowser } from '@/components/coach/block-taxonomy-browser'
import { BlockTaxonomyCreateForm } from '@/components/coach/block-taxonomy-create-form'
import { BlockTaxonomyErrorState } from '@/components/coach/block-taxonomy-error-state'
import { CoachBlocksShell } from '@/components/coach/coach-blocks-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { describeBlockTaxonomyError } from '@/services/block-taxonomy-error'
import { getAgeGroupsForSport, getSportById } from '@/services/block-taxonomy'

export default async function SportBlocksPage({ params }: { params: Promise<{ sportId: string }> }) {
  const context = await requireCoachAccess('/coach/login')
  const { sportId } = await params
  const parsedSportId = Number(sportId)
  if (!Number.isFinite(parsedSportId)) notFound()

  let sport: Awaited<ReturnType<typeof getSportById>> = null
  let ageGroups: Awaited<ReturnType<typeof getAgeGroupsForSport>> = []
  let failure: ReturnType<typeof describeBlockTaxonomyError> | null = null

  if (context.coachProfile) {
    try {
      sport = await getSportById(parsedSportId)
      if (!sport) notFound()
      ageGroups = await getAgeGroupsForSport(sport.id)
    } catch (error) {
      failure = describeBlockTaxonomyError(error)
    }
  }

  return (
    <CoachBlocksShell
      coachProfile={context.coachProfile}
      userEmail={context.user.email ?? ''}
      title={sport ? `${sport.name} 板塊分類` : '板塊分類'}
      description={failure ? '專項分類頁面目前無法載入。' : '在這一層管理某個專項底下的年齡分級。'}
    >
      {failure ? (
        <BlockTaxonomyErrorState title={failure.title} description={failure.description} />
      ) : sport ? (
        <BlockTaxonomyBrowser
          eyebrow="Sport"
          title={sport.name}
          description="點進某個年齡分級後，就能看到對應的訓練分類資料夾。"
          backHref="/coach/blocks"
          backLabel="返回板塊管理首頁"
          breadcrumbs={[
            { label: '板塊管理', href: '/coach/blocks' },
            { label: sport.name },
          ]}
          entries={ageGroups.map((ageGroup) => ({
            id: ageGroup.id,
            name: ageGroup.name,
            href: `/coach/blocks/sport/${sport.id}/age/${ageGroup.id}`,
            meta: `${ageGroup.trainingCategoryCount} 個訓練分類`,
            nodeType: 'age-groups' as const,
            canManage: true,
          }))}
          emptyMessage="這個專項底下還沒有年齡分級。"
          createForm={<BlockTaxonomyCreateForm actionLabel="新增年齡分級" endpoint={`/api/coach/block-taxonomy/sports/${sport.id}/age-groups`} placeholder="例如：成人、大學生、高中" />}
        />
      ) : null}
    </CoachBlocksShell>
  )
}
