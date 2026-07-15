import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth/session'
import { resolveStudentAccessForUser } from '@/services/role-access'

export async function GET() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ authenticated: false, hasStudentAccess: false })
  }

  const access = await resolveStudentAccessForUser(user)

  return NextResponse.json({
    authenticated: true,
    hasStudentAccess: access.ok,
    errorCode: access.ok ? null : access.code,
  })
}
