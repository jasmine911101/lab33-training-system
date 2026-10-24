import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { transferBlock } from '@/services/block-transfer'

export async function POST(request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }
  const blockId = Number((await params).blockId)
  const body = await request.json().catch(() => null)
  // 按原本的順序檢查，格式正確後才讀取下一組欄位。
  // 所有格式錯誤都保留相同的訊息與 HTTP 狀態碼。
  function invalidInputResponse() {
    return NextResponse.json({ error: '請選擇目標分類，並確認板塊資料格式正確。' }, { status: 400 })
  }

  if (!Number.isSafeInteger(blockId) || blockId <= 0) {
    return invalidInputResponse()
  }
  if (!body || typeof body !== 'object') {
    return invalidInputResponse()
  }
  if (body.mode !== 'move' && body.mode !== 'copy') {
    return invalidInputResponse()
  }
  if (typeof body.trainingCategoryId !== 'number') {
    return invalidInputResponse()
  }
  if (!Number.isSafeInteger(body.trainingCategoryId) || body.trainingCategoryId <= 0) {
    return invalidInputResponse()
  }
  if (body.mode === 'copy') {
    if (typeof body.blockCode !== 'string' || typeof body.blockName !== 'string') {
      return invalidInputResponse()
    }
  }
  try {
    const result = await transferBlock(blockId, {
      mode: body.mode,
      trainingCategoryId: body.trainingCategoryId,
      blockCode: body.mode === 'copy' ? body.blockCode : undefined,
      blockName: body.mode === 'copy' ? body.blockName : undefined,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '操作失敗，請稍後再試。' }, { status: 400 })
  }
}
