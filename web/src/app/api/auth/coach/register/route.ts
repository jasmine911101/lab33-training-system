import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        '公開總教練註冊已停用。請由系統管理者使用 server-only bootstrap 建立第一位總教練。',
    },
    { status: 410 },
  )
}
