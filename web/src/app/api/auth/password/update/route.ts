import { NextResponse } from 'next/server'

import { validateNewPassword } from '@/lib/auth/password-rules'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  let password: string | undefined
  try {
    const body = await request.json() as { password?: unknown }
    password = typeof body.password === 'string' ? body.password : undefined
  } catch {
    return NextResponse.json({ error: '無法處理密碼更新要求。' }, { status: 400 })
  }

  if (!password || validateNewPassword(password, password)) {
    return NextResponse.json({ error: '新密碼不符合要求。' }, { status: 400 })
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: '登入狀態已失效，請重新登入。' }, { status: 401 })
  }

  const context = await getAppContextForUser(user)
  if (!context.hasCoachAccess && !context.hasStudentAccess) {
    return NextResponse.json({ error: '找不到可更新密碼的帳號資料。' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: '系統暫時無法完成密碼更新，請稍後再試。' }, { status: 503 })
  }

  const supabase = await createClient()
  const { error: passwordError } = await supabase.auth.updateUser({ password })
  if (passwordError) {
    return NextResponse.json({ error: '更新密碼失敗，請稍後再試。' }, { status: 400 })
  }

  const updates = []
  if (context.coachProfile?.user_id === user.id) {
    updates.push(admin.from('coaches').update({ must_change_password: false }).eq('user_id', user.id))
  }
  if (context.studentProfile?.user_id === user.id) {
    updates.push(admin.from('athletes').update({ must_change_password: false }).eq('user_id', user.id))
  }

  const results = await Promise.all(updates)
  if (results.some(({ error }) => error)) {
    return NextResponse.json({ error: '密碼已更新，但帳號狀態未完成更新，請聯絡管理員。' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
