import { NextResponse } from 'next/server'

import { passwordChangeRequiredError, requiresPasswordChange } from '@/lib/auth/password-gate'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

type ApiContextOptions = {
  allowPasswordChangeRequired?: boolean
}

export async function requireCoachApiContext(options: ApiContextOptions = {}) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      context: null,
      response: NextResponse.json({ error: '請先登入教練帳號。' }, { status: 401 }),
    }
  }

  const context = await getAppContextForUser(user)

  if (!context.hasCoachAccess || !context.coachProfile) {
    return {
      context: null,
      response: NextResponse.json({ error: '這個帳號沒有教練端權限。' }, { status: 403 }),
    }
  }

  if (!options.allowPasswordChangeRequired && requiresPasswordChange(context)) {
    return {
      context: null,
      response: NextResponse.json(passwordChangeRequiredError(), { status: 403 }),
    }
  }

  return {
    context,
    response: null,
  }
}

export async function requireStudentApiContext(options: ApiContextOptions = {}) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return {
      context: null,
      response: NextResponse.json({ error: '請先登入學員帳號。' }, { status: 401 }),
    }
  }

  const context = await getAppContextForUser(user)
  if (!context.hasStudentAccess || !context.studentProfile) {
    return {
      context: null,
      response: NextResponse.json({ error: '這個帳號沒有學員端權限。' }, { status: 403 }),
    }
  }

  if (!options.allowPasswordChangeRequired && requiresPasswordChange(context)) {
    return {
      context: null,
      response: NextResponse.json(passwordChangeRequiredError(), { status: 403 }),
    }
  }

  return { context, response: null }
}
