import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createCoachForHeadCoach } from '@/services/coach-management'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response) return response

  if (!context.coachProfile?.is_head_coach) {
    return NextResponse.json({ error: '只有總教練可以新增教練。' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string
        email?: string
      }
    | null

  const result = await createCoachForHeadCoach(context.coachProfile, {
    name: body?.name ?? '',
    email: body?.email ?? '',
  })

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '新增教練失敗。' }, { status: 400 })
  }

  return NextResponse.json(
    {
      coach: result.data,
      message: result.message ?? '已新增教練。',
      authAccountStatus: result.authAccountStatus ?? null,
      tempPassword: result.tempPassword ?? null,
      temporaryPassword: result.tempPassword ?? null,
    },
    { status: 201 },
  )
}
