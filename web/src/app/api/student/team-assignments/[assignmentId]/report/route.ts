import { NextResponse } from 'next/server'
import { requireStudentApiContext } from '@/lib/auth/api'
import { saveStudentTeamReport } from '@/services/team-training'

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { context, response } = await requireStudentApiContext()
  if (response || !context?.studentProfile) return response as NextResponse
  const { assignmentId } = await params
  const body = await request.json().catch(() => null)
  const rows = Array.isArray(body?.rows) ? body.rows.map((row: unknown) => {
    const values = row && typeof row === 'object' ? row as Record<string, unknown> : {}
    return {
      exerciseId: Number(values.exerciseId ?? values.id),
      actualSets: String(values.actualSets ?? values.actual_sets ?? ''),
      actualWeight: String(values.actualWeight ?? values.actual_weight ?? ''),
    }
  }) : []
  const result = await saveStudentTeamReport(context.studentProfile.id, Number(assignmentId), rows)
  return NextResponse.json(result, { status: result.error ? 400 : 200 })
}
