import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createAgeGroup, getSportById } from '@/services/block-taxonomy'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sportId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { sportId } = await params
  const parsedSportId = Number(sportId)
  if (!Number.isFinite(parsedSportId)) {
    return NextResponse.json({ error: 'sportId 不正確。' }, { status: 400 })
  }

  const sport = await getSportById(parsedSportId)
  if (!sport) {
    return NextResponse.json({ error: '找不到這個專項。' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''

  const result = await createAgeGroup(parsedSportId, name)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '建立年齡分級失敗。' }, { status: 400 })
  }

  return NextResponse.json({ ageGroup: result.data, message: result.message })
}
