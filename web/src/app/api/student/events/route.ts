import { NextResponse } from 'next/server'

import { requireStudentApiContext } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { GENERAL_EVENT_TYPES } from '@/lib/types/schedule-management'
import { getAthleteScheduleBundle } from '@/services/schedule'

function text(value: unknown) {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized.toLowerCase() === 'nan' ? '' : normalized
}

function normalizeEventType(value: string) {
  return GENERAL_EVENT_TYPES.includes(value as (typeof GENERAL_EVENT_TYPES)[number])
    ? value
    : GENERAL_EVENT_TYPES[0]
}

export async function POST(request: Request) {
  const { context, response } = await requireStudentApiContext()
  if (response || !context?.studentProfile) return response as NextResponse
  const studentProfile = context.studentProfile

  const body = await request.json().catch(() => null)
  const title = text(body?.title)
  const eventType = normalizeEventType(text(body?.event_type))
  const startDate = text(body?.start_date)
  const endDate = text(body?.end_date) || startDate
  const notes = text(body?.notes)

  if (!title) {
    return NextResponse.json({ error: '請輸入事件名稱。' }, { status: 400 })
  }

  if (title.length > 120 || notes.length > 2000) {
    return NextResponse.json({ error: '事件名稱或備註內容過長。' }, { status: 400 })
  }

  if (!startDate) {
    return NextResponse.json({ error: '請選擇開始日期。' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error: insertError } = await supabase.from('athlete_events').insert({
    athlete_id: studentProfile.id,
    title,
    event_type: eventType,
    start_date: startDate,
    end_date: endDate,
    notes,
  })

  if (insertError) {
    console.error('Failed to create athlete event', {
      athleteId: studentProfile.id,
      code: insertError.code,
      message: insertError.message,
    })
    return NextResponse.json({ error: '新增事件失敗，請稍後再試。' }, { status: 500 })
  }

  const schedule = await getAthleteScheduleBundle(studentProfile.id)
  return NextResponse.json({
    success: true,
    message: '已新增一般事件。',
    schedule,
  })
}
