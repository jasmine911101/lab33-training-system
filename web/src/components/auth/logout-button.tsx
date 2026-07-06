'use client'

import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/')
    router.refresh()
  }

  return (
    <button type="button" onClick={handleLogout} className="lab-btn-secondary w-full sm:w-auto">
      登出
    </button>
  )
}
