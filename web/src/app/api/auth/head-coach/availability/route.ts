import { NextResponse } from 'next/server'

import { getFirstHeadCoachRegistrationAvailability } from '@/services/coach-auth'

export async function GET() {
  const availability = await getFirstHeadCoachRegistrationAvailability()

  return NextResponse.json({
    canRegisterFirstHeadCoach: availability.canRegisterFirstHeadCoach,
  })
}
