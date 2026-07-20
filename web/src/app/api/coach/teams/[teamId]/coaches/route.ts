import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { addTeamCoachForCoach, getTeamCoachesForCoach } from '@/services/team-programs'

export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const parsedTeamId = Number(teamId)
  if (!Number.isFinite(parsedTeamId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await getTeamCoachesForCoach(context.coachProfile, parsedTeamId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '讀取 Team 教練失敗。' }, { status: 400 })
  return NextResponse.json(result.data)
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { teamId } = await params
  const parsedTeamId = Number(teamId)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!Number.isFinite(parsedTeamId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await addTeamCoachForCoach(context.coachProfile, parsedTeamId, {
    coachId: Number(body.coachId),
    role: typeof body.role === 'string' ? body.role : undefined,
    canManageRoster: typeof body.canManageRoster === 'boolean' ? body.canManageRoster : undefined,
    canManagePrograms: typeof body.canManagePrograms === 'boolean' ? body.canManagePrograms : undefined,
    canViewResults: typeof body.canViewResults === 'boolean' ? body.canViewResults : undefined,
  })
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '新增 Team 教練失敗。' }, { status: 400 })
  return NextResponse.json({ team: result.data, message: result.message }, { status: 201 })
}
