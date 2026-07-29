import { NextResponse } from 'next/server'

import { validateNewPassword } from '@/lib/auth/password-rules'
import {
  RECOVERY_INTENT_COOKIE,
  hasValidRecoveryIntent,
  recoveryIntentCookieOptions,
} from '@/lib/auth/recovery-intent'
import { createClient } from '@/lib/supabase/server'

function clearRecoveryIntent(response: NextResponse) {
  response.cookies.set(RECOVERY_INTENT_COOKIE, '', {
    ...recoveryIntentCookieOptions,
    maxAge: 0,
  })
  return response
}

export async function POST(request: Request) {
  let password: string | undefined
  try {
    const body = await request.json() as { password?: unknown }
    password = typeof body.password === 'string' ? body.password : undefined
  } catch {
    return NextResponse.json({ error: '無法處理更新密碼要求，請重新申請重設連結。' }, { status: 400 })
  }

  if (!password || validateNewPassword(password, password)) {
    return NextResponse.json({ error: '新密碼不符合要求。' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const intent = request.headers.get('cookie')
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${RECOVERY_INTENT_COOKIE}=`))
    ?.slice(RECOVERY_INTENT_COOKIE.length + 1)

  if (!hasValidRecoveryIntent(intent, user?.id)) {
    return clearRecoveryIntent(NextResponse.json(
      { error: '重設密碼連結已失效，請重新申請。' },
      { status: 403 },
    ))
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return NextResponse.json({ error: '更新密碼失敗，請重新申請重設連結後再試。' }, { status: 400 })
  }

  await supabase.auth.signOut({ scope: 'local' })
  return clearRecoveryIntent(NextResponse.json({ success: true }))
}
