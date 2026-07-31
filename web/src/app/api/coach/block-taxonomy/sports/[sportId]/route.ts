import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteSport, updateSport } from '@/services/block-taxonomy'

async function parseSportId(params: Promise<{ sportId: string }>) {
  const { sportId } = await params
  const parsedSportId = Number(sportId)
  return Number.isFinite(parsedSportId) ? parsedSportId : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ sportId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const sportId = await parseSportId(params)
  if (sportId == null) return NextResponse.json({ error: 'sportId 不正確。' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const result = await updateSport(sportId, typeof body?.name === 'string' ? body.name : '')
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '更新專項失敗。' }, { status: 400 })
  return NextResponse.json({ sport: result.data, message: result.message })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ sportId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const sportId = await parseSportId(params)
  if (sportId == null) return NextResponse.json({ error: 'sportId 不正確。' }, { status: 400 })
  const result = await deleteSport(sportId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '刪除專項失敗。' }, { status: 400 })
  return NextResponse.json({ deletedId: result.data.id, message: result.message })
}
