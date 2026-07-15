import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { resetTemporaryPasswordForCoach } from '@/services/coach-management'

type RouteContext = {
  params: Promise<{
    coachId: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { context: authContext, response } = await requireCoachApiContext()
  if (response) return response

  if (!authContext.coachProfile?.is_head_coach) {
    return NextResponse.json({ error: '只有總教練可以重設教練暫時密碼。' }, { status: 403 })
  }

  const params = await context.params
  const coachId = Number(params.coachId)
  if (!Number.isFinite(coachId)) {
    return NextResponse.json({ error: '教練編號無效。' }, { status: 400 })
  }

  const result = await resetTemporaryPasswordForCoach(authContext.coachProfile, coachId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '重設教練暫時密碼失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    coach: result.data,
    message: result.message ?? '已重設教練暫時密碼。',
    tempPassword: result.tempPassword,
    temporaryPassword: result.tempPassword ?? null,
  })
}
