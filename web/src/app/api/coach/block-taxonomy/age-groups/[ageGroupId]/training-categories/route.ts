import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createTrainingCategory, getAgeGroupById } from '@/services/block-taxonomy'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ageGroupId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { ageGroupId } = await params
  const parsedAgeGroupId = Number(ageGroupId)
  if (!Number.isFinite(parsedAgeGroupId)) {
    return NextResponse.json({ error: 'ageGroupId 不正確。' }, { status: 400 })
  }

  const ageGroup = await getAgeGroupById(parsedAgeGroupId)
  if (!ageGroup) {
    return NextResponse.json({ error: '找不到這個年齡分級。' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''

  const result = await createTrainingCategory(parsedAgeGroupId, name)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '建立訓練分類失敗。' }, { status: 400 })
  }

  return NextResponse.json({ trainingCategory: result.data, message: result.message })
}
