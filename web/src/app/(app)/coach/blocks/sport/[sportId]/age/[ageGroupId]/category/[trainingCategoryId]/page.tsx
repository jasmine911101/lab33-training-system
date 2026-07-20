import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BlockTaxonomyErrorState } from '@/components/coach/block-taxonomy-error-state'
import { CoachCategoryBlockImport } from '@/components/coach/coach-category-block-import'
import { CoachCategoryBlockManual } from '@/components/coach/coach-category-block-manual'
import { CoachBlockLibraryPanel } from '@/components/coach/coach-block-library-panel'
import { CoachBlocksShell } from '@/components/coach/coach-blocks-shell'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getBlocksByTrainingCategoryId } from '@/services/block-management'
import { describeBlockTaxonomyError } from '@/services/block-taxonomy-error'
import { getAgeGroupById, getSportById, getTrainingCategoryById } from '@/services/block-taxonomy'

export default async function TrainingCategoryBlocksPage({
  params,
}: {
  params: Promise<{ sportId: string; ageGroupId: string; trainingCategoryId: string }>
}) {
  const context = await requireCoachAccess('/coach/login')
  const { sportId, ageGroupId, trainingCategoryId } = await params
  const parsedSportId = Number(sportId)
  const parsedAgeGroupId = Number(ageGroupId)
  const parsedTrainingCategoryId = Number(trainingCategoryId)
  if (!Number.isFinite(parsedSportId) || !Number.isFinite(parsedAgeGroupId) || !Number.isFinite(parsedTrainingCategoryId)) notFound()

  let sport: Awaited<ReturnType<typeof getSportById>> = null
  let ageGroup: Awaited<ReturnType<typeof getAgeGroupById>> = null
  let trainingCategory: Awaited<ReturnType<typeof getTrainingCategoryById>> = null
  let snapshot: Awaited<ReturnType<typeof getBlocksByTrainingCategoryId>> | null = null
  let failure: ReturnType<typeof describeBlockTaxonomyError> | null = null

  if (context.coachProfile) {
    try {
      sport = await getSportById(parsedSportId)
      ageGroup = await getAgeGroupById(parsedAgeGroupId)
      trainingCategory = await getTrainingCategoryById(parsedTrainingCategoryId)
      if (!sport || !ageGroup || !trainingCategory || ageGroup.sport_id !== sport.id || trainingCategory.age_group_id !== ageGroup.id) {
        notFound()
      }
      snapshot = await getBlocksByTrainingCategoryId(trainingCategory.id)
    } catch (error) {
      failure = describeBlockTaxonomyError(error)
    }
  }

  return (
    <CoachBlocksShell
      coachProfile={context.coachProfile}
      userEmail={context.user.email ?? ''}
      title={trainingCategory ? `${trainingCategory.name} 板塊` : '板塊清單'}
      description={failure ? '訓練分類頁面目前無法載入。' : '這裡顯示指定訓練分類底下的板塊內容。'}
      hideHeaderCard
    >
      {failure ? (
        <BlockTaxonomyErrorState title={failure.title} description={failure.description} />
      ) : sport && ageGroup && trainingCategory && snapshot ? (
        <div className="space-y-6">
          <article className="lab-card overflow-hidden p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:gap-4">
              <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link href="/coach/blocks" className="hover:text-slate-900">板塊管理</Link>
                <span>/</span>
                <Link href={`/coach/blocks/sport/${sport.id}`} className="hover:text-slate-900">{sport.name}</Link>
                <span>/</span>
                <Link href={`/coach/blocks/sport/${sport.id}/age/${ageGroup.id}`} className="hover:text-slate-900">{ageGroup.name}</Link>
                <span>/</span>
                <span className="font-semibold text-slate-900">{trainingCategory.name}</span>
              </nav>

              <Link href={`/coach/blocks/sport/${sport.id}/age/${ageGroup.id}`} className="inline-flex text-sm font-semibold text-slate-600 hover:text-orange-600">
                ← 返回 {ageGroup.name}
              </Link>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{trainingCategory.name} 板塊</h1>
                  <p className="lab-copy mt-2">
                    目前顯示 {sport.name} / {ageGroup.name} / {trainingCategory.name} 底下的板塊。Excel 匯入與手動建立都會自動套用目前分類。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span className={context.coachProfile?.is_head_coach ? 'lab-badge bg-violet-100 text-violet-700' : 'lab-badge-primary'}>
                    {context.coachProfile?.is_head_coach ? '總教練' : '教練'}
                  </span>
                  <span className="lab-badge bg-slate-100 text-slate-600">{context.user.email ?? ''}</span>
                </div>
              </div>
            </div>
          </article>
          <CoachCategoryBlockImport
            trainingCategoryId={trainingCategory.id}
            categoryName={trainingCategory.name}
          />
          <CoachCategoryBlockManual
            trainingCategoryId={trainingCategory.id}
            categoryName={trainingCategory.name}
          />
          <CoachBlockLibraryPanel
            initialBlocks={snapshot.blocks}
            title={`${trainingCategory.name} 板塊列表`}
            description={`目前只顯示 ${sport.name} / ${ageGroup.name} / ${trainingCategory.name} 底下的板塊。`}
            badgeLabel="分類葉節點"
          />
        </div>
      ) : null}
    </CoachBlocksShell>
  )
}
