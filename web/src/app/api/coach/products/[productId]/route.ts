import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import type { ProductMetadataPayload } from '@/lib/types/commerce'
import { updateProductForCoach } from '@/services/commerce-products'

function parsePayload(body: Record<string, unknown>): ProductMetadataPayload {
  return {
    name: body.name == null ? undefined : String(body.name),
    description: body.description == null ? undefined : String(body.description),
    coverImageUrl: body.coverImageUrl == null ? undefined : String(body.coverImageUrl),
    priceAmount: body.priceAmount == null ? undefined : Number(body.priceAmount),
    currency: body.currency == null ? undefined : String(body.currency),
    isActive: body.isActive == null ? undefined : body.isActive !== false,
  }
}

export async function PATCH(
  request: Request,
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

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '商品資料格式不正確。' }, { status: 400 })
  }

  const result = await updateProductForCoach(context.coachProfile, parsedProductId, parsePayload(body as Record<string, unknown>))
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '更新商品失敗。' }, { status: 400 })
  }

  return NextResponse.json({ product: result.data, message: result.message })
}
