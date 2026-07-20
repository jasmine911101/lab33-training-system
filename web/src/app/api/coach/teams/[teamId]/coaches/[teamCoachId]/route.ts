import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { updateTeamCoachForCoach } from '@/services/team-programs'

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string; teamCoachId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId, teamCoachId } = await params
  const parsedTeamId = Number(teamId)
  const parsedTeamCoachId = Number(teamCoachId)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!Number.isFinite(parsedTeamId) || !Number.isFinite(parsedTeamCoachId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await updateTeamCoachForCoach(context.coachProfile, parsedTeamId, parsedTeamCoachId, {
    role: typeof body.role === 'string' ? body.role : undefined,
    canManageRoster: typeof body.canManageRoster === 'boolean' ? body.canManageRoster : undefined,
    canManagePrograms: typeof body.canManagePrograms === 'boolean' ? body.canManagePrograms : undefined,
    canViewResults: typeof body.canViewResults === 'boolean' ? body.canViewResults : undefined,
    status: typeof body.status === 'string' ? body.status : undefined,
  })
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '更新 Team 教練失敗。' }, { status: 400 })
  return NextResponse.json({ team: result.data, message: result.message })
}
