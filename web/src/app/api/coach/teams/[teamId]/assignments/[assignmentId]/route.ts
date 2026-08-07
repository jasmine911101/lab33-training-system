import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteTeamScheduleAssignment } from '@/services/team-training'

export async function DELETE(_request: Request, { params }: { params: Promise<{ teamId: string; assignmentId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, assignmentId } = await params
  const result = await deleteTeamScheduleAssignment(context.coachProfile, Number(teamId), Number(assignmentId))
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
