import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createWeekMarkerForAthlete } from '@/services/coach-schedule-management'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { athleteId } = await params
  const parsedAthleteId = Number(athleteId)
  if (!Number.isFinite(parsedAthleteId)) {
    return NextResponse.json({ error: '學員 ID 不正確。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const result = await createWeekMarkerForAthlete(context.coachProfile, parsedAthleteId, {
    start_date: String(body?.start_date ?? ''),
    end_date: String(body?.end_date ?? ''),
    week_num: Number(body?.week_num),
    note: String(body?.note ?? ''),
    color_key: String(body?.color_key ?? ''),
  })

  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '新增週期失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
