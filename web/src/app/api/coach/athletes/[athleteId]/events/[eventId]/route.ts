import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteGeneralEventForAthlete, updateGeneralEventForAthlete } from '@/services/coach-schedule-management'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ athleteId: string; eventId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { athleteId, eventId } = await params
  const parsedAthleteId = Number(athleteId)
  const parsedEventId = Number(eventId)
  if (!Number.isFinite(parsedAthleteId) || !Number.isFinite(parsedEventId)) {
    return NextResponse.json({ error: '一般事件 ID 不正確。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const result = await updateGeneralEventForAthlete(context.coachProfile, parsedAthleteId, parsedEventId, {
    title: String(body?.title ?? ''),
    event_type: String(body?.event_type ?? ''),
    start_date: String(body?.start_date ?? ''),
    end_date: String(body?.end_date ?? ''),
    notes: String(body?.notes ?? ''),
  })

  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '更新一般事件失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ athleteId: string; eventId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { athleteId, eventId } = await params
  const parsedAthleteId = Number(athleteId)
  const parsedEventId = Number(eventId)
  if (!Number.isFinite(parsedAthleteId) || !Number.isFinite(parsedEventId)) {
    return NextResponse.json({ error: '一般事件 ID 不正確。' }, { status: 400 })
  }

  const result = await deleteGeneralEventForAthlete(context.coachProfile, parsedAthleteId, parsedEventId)
  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '刪除一般事件失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
