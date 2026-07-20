import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { transitionTeamEnrollmentForCoach } from '@/services/team-programs'

export async function POST(_request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const { enrollmentId } = await params
  const parsedEnrollmentId = Number(enrollmentId)
  if (!Number.isFinite(parsedEnrollmentId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await transitionTeamEnrollmentForCoach(context.coachProfile, parsedEnrollmentId, 'cancel')
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '取消 enrollment 失敗。' }, { status: 400 })
  return NextResponse.json({ enrollment: result.data, message: result.message })
}
