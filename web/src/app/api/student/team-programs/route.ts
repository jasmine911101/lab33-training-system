import { NextResponse } from 'next/server'

import { requireStudentAccess } from '@/lib/auth/roles'
import { getStudentTeamPrograms } from '@/services/team-programs'

export async function GET() {
  const context = await requireStudentAccess('/student/login')
  if (!context.studentProfile) return NextResponse.json({ error: '請先登入學員帳號。' }, { status: 401 })
  const programs = await getStudentTeamPrograms(context.studentProfile.id)
  return NextResponse.json({ programs })
}
