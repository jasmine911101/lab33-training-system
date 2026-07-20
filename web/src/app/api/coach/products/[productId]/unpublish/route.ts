import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { unpublishProductForCoach } from '@/services/commerce-products'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { productId } = await params
  const parsedProductId = Number(productId)
  if (!Number.isFinite(parsedProductId)) {
    return NextResponse.json({ error: '商品 ID 不正確。' }, { status: 400 })
  }

  const result = await unpublishProductForCoach(context.coachProfile, parsedProductId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '下架商品失敗。' }, { status: 400 })
  }

  return NextResponse.json({ product: result.data, message: result.message })
}
