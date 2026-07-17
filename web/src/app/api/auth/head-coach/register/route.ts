import { NextResponse } from 'next/server'

import { registerFirstHeadCoachAccount } from '@/services/coach-auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '註冊資料格式不正確。' }, { status: 400 })
  }

  const result = await registerFirstHeadCoachAccount({
    name: String(body.name ?? ''),
    email: String(body.email ?? ''),
    password: String(body.password ?? ''),
    confirmPassword: String(body.confirmPassword ?? ''),
    registrationCode: String(body.registrationCode ?? ''),
  })

  if (result.error || !result.data) {
    const message = result.error ?? '建立第一位總教練失敗。'
    const status = message.includes('第一位總教練已建立') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }

  return NextResponse.json({
    email: result.data.email,
    message: result.message ?? '第一位總教練已建立。',
  })
}
