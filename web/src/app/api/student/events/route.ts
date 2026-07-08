import { NextResponse } from 'next/server'

import { requireStudentAccess } from '@/lib/auth/roles'
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
  const context = await requireStudentAccess('/student/login')
  const studentProfile = context.studentProfile

  if (!studentProfile) {
    return NextResponse.json({ error: '找不到目前登入學員。' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const title = text(body?.title)
  const eventType = normalizeEventType(text(body?.event_type))
  const startDate = text(body?.start_date)
  const endDate = text(body?.end_date) || startDate
  const notes = text(body?.notes)

  if (!title) {
    return NextResponse.json({ error: '請輸入事件名稱。' }, { status: 400 })
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
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  const schedule = await getAthleteScheduleBundle(studentProfile.id)
  return NextResponse.json({
    success: true,
    message: '已新增一般事件。',
    schedule,
  })
}
