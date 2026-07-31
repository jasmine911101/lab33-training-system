import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteTrainingCategory, updateTrainingCategory } from '@/services/block-taxonomy'

async function parseTrainingCategoryId(params: Promise<{ trainingCategoryId: string }>) {
  const { trainingCategoryId } = await params
  const parsedTrainingCategoryId = Number(trainingCategoryId)
  return Number.isFinite(parsedTrainingCategoryId) ? parsedTrainingCategoryId : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ trainingCategoryId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const trainingCategoryId = await parseTrainingCategoryId(params)
  if (trainingCategoryId == null) return NextResponse.json({ error: 'trainingCategoryId 不正確。' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const result = await updateTrainingCategory(trainingCategoryId, typeof body?.name === 'string' ? body.name : '')
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '更新訓練分類失敗。' }, { status: 400 })
  return NextResponse.json({ trainingCategory: result.data, message: result.message })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ trainingCategoryId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const trainingCategoryId = await parseTrainingCategoryId(params)
  if (trainingCategoryId == null) return NextResponse.json({ error: 'trainingCategoryId 不正確。' }, { status: 400 })
  const result = await deleteTrainingCategory(trainingCategoryId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '刪除訓練分類失敗。' }, { status: 400 })
  return NextResponse.json({ deletedId: result.data.id, message: result.message })
}
