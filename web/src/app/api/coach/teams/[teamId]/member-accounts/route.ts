import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createTeamMemberAccounts } from '@/services/team-training'

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { teamId } = await params
  const parsedTeamId = Number(teamId)
  if (!Number.isFinite(parsedTeamId)) return NextResponse.json({ error: '團隊 ID 不正確。' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const result = await createTeamMemberAccounts(context.coachProfile, parsedTeamId, {
    count: Number(body?.count),
    accountPrefix: String(body?.accountPrefix ?? ''),
  })
  return NextResponse.json(result, { status: result.error ? 400 : 201 })
}
