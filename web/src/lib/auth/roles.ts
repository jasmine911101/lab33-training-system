import type { User } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

import { requireSession } from '@/lib/auth/session'
import { getCoachProfileForUser, type CoachProfile } from '@/services/coach'
import { getStudentProfileForUser, type StudentProfile } from '@/services/student'

export type AppRole = 'coach' | 'student' | 'unknown'

export type AppContext = {
  user: User
  role: AppRole
  coachProfile: CoachProfile | null
  studentProfile: StudentProfile | null
  hasCoachAccess: boolean
  hasStudentAccess: boolean
}

export async function getAppContextForUser(user: User): Promise<AppContext> {
  const [coachProfile, studentProfile] = await Promise.all([
    getCoachProfileForUser(user.id, user.email),
    getStudentProfileForUser(user.id, user.email),
  ])

  const hasCoachAccess = Boolean(coachProfile)
  const hasStudentAccess = Boolean(studentProfile)

  let role: AppRole = 'unknown'
  if (hasCoachAccess && !hasStudentAccess) role = 'coach'
  if (!hasCoachAccess && hasStudentAccess) role = 'student'

  return {
    user,
    role,
    coachProfile,
    studentProfile,
    hasCoachAccess,
    hasStudentAccess,
  }
}

export async function detectAppRole(userId: string, email?: string | null): Promise<AppRole> {
  const [coachProfile, studentProfile] = await Promise.all([
    getCoachProfileForUser(userId, email),
    getStudentProfileForUser(userId, email),
  ])

  const hasCoachAccess = Boolean(coachProfile)
  const hasStudentAccess = Boolean(studentProfile)

  if (hasCoachAccess && !hasStudentAccess) return 'coach'
  if (!hasCoachAccess && hasStudentAccess) return 'student'
  return 'unknown'
}

export async function requireCoachAccess(loginPath: string) {
  const user = await requireSession(loginPath)
  const context = await getAppContextForUser(user)

  if (context.hasCoachAccess) {
    return context
  }

  redirect('/dashboard')
}

export async function requireStudentAccess(loginPath: string) {
  const user = await requireSession(loginPath)
  const context = await getAppContextForUser(user)

  if (context.hasStudentAccess) {
    return context
  }

  redirect('/dashboard')
}
