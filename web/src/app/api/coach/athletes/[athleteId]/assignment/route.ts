import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { getAccessibleManagedAthleteForCoach, replaceAthleteCoachAssignments } from '@/services/coach-management'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  if (!context.coachProfile.is_head_coach) {
    return NextResponse.json({ error: '只有總教練可以調整學員指派。' }, { status: 403 })
  }

  const { athleteId } = await params
  const parsedAthleteId = Number(athleteId)
  if (!Number.isFinite(parsedAthleteId)) {
    return NextResponse.json({ error: '學員 ID 不正確。' }, { status: 400 })
  }

  const athlete = await getAccessibleManagedAthleteForCoach(context.coachProfile, parsedAthleteId)
  if (!athlete) {
    return NextResponse.json({ error: '找不到可操作的學員。' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const selectedCoachIds = Array.isArray(body?.coachIds) ? body.coachIds.map(Number) : []

  const result = await replaceAthleteCoachAssignments(athlete.id, selectedCoachIds)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '更新教練指派失敗。' }, { status: 400 })
  }

  return NextResponse.json({ athlete: result.data, message: result.message })
}
