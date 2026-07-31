import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { createQaEntry } from '@/services/qa-library'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const body = await request.json().catch(() => null)
  try {
    const entry = await createQaEntry({ question: body?.question, answer_video_url: body?.answer_video_url }, context.coachProfile.id)
    return NextResponse.json({ entry, message: 'QA 已新增。' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '新增 QA 失敗。' }, { status: 400 })
  }
}
