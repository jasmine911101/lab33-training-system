import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteTeamMemberAccount } from '@/services/team-training'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; athleteId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { teamId, athleteId } = await params
  const result = await deleteTeamMemberAccount(context.coachProfile, Number(teamId), Number(athleteId))
  return NextResponse.json(result, { status: 'error' in result ? 400 : 200 })
}
