import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { addTeamMemberForCoach } from '@/services/team-programs'

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const parsedTeamId = Number(teamId)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const athleteId = Number(body.athleteId)
  if (!Number.isFinite(parsedTeamId) || !Number.isFinite(athleteId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await addTeamMemberForCoach(context.coachProfile, parsedTeamId, athleteId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '加入球員失敗。' }, { status: 400 })
  return NextResponse.json({ team: result.data, message: result.message }, { status: 201 })
}
