import { createClient } from '@/lib/supabase/server'

export type StudentProfile = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  sport: string | null
  level: string | null
  must_change_password: boolean | null
}

type AthleteBlockLookup = {
  id: number
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function fetchAthleteBlocksForLookup(athleteId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athlete_blocks')
    .select('id')
    .eq('athlete_id', athleteId)
    .limit(1)

  if (error) throw error
  return (data ?? []) as AthleteBlockLookup[]
}

async function findStudentRowsByUserId(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('id, user_id, name, email, sport, level, must_change_password')
    .eq('user_id', userId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as StudentProfile[]
}

async function findStudentRowsByEmail(email: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('athletes')
    .select('id, user_id, name, email, sport, level, must_change_password')
    .eq('email', normalizeEmail(email))
    .order('id', { ascending: true })

  if (error) throw error
  return (data ?? []) as StudentProfile[]
}

export async function getStudentProfileForUser(userId: string, email?: string | null) {
  const emailRows = email ? await findStudentRowsByEmail(email) : []

  if (userId) {
    const userRows = await findStudentRowsByUserId(userId)
    if (userRows.length > 0) {
      const matchedByUser = userRows[0]
      try {
        const athleteBlocks = await fetchAthleteBlocksForLookup(matchedByUser.id)
        if (athleteBlocks.length > 0 || emailRows.length === 0) {
          return matchedByUser
        }
      } catch {
        return matchedByUser
      }
    }
  }

  if (emailRows.length > 0) {
    for (const athleteRow of emailRows) {
      try {
        const athleteBlocks = await fetchAthleteBlocksForLookup(athleteRow.id)
        if (athleteBlocks.length > 0) {
          return athleteRow
        }
      } catch {
        // Keep the same fallback behavior as Streamlit and continue.
      }
    }

    return emailRows[0]
  }

  return null
}
