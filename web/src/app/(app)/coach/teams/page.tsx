import { AppShell } from '@/components/layout/app-shell'
import { TeamTrainingManager } from '@/components/coach/team-training-manager'
import { requireCoachAccess } from '@/lib/auth/roles'
import { getCoachTeamPageData } from '@/services/team-training'

export default async function CoachTeamsPage() {
  const context = await requireCoachAccess('/coach/login')
  const data = await getCoachTeamPageData(context.coachProfile!)
  const roleLabel = context.coachProfile?.is_head_coach ? '總教練' : '教練'
  return <AppShell title="團隊課表" description="建立團隊、管理成員，並發佈所有成員共用的訓練課表。" role="coach" userEmail={context.user.email} roleLabel={roleLabel} currentPath="/coach/teams" hideHeaderCard><TeamTrainingManager initialData={data} roleLabel={roleLabel} userEmail={context.user.email} coachName={context.coachProfile?.name} /></AppShell>
}
