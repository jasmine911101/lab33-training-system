import { NextResponse } from 'next/server'

import { requireStudentApiContext } from '@/lib/auth/api'
import { getQaEntries } from '@/services/qa-library'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { response } = await requireStudentApiContext()
  if (response) return response

  try {
    const entries = await getQaEntries()
    return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '讀取 QA 失敗。' }, { status: 500 })
  }
}
