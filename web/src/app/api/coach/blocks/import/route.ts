import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import type { ImportedBlockTemplate } from '@/lib/types/block-management'
import { importBlockTemplatesForCoach } from '@/services/block-management'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '匯入資料格式不正確。' }, { status: 400 })
  }

  const bodyRecord = body as Record<string, unknown>
  const selectedBlocks = Array.isArray(bodyRecord.selectedBlocks) ? (bodyRecord.selectedBlocks as ImportedBlockTemplate[]) : []
  const description = String(bodyRecord.description ?? '')
  const trainingCategoryId = bodyRecord.trainingCategoryId == null ? null : Number(bodyRecord.trainingCategoryId)

  if (selectedBlocks.length === 0) {
    return NextResponse.json({ error: '目前沒有選取任何可匯入的新板塊。' }, { status: 400 })
  }

  const result = await importBlockTemplatesForCoach(context.coachProfile, selectedBlocks, description, {
    trainingCategoryId: Number.isFinite(trainingCategoryId) ? trainingCategoryId : null,
  })
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? 'Excel 匯入失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    importedCount: result.data.importedCount,
    importedBlocks: result.data.importedBlocks,
    message: result.message,
  })
}
