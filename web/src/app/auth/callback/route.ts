import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getOAuthErrorMessage } from '@/lib/auth/oauth-errors'
import { env } from '@/lib/env'
import { resolveOAuthCallbackUser } from '@/services/oauth-callback'

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') || '/coach/login'
  const intent = request.nextUrl.searchParams.get('intent')
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
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const failureUrl = new URL(intent === 'student' ? '/student/login' : '/coach/login', request.url)
      failureUrl.searchParams.set('oauth_error', 'callback-failed')
      return NextResponse.redirect(failureUrl)
    }
  } else {
    const failureUrl = new URL(intent === 'student' ? '/student/login' : '/coach/login', request.url)
    failureUrl.searchParams.set('oauth_error', 'callback-failed')
    return NextResponse.redirect(failureUrl)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resolution = await resolveOAuthCallbackUser(user, intent)

  if (resolution.status === 'error') {
    await supabase.auth.signOut()
    const failureUrl = new URL(resolution.loginPath, request.url)
    failureUrl.searchParams.set('oauth_error', resolution.code)
    const failureMessage = getOAuthErrorMessage(resolution.code)
    if (failureMessage) {
      failureUrl.searchParams.set('oauth_message', failureMessage)
    }
    response.headers.set('Location', failureUrl.toString())
    return response
  }

  response.headers.set('Location', new URL(resolution.redirectPath, request.url).toString())
  return response
}
