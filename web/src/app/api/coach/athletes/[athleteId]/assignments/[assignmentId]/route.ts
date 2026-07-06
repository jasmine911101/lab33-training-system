import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteAssignmentForAthlete, updateAssignmentForAthlete } from '@/services/coach-schedule-management'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ athleteId: string; assignmentId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { athleteId, assignmentId } = await params
  const parsedAthleteId = Number(athleteId)
  const parsedAssignmentId = Number(assignmentId)
  if (!Number.isFinite(parsedAthleteId) || !Number.isFinite(parsedAssignmentId)) {
    return NextResponse.json({ error: '課表安排 ID 不正確。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const result = await updateAssignmentForAthlete(context.coachProfile, parsedAthleteId, parsedAssignmentId, {
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
    return NextResponse.json({ error: result.error ?? '更新課表安排失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ athleteId: string; assignmentId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { athleteId, assignmentId } = await params
  const parsedAthleteId = Number(athleteId)
  const parsedAssignmentId = Number(assignmentId)
  if (!Number.isFinite(parsedAthleteId) || !Number.isFinite(parsedAssignmentId)) {
    return NextResponse.json({ error: '課表安排 ID 不正確。' }, { status: 400 })
  }

  const result = await deleteAssignmentForAthlete(context.coachProfile, parsedAthleteId, parsedAssignmentId)
  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '刪除課表安排失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
