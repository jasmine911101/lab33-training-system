import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteBlockTemplateForCoach } from '@/services/block-management'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { blockId } = await params
  const parsedBlockId = Number(blockId)
  if (!Number.isFinite(parsedBlockId)) {
    return NextResponse.json({ error: '板塊 ID 不正確。' }, { status: 400 })
  }

  const result = await deleteBlockTemplateForCoach(parsedBlockId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '刪除板塊失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    blockId: result.data.blockId,
    message: result.message,
  })
}
