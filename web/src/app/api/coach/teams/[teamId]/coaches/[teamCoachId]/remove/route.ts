import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { removeTeamCoachForCoach } from '@/services/team-programs'

export async function POST(_request: Request, { params }: { params: Promise<{ teamId: string; teamCoachId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, teamCoachId } = await params
  const parsedTeamId = Number(teamId)
  const parsedTeamCoachId = Number(teamCoachId)
  if (!Number.isFinite(parsedTeamId) || !Number.isFinite(parsedTeamCoachId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await removeTeamCoachForCoach(context.coachProfile, parsedTeamId, parsedTeamCoachId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '移除 Team 教練失敗。' }, { status: 400 })
  return NextResponse.json({ team: result.data, message: result.message ?? '已移除 Team 教練。' })
}
