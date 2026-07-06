import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { updateAssignmentContentForAthlete } from '@/services/coach-schedule-management'

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
  const result = await updateAssignmentContentForAthlete(context.coachProfile, parsedAthleteId, parsedAssignmentId, {
    sections: Array.isArray(body?.sections) ? body.sections : [],
  })

  if (result.error || !result.schedule) {
    return NextResponse.json({ error: result.error ?? '更新課表內容失敗。' }, { status: 400 })
  }

  return NextResponse.json({ message: result.message, schedule: result.schedule })
}
