import { NextResponse } from 'next/server'

import { requireStudentAccess } from '@/lib/auth/roles'
import { updateStudentTeamSessionResult } from '@/services/team-programs'

export async function PATCH(request: Request, { params }: { params: Promise<{ programId: string; sessionId: string }> }) {
  const context = await requireStudentAccess('/student/login')
  if (!context.studentProfile) return NextResponse.json({ error: '請先登入學員帳號。' }, { status: 401 })
  const { programId, sessionId } = await params
  const parsedProgramId = Number(programId)
  const parsedSessionId = Number(sessionId)
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!Number.isFinite(parsedProgramId) || !Number.isFinite(parsedSessionId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await updateStudentTeamSessionResult(context.studentProfile.id, parsedProgramId, parsedSessionId, {
    status: typeof body.status === 'string' ? body.status : undefined,
    notes: typeof body.notes === 'string' ? body.notes : null,
    resultJson: body.resultJson && typeof body.resultJson === 'object' && !Array.isArray(body.resultJson) ? body.resultJson as Record<string, unknown> : null,
  })
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '儲存結果失敗。' }, { status: 400 })
  return NextResponse.json({ program: result.data, message: result.message ?? '已儲存團隊課表結果。' })
}
