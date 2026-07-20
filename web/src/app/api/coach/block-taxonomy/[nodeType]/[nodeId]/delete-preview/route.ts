import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { getBlockTaxonomyDeletePreview } from '@/services/block-taxonomy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeType: string; nodeId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { nodeType, nodeId } = await params
  const parsedNodeId = Number(nodeId)
  if (!Number.isFinite(parsedNodeId)) return NextResponse.json({ error: '分類 ID 不正確。' }, { status: 400 })

  const result = await getBlockTaxonomyDeletePreview(nodeType, parsedNodeId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '讀取刪除預覽失敗。' }, { status: 400 })
  }

  return NextResponse.json({ preview: result.data })
}
