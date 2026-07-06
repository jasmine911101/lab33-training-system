import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { buildImportPreview, parseBlockWorkbook } from '@/services/block-import'
import { fetchBlockIdentityRows } from '@/services/block-management'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '請先選擇 Excel 檔案。' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: '目前只支援 .xlsx 檔案。' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const parsedBlocks = parseBlockWorkbook(Buffer.from(arrayBuffer))

  if (parsedBlocks.length === 0) {
    return NextResponse.json({ error: '沒有讀到可匯入的模板。請確認每個工作表都有 LAB33 板塊模板格式。' }, { status: 400 })
  }

  const existingBlocks = await fetchBlockIdentityRows()
  const preview = buildImportPreview(parsedBlocks, existingBlocks)

  return NextResponse.json({
    totalSheets: parsedBlocks.length,
    importableBlocks: preview.importableBlocks,
    skippedRows: preview.skippedRows,
  })
}
