import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') || '/coach/login'
  const code = request.nextUrl.searchParams.get('code')

  const redirectUrl = new URL(next, request.url)
  let response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.redirect(redirectUrl)
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  return response
}
