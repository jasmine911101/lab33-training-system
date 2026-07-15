import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth/session'
import { resolveCoachAccessForUser } from '@/services/role-access'

export async function GET() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ authenticated: false, hasCoachAccess: false })
  }

  const access = await resolveCoachAccessForUser(user)

  return NextResponse.json({
    authenticated: true,
    hasCoachAccess: access.ok,
    errorCode: access.ok ? null : access.code,
  })
}
