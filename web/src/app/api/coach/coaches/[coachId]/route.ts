import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteCoachForHeadCoach, updateCoachForHeadCoach, updateCoachRoleForHeadCoach } from '@/services/coach-management'

type RouteContext = {
  params: Promise<{
    coachId: string
  }>
}

export async function PUT(request: Request, context: RouteContext) {
  const { context: authContext, response } = await requireCoachApiContext()
  if (response) return response

  if (!authContext.coachProfile?.is_head_coach) {
    return NextResponse.json({ error: '只有總教練可以編輯教練資料。' }, { status: 403 })
  }

  const params = await context.params
  const coachId = Number(params.coachId)
  if (!Number.isFinite(coachId)) {
    return NextResponse.json({ error: '教練編號無效。' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string
        email?: string
      }
    | null

  const result = await updateCoachForHeadCoach(authContext.coachProfile, coachId, {
    name: body?.name ?? '',
    email: body?.email ?? '',
  })

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '更新教練失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    coach: result.data,
    message: result.message ?? '已更新教練資料。',
  })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { context: authContext, response } = await requireCoachApiContext()
  if (response) return response

  if (!authContext.coachProfile?.is_head_coach) {
    return NextResponse.json({ error: '只有總教練可以刪除教練。' }, { status: 403 })
  }

  const params = await context.params
  const coachId = Number(params.coachId)
  if (!Number.isFinite(coachId)) {
    return NextResponse.json({ error: '教練編號無效。' }, { status: 400 })
  }

  const result = await deleteCoachForHeadCoach(authContext.coachProfile, coachId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '刪除教練失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    coachId: result.data.coachId,
    unassignedAthleteCount: result.data.unassignedAthleteCount,
    message: result.message ?? '已刪除教練資料。',
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const { context: authContext, response } = await requireCoachApiContext()
  if (response) return response

  if (!authContext.coachProfile?.is_head_coach) {
    return NextResponse.json({ error: '只有總教練可以調整教練身分。' }, { status: 403 })
  }

  const params = await context.params
  const coachId = Number(params.coachId)
  if (!Number.isFinite(coachId)) {
    return NextResponse.json({ error: '教練編號無效。' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        isHeadCoach?: boolean
      }
    | null

  if (typeof body?.isHeadCoach !== 'boolean') {
    return NextResponse.json({ error: '請提供有效的教練身分。' }, { status: 400 })
  }

  const result = await updateCoachRoleForHeadCoach(authContext.coachProfile, coachId, body.isHeadCoach)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '更新教練身分失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    coach: result.data.coach,
    message: result.message ?? '已更新教練身分。',
  })
}
