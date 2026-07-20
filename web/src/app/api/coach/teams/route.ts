import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createTeamForCoach, getTeamManagementSnapshot } from '@/services/team-programs'

export async function GET() {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const snapshot = await getTeamManagementSnapshot(context.coachProfile)
  return NextResponse.json(snapshot)
}

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const result = await createTeamForCoach(context.coachProfile, {
    name: String(body.name ?? ''),
    description: typeof body.description === 'string' ? body.description : null,
    sportType: typeof body.sportType === 'string' ? body.sportType : null,
  })
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '建立球隊失敗。' }, { status: 400 })
  return NextResponse.json({ team: result.data, message: result.message }, { status: 201 })
}
