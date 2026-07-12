import { NextResponse } from 'next/server'

import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

export async function requireCoachApiContext() {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      context: null,
      response: NextResponse.json({ error: '請先登入教練帳號。' }, { status: 401 }),
    }
  }

  const context = await getAppContextForUser(user)

  if (context.role !== 'coach' || !context.hasCoachAccess || !context.coachProfile) {
    return {
      context: null,
      response: NextResponse.json({ error: '這個帳號沒有教練端權限。' }, { status: 403 }),
    }
  }

  return {
    context,
    response: null,
  }
}
