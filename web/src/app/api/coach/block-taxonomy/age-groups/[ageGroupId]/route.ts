import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteAgeGroup, updateAgeGroup } from '@/services/block-taxonomy'

async function parseAgeGroupId(params: Promise<{ ageGroupId: string }>) {
  const { ageGroupId } = await params
  const parsedAgeGroupId = Number(ageGroupId)
  return Number.isFinite(parsedAgeGroupId) ? parsedAgeGroupId : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ ageGroupId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const ageGroupId = await parseAgeGroupId(params)
  if (ageGroupId == null) return NextResponse.json({ error: 'ageGroupId 不正確。' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const result = await updateAgeGroup(ageGroupId, typeof body?.name === 'string' ? body.name : '')
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '更新年齡分級失敗。' }, { status: 400 })
  return NextResponse.json({ ageGroup: result.data, message: result.message })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ ageGroupId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const ageGroupId = await parseAgeGroupId(params)
  if (ageGroupId == null) return NextResponse.json({ error: 'ageGroupId 不正確。' }, { status: 400 })
  const result = await deleteAgeGroup(ageGroupId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '刪除年齡分級失敗。' }, { status: 400 })
  return NextResponse.json({ deletedId: result.data.id, message: result.message })
}
