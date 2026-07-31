import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteQaEntry, updateQaEntry } from '@/services/qa-library'

async function getId(params: Promise<{ qaId: string }>) {
  const { qaId } = await params
  const id = Number(qaId)
  return Number.isFinite(id) ? id : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ qaId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const id = await getId(params)
  if (id == null) return NextResponse.json({ error: 'QA id 不正確。' }, { status: 400 })
  const body = await request.json().catch(() => null)
  try {
    return NextResponse.json({ entry: await updateQaEntry(id, { question: body?.question, answer_video_url: body?.answer_video_url }) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新 QA 失敗。' }, { status: 400 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ qaId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const id = await getId(params)
  if (id == null) return NextResponse.json({ error: 'QA id 不正確。' }, { status: 400 })
  try {
    await deleteQaEntry(id)
    return NextResponse.json({ message: 'QA 已刪除。' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '刪除 QA 失敗。' }, { status: 400 })
  }
}
