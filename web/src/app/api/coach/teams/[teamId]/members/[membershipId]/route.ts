import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { updateTeamMembershipForCoach } from '@/services/team-programs'

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string; membershipId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, membershipId } = await params
  const parsedTeamId = Number(teamId)
  const parsedMembershipId = Number(membershipId)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const status = String(body.status ?? 'inactive')
  if (!Number.isFinite(parsedTeamId) || !Number.isFinite(parsedMembershipId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await updateTeamMembershipForCoach(context.coachProfile, parsedTeamId, parsedMembershipId, status as never)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '更新球員狀態失敗。' }, { status: 400 })
  return NextResponse.json({ team: result.data, message: result.message })
}
