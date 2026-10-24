import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { getTaxonomySelectionSnapshot } from '@/services/block-taxonomy'

export async function GET() {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }
  try {
    return NextResponse.json(await getTaxonomySelectionSnapshot(), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '無法載入分類，請稍後重試。' }, { status: 500 })
  }
}
