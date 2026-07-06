import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createAssignmentForAthlete } from '@/services/coach-schedule-management'

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
  const result = await createAssignmentForAthlete(context.coachProfile, parsedAthleteId, {
    block_id: Number(body?.block_id),
    event_name: String(body?.event_name ?? ''),
    cycle_goal: String(body?.cycle_goal ?? ''),
    start_date: String(body?.start_date ?? ''),
    end_date: String(body?.end_date ?? ''),
    week_num: Number(body?.week_num ?? 1),
    day_num: Number(body?.day_num ?? 1),
    training_category: String(body?.training_category ?? ''),
    notes: String(body?.notes ?? ''),
  })

  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '新增課表安排失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
