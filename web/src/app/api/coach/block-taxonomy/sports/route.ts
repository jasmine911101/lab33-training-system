import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createSport } from '@/services/block-taxonomy'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''

  const result = await createSport(name)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '建立專項失敗。' }, { status: 400 })
  }

  return NextResponse.json({ sport: result.data, message: result.message })
}
