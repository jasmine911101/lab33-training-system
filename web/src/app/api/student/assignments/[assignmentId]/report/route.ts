import { NextResponse } from 'next/server'

import { requireStudentAccess } from '@/lib/auth/roles'
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
  const context = await requireStudentAccess('/student/login')
  const studentProfile = context.studentProfile

  if (!studentProfile) {
    return NextResponse.json({ error: '找不到目前登入學員。' }, { status: 403 })
  }

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

  const sessionSupabase = await createClient()
  const { data: assignmentRow, error: assignmentError } = await sessionSupabase
    .from('athlete_blocks')
    .select('id, athlete_id')
    .eq('id', parsedAssignmentId)
    .eq('athlete_id', studentProfile.id)
    .maybeSingle()

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 400 })
  }

  if (!assignmentRow) {
    return NextResponse.json({ error: '找不到可回報的課表，或你沒有權限回報這筆資料。' }, { status: 404 })
  }

  const { data: existingRows, error: existingRowsError } = await sessionSupabase
    .from('athlete_block_exercises')
    .select('id')
    .eq('athlete_block_id', parsedAssignmentId)

  if (existingRowsError) {
    return NextResponse.json({ error: existingRowsError.message }, { status: 400 })
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
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true, message: '已儲存訓練回報。' })
}
