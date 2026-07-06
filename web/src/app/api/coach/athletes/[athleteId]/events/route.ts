import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createGeneralEventForAthlete } from '@/services/coach-schedule-management'

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
  const result = await createGeneralEventForAthlete(context.coachProfile, parsedAthleteId, {
    title: String(body?.title ?? ''),
    event_type: String(body?.event_type ?? ''),
    start_date: String(body?.start_date ?? ''),
    end_date: String(body?.end_date ?? ''),
    notes: String(body?.notes ?? ''),
  })

  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '新增一般事件失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
