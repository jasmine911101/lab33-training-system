import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteTeamScheduleWeekMarker } from '@/services/team-training'

export async function DELETE(_request: Request, { params }: { params: Promise<{ teamId: string; markerId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, markerId } = await params
  const result = await deleteTeamScheduleWeekMarker(context.coachProfile, Number(teamId), Number(markerId))
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
