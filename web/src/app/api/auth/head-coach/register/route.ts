import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: '此初始化註冊入口已停用。' },
    { status: 410 },
  )
}
