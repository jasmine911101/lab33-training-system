import { NextResponse } from 'next/server'

import { requireStudentAccess } from '@/lib/auth/roles'
import { getStudentTeamProgramDetail } from '@/services/team-programs'

export async function GET(_request: Request, { params }: { params: Promise<{ programId: string }> }) {
  const context = await requireStudentAccess('/student/login')
  if (!context.studentProfile) return NextResponse.json({ error: '請先登入學員帳號。' }, { status: 401 })
  const { programId } = await params
  const parsedProgramId = Number(programId)
  if (!Number.isFinite(parsedProgramId)) return NextResponse.json({ error: '參數不正確。' }, { status: 400 })
  const result = await getStudentTeamProgramDetail(context.studentProfile.id, parsedProgramId)
  if (result.error || !result.data) return NextResponse.json({ error: result.error ?? '找不到團隊課表。' }, { status: 404 })
  return NextResponse.json({ program: result.data })
}
