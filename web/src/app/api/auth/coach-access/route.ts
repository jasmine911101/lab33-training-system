import { NextResponse } from 'next/server'

import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

export async function GET() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ authenticated: false, hasCoachAccess: false })
  }

  const context = await getAppContextForUser(user)

  return NextResponse.json({
    authenticated: true,
    hasCoachAccess: context.hasCoachAccess,
  })
}
