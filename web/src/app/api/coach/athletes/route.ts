import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createAthleteForCoach } from '@/services/coach-management'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '新增學員資料格式不正確。' }, { status: 400 })
  }

  const result = await createAthleteForCoach(context.coachProfile, {
    name: String(body.name ?? ''),
    email: String(body.email ?? ''),
    sport: String(body.sport ?? ''),
    level: String(body.level ?? ''),
    assignedCoachId:
      body.assignedCoachId === null || body.assignedCoachId === undefined || body.assignedCoachId === ''
        ? null
        : Number(body.assignedCoachId),
  })

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '新增學員失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    athlete: result.data,
    message: result.message,
  })
}
