import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { assignProductVersionToTeamForCoach, getTeamProgramsSnapshot } from '@/services/team-programs'

export async function GET() {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const snapshot = await getTeamProgramsSnapshot(context.coachProfile)
  return NextResponse.json(snapshot)
}

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const result = await assignProductVersionToTeamForCoach(context.coachProfile, {
    teamId: Number(body.teamId),
    productVersionId: Number(body.productVersionId),
    startDate: String(body.startDate ?? ''),
    endDate: typeof body.endDate === 'string' && body.endDate ? body.endDate : null,
    seatLimit: body.seatLimit == null || body.seatLimit === '' ? null : Number(body.seatLimit),
    timezone: typeof body.timezone === 'string' ? body.timezone : null,
  })
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '指派商品失敗。' }, { status: 400 })
  return NextResponse.json({ enrollment: result.data, message: result.message }, { status: 201 })
}
