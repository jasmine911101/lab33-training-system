import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { createTeamScheduleAssignment } from '@/services/team-training'

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const body = await request.json().catch(() => null)
  const result = await createTeamScheduleAssignment(context.coachProfile, Number(teamId), body ?? {})
  return NextResponse.json(result, { status: result.error ? 400 : 201 })
}
