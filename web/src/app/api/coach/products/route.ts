import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import type { ProductBlockMutationPayload, ProductMutationPayload } from '@/lib/types/commerce'
import { createProductForCoach } from '@/services/commerce-products'

function parseBlocks(value: unknown): ProductBlockMutationPayload[] {
  if (!Array.isArray(value)) return []
  return value.map((entry, index) => {
    if (typeof entry === 'number' || typeof entry === 'string') {
      return { blockId: Number(entry), sortOrder: index }
    }
    const record = entry as Record<string, unknown>
    return {
      blockId: Number(record.blockId ?? record.block_id),
      weekNumber: record.weekNumber == null && record.week_number == null ? null : Number(record.weekNumber ?? record.week_number),
      dayNumber: record.dayNumber == null && record.day_number == null ? null : Number(record.dayNumber ?? record.day_number),
      sortOrder: record.sortOrder == null && record.sort_order == null ? index : Number(record.sortOrder ?? record.sort_order),
    }
  })
}

function parsePayload(body: Record<string, unknown>): ProductMutationPayload {
  return {
    name: String(body.name ?? ''),
    description: String(body.description ?? ''),
    coverImageUrl: body.coverImageUrl == null ? null : String(body.coverImageUrl),
    priceAmount: Number(body.priceAmount ?? 0),
    currency: String(body.currency ?? 'TWD'),
    isActive: body.isActive !== false,
    blocks: parseBlocks(body.blocks ?? body.blockIds),
  }
}

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '商品資料格式不正確。' }, { status: 400 })
  }

  const result = await createProductForCoach(context.coachProfile, parsePayload(body as Record<string, unknown>))
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '建立商品失敗。' }, { status: 400 })
  }

  return NextResponse.json({ product: result.data, message: result.message }, { status: 201 })
}
