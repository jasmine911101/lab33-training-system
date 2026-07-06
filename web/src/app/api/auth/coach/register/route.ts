import { NextResponse } from 'next/server'

import { registerCoachAccount } from '@/services/coach-auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '註冊資料格式不正確。' }, { status: 400 })
  }

  const result = await registerCoachAccount({
    name: String(body.name ?? ''),
    email: String(body.email ?? ''),
    password: String(body.password ?? ''),
    confirmPassword: String(body.confirmPassword ?? ''),
    inviteCode: String(body.inviteCode ?? ''),
  })

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '建立教練帳號失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    email: result.data.email,
    message: result.message,
  })
}
