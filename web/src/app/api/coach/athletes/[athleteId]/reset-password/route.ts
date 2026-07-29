import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { returnDeniedPasswordResetWithAudit } from '@/lib/auth/password-reset-denial'
import { canCoachResetManagedAthlete } from '@/lib/auth/password-reset-authorization'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { getAccessibleManagedAthleteForCoach, resetTemporaryPasswordForAthlete } from '@/services/coach-management'
import { normalizePasswordResetReason } from '@/services/password-reset-audit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  const { athleteId } = await params
  const parsedAthleteId = Number(athleteId)
  if (!Number.isFinite(parsedAthleteId)) {
    return NextResponse.json({ error: '學員 ID 不正確。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const reason = normalizePasswordResetReason(body?.reason)
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    const actor = await getAuthenticatedUser()
    return returnDeniedPasswordResetWithAudit({
      actorUserId: actor?.id,
      reason,
      response: response as NextResponse,
      targetId: parsedAthleteId,
      targetType: 'athlete',
    })
  }

  const athlete = await getAccessibleManagedAthleteForCoach(context.coachProfile, parsedAthleteId)
  if (!athlete || !canCoachResetManagedAthlete({ hasCoachAccess: Boolean(context.coachProfile), targetIsManaged: true })) {
    return returnDeniedPasswordResetWithAudit({
      actorUserId: context.user.id,
      reason,
      response: NextResponse.json({ error: '找不到可操作的學員。' }, { status: 404 }),
      targetId: parsedAthleteId,
      targetType: 'athlete',
    })
  }

  const result = await resetTemporaryPasswordForAthlete(
    athlete,
    context.user.id,
    reason,
  )
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '重設臨時密碼失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    athlete: result.data,
    message: result.message,
    tempPassword: result.tempPassword,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
