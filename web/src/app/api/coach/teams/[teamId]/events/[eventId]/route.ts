import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteTeamScheduleEvent, updateTeamScheduleEvent } from '@/services/team-training'

export async function PUT(request: Request, { params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, eventId } = await params
  const result = await updateTeamScheduleEvent(context.coachProfile, Number(teamId), Number(eventId), await request.json().catch(() => ({})))
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ teamId: string; eventId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, eventId } = await params
  const result = await deleteTeamScheduleEvent(context.coachProfile, Number(teamId), Number(eventId))
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
