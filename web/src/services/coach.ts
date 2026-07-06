import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env.server'

export type CoachProfile = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  is_head_coach: boolean | null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function buildFallbackCoachProfile(userId: string, email: string): CoachProfile | null {
  const normalizedEmail = normalizeEmail(email)
  const headCoachEmailSet = new Set(serverEnv.headCoachEmails)
  const coachEmailSet = new Set(serverEnv.coachEmails)

  if (headCoachEmailSet.has(normalizedEmail)) {
    return {
      id: -1,
      user_id: userId,
      name: normalizedEmail.split('@')[0] || normalizedEmail,
      email: normalizedEmail,
      is_head_coach: true,
    }
  }

  if (coachEmailSet.has(normalizedEmail)) {
    return {
      id: -1,
      user_id: userId,
      name: normalizedEmail.split('@')[0] || normalizedEmail,
      email: normalizedEmail,
      is_head_coach: false,
    }
  }

  return null
}

export type ManagedAthlete = {
  id: number
  name: string | null
  email: string | null
  sport: string | null
  level: string | null
  must_change_password: boolean | null
}

async function findCoachByUserId(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coaches')
    .select('id, user_id, name, email, is_head_coach')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as CoachProfile | null
}

async function findCoachByEmail(email: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coaches')
    .select('id, user_id, name, email, is_head_coach')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as CoachProfile | null
}

export async function getCoachProfileForUser(userId: string, email?: string | null) {
  const coachByUserId = await findCoachByUserId(userId)
  if (coachByUserId) return coachByUserId

  if (email) {
    const coachByEmail = await findCoachByEmail(email)
    if (coachByEmail) return coachByEmail
    return buildFallbackCoachProfile(userId, email)
  }

  return null
}

export async function getManagedAthletesForCoach(coach: CoachProfile): Promise<ManagedAthlete[]> {
  const supabase = await createClient()

  if (coach.is_head_coach) {
    const { data, error } = await supabase
      .from('athletes')
      .select('id, name, email, sport, level, must_change_password')
      .order('name', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw error
    return (data ?? []) as ManagedAthlete[]
  }

  const { data: coachLinks, error: coachLinksError } = await supabase
    .from('coach_athletes')
    .select('athlete_id')
    .eq('coach_id', coach.id)

  if (coachLinksError) throw coachLinksError

  const athleteIds = (coachLinks ?? [])
    .map((row) => Number(row.athlete_id))
    .filter((value) => Number.isFinite(value))

  if (athleteIds.length === 0) {
    return []
  }

  const { data: athletes, error: athletesError } = await supabase
    .from('athletes')
    .select('id, name, email, sport, level, must_change_password')
    .in('id', athleteIds)
    .order('name', { ascending: true })
    .order('id', { ascending: true })

  if (athletesError) throw athletesError
  return (athletes ?? []) as ManagedAthlete[]
}

export async function getManagedAthleteByIdForCoach(coach: CoachProfile, athleteId: number) {
  const athletes = await getManagedAthletesForCoach(coach)
  return athletes.find((athlete) => athlete.id === athleteId) ?? null
}
