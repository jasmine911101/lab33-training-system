import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteAthleteForCoach, getAccessibleManagedAthleteForCoach } from '@/services/coach-management'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
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

  const result = await deleteAthleteForCoach(athlete)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '刪除學員失敗。' }, { status: 400 })
  }

  return NextResponse.json({ athleteId: result.data.athleteId, message: result.message })
}
