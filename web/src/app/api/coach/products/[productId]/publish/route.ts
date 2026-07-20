import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { publishProductForCoach } from '@/services/commerce-products'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { productId } = await params
  const parsedProductId = Number(productId)
  const body = await request.json().catch(() => ({})) as { versionId?: unknown }
  const parsedVersionId = Number(body.versionId)
  if (!Number.isFinite(parsedProductId) || !Number.isFinite(parsedVersionId)) {
    return NextResponse.json({ error: '商品或版本 ID 不正確。' }, { status: 400 })
  }

  const result = await publishProductForCoach(context.coachProfile, parsedProductId, parsedVersionId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '發布商品失敗。' }, { status: 400 })
  }

  return NextResponse.json({ product: result.data, message: result.message })
}
