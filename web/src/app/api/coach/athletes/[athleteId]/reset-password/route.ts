import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { getAccessibleManagedAthleteForCoach, resetTemporaryPasswordForAthlete } from '@/services/coach-management'

export async function POST(
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

  const result = await resetTemporaryPasswordForAthlete(athlete)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '重設臨時密碼失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    athlete: result.data,
    message: result.message,
    tempPassword: result.tempPassword,
  })
}
