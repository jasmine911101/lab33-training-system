import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function requireSession(redirectTo: string) {
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect(redirectTo)
  }

  return user
}
