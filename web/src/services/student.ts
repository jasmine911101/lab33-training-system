import { createClient } from '@/lib/supabase/server'
import { resolveIdentityBoundProfile } from '@/lib/auth/identity-binding'

export type StudentProfile = {
  id: number
  user_id: string | null
  name: string | null
  email: string | null
  sport: string | null
  level: string | null
  must_change_password: boolean | null
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

export async function getStudentProfileForUser(userId: string) {
  const resolution = resolveIdentityBoundProfile(await findStudentRowsByUserId(userId), userId)
  return resolution.status === 'matched' ? resolution.profile : null
}
