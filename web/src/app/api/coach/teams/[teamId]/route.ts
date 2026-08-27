import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteTeam } from '@/services/team-training'

export async function DELETE(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const body = await request.json().catch(() => null)
  const result = await deleteTeam(context.coachProfile, Number(teamId), String(body?.confirmationName ?? ''), Array.isArray(body?.selectedBatchAccountIds) ? body.selectedBatchAccountIds.map(Number) : [])
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
