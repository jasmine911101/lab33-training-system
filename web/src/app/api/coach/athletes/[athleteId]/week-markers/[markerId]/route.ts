import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteWeekMarkerForAthlete } from '@/services/coach-schedule-management'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ athleteId: string; markerId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { athleteId, markerId } = await params
  const parsedAthleteId = Number(athleteId)
  const parsedMarkerId = Number(markerId)
  if (!Number.isFinite(parsedAthleteId) || !Number.isFinite(parsedMarkerId)) {
    return NextResponse.json({ error: '週期 ID 不正確。' }, { status: 400 })
  }

  const result = await deleteWeekMarkerForAthlete(context.coachProfile, parsedAthleteId, parsedMarkerId)
  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '刪除週期失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
