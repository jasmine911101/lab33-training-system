import { NextResponse } from 'next/server'

import { requireStudentApiContext } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'

function text(value: unknown) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized.toLowerCase() === 'nan' ? '' : normalized
}

function buildPayload(row: Record<string, unknown>) {
  return {
    actual_sets: text(row.actual_sets),
    actual_weight: text(row.actual_weight),
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { context, response } = await requireStudentApiContext()
  if (response || !context?.studentProfile) return response as NextResponse
  const studentProfile = context.studentProfile

  const { assignmentId } = await params
  const parsedAssignmentId = Number(assignmentId)
  if (!Number.isFinite(parsedAssignmentId)) {
    return NextResponse.json({ error: '課表 ID 不正確。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const rows = Array.isArray(body?.rows) ? body.rows : []
  if (rows.length === 0) {
    return NextResponse.json({ error: '沒有可儲存的回報內容。' }, { status: 400 })
  }

  if (rows.length > 200) {
    return NextResponse.json({ error: '單次回報的動作列不可超過 200 筆。' }, { status: 400 })
  }

  const sessionSupabase = await createClient()
  const { data: assignmentRow, error: assignmentError } = await sessionSupabase
    .from('athlete_blocks')
    .select('id, athlete_id')
    .eq('id', parsedAssignmentId)
    .eq('athlete_id', studentProfile.id)
    .maybeSingle()

  if (assignmentError) {
    console.error('Failed to verify athlete assignment', {
      athleteId: studentProfile.id,
      assignmentId: parsedAssignmentId,
      code: assignmentError.code,
      message: assignmentError.message,
    })
    return NextResponse.json({ error: '讀取課表失敗，請稍後再試。' }, { status: 500 })
  }

  if (!assignmentRow) {
    return NextResponse.json({ error: '找不到可回報的課表，或你沒有權限回報這筆資料。' }, { status: 404 })
  }

  const { data: existingRows, error: existingRowsError } = await sessionSupabase
    .from('athlete_block_exercises')
    .select('id')
    .eq('athlete_block_id', parsedAssignmentId)

  if (existingRowsError) {
    console.error('Failed to read athlete exercise rows', {
      athleteId: studentProfile.id,
      assignmentId: parsedAssignmentId,
      code: existingRowsError.code,
      message: existingRowsError.message,
    })
    return NextResponse.json({ error: '讀取回報內容失敗，請稍後再試。' }, { status: 500 })
  }

  const validIds = new Set((existingRows ?? []).map((row) => Number(row.id)).filter((value) => Number.isFinite(value)))
  if (validIds.size === 0) {
    return NextResponse.json({ error: '這筆課表目前還沒有可儲存的學員專屬動作內容。' }, { status: 400 })
  }

  for (const row of rows) {
    const rowId = Number(row?.id)
    if (!Number.isFinite(rowId) || !validIds.has(rowId)) {
      return NextResponse.json({ error: '回報內容包含無效的動作列。' }, { status: 400 })
    }

    const { error: updateError } = await sessionSupabase
      .from('athlete_block_exercises')
      .update(buildPayload(row as Record<string, unknown>))
      .eq('id', rowId)
      .eq('athlete_block_id', parsedAssignmentId)

    if (updateError) {
      console.error('Failed to update athlete exercise report', {
        athleteId: studentProfile.id,
        assignmentId: parsedAssignmentId,
        rowId,
        code: updateError.code,
        message: updateError.message,
      })
      return NextResponse.json({ error: '儲存訓練回報失敗，請稍後再試。' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, message: '已儲存訓練回報。' })
}
