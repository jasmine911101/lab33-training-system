import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { updateTeamScheduleAssignmentContent } from '@/services/team-training'

export async function PUT(request: Request, { params }: { params: Promise<{ teamId: string; assignmentId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, assignmentId } = await params
  const body = await request.json().catch(() => null)
  const result = await updateTeamScheduleAssignmentContent(context.coachProfile, Number(teamId), Number(assignmentId), Array.isArray(body?.sections) ? body.sections : [])
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
