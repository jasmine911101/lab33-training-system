import { NextResponse } from 'next/server'
import { requireCoachApiContext } from '@/lib/auth/api'
import { createTeam } from '@/services/team-training'

export async function POST(request: Request) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse
  const body = await request.json().catch(() => null)
  const result = await createTeam(context.coachProfile, { name: String(body?.name ?? ''), description: String(body?.description ?? '') })
  return NextResponse.json(result, { status: result.error ? 400 : 201 })
}
