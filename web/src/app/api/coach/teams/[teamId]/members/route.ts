import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { addTeamMembers, permanentlyRemoveTeamMembership, removeTeamMember } from '@/services/team-training'

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const body = await request.json().catch(() => null)
  const result = await addTeamMembers(context.coachProfile, Number(teamId), Array.isArray(body?.athleteIds) ? body.athleteIds.map(Number) : [])
  return NextResponse.json(result, { status: result.error ? 400 : 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const body = await request.json().catch(() => null)
  const result = body?.permanentMembershipRemoval
    ? await permanentlyRemoveTeamMembership(context.coachProfile, Number(teamId), Number(body?.athleteId))
    : await removeTeamMember(context.coachProfile, Number(teamId), Number(body?.athleteId))
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
