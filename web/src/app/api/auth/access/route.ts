import { NextResponse } from 'next/server'

import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

export async function GET() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      role: 'unknown',
      hasCoachAccess: false,
      hasStudentAccess: false,
      authProvider: 'unknown',
      isGoogleSession: false,
    })
  }

  const context = await getAppContextForUser(user)

  return NextResponse.json({
    authenticated: true,
    role: context.role,
    hasCoachAccess: context.hasCoachAccess,
    hasStudentAccess: context.hasStudentAccess,
    authProvider: context.authProvider,
    isGoogleSession: context.isGoogleSession,
  })
}
