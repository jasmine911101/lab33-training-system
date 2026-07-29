import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { returnDeniedPasswordResetWithAudit } from '@/lib/auth/password-reset-denial'
import { canHeadCoachResetCoach } from '@/lib/auth/password-reset-authorization'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { resetTemporaryPasswordForCoach } from '@/services/coach-management'
import { normalizePasswordResetReason } from '@/services/password-reset-audit'

type RouteContext = {
  params: Promise<{
    coachId: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params
  const coachId = Number(params.coachId)
  if (!Number.isFinite(coachId)) {
    return NextResponse.json({ error: '教練編號無效。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const reason = normalizePasswordResetReason(body?.reason)
  const { context: authContext, response } = await requireCoachApiContext()
  if (response) {
    const actor = await getAuthenticatedUser()
    return returnDeniedPasswordResetWithAudit({
      actorUserId: actor?.id,
      reason,
      response,
      targetId: coachId,
      targetType: 'coach',
    })
  }

  const actorCoach = authContext.coachProfile
  if (!actorCoach || !canHeadCoachResetCoach({
    actorIsHeadCoach: actorCoach.is_head_coach === true,
    actorCoachId: actorCoach.id,
    targetCoachId: coachId,
  })) {
    return returnDeniedPasswordResetWithAudit({
      actorUserId: authContext.user.id,
      reason,
      response: NextResponse.json({ error: '只有總教練可以重設其他教練暫時密碼。' }, { status: 403 }),
      targetId: coachId,
      targetType: 'coach',
    })
  }

  const result = await resetTemporaryPasswordForCoach(
    actorCoach,
    authContext.user.id,
    coachId,
    reason,
  )
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '重設教練暫時密碼失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    coach: result.data,
    message: result.message ?? '已重設教練暫時密碼。',
    tempPassword: result.tempPassword,
    temporaryPassword: result.tempPassword ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
