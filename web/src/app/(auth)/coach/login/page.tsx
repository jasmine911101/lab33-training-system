import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth/login-form'
import { BrandLogo } from '@/components/layout/brand-logo'
import { getOAuthErrorMessage } from '@/lib/auth/oauth-errors'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

export default async function CoachLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getAuthenticatedUser()

  if (user) {
    const context = await getAppContextForUser(user)
    if (context.hasCoachAccess) {
      redirect('/coach')
    }
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const oauthErrorParam = Array.isArray(resolvedSearchParams.oauth_error)
    ? resolvedSearchParams.oauth_error[0]
    : resolvedSearchParams.oauth_error
  const oauthMessageParam = Array.isArray(resolvedSearchParams.oauth_message)
    ? resolvedSearchParams.oauth_message[0]
    : resolvedSearchParams.oauth_message
  return (
    <main id="main-content" className="lab-page px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <section className="rounded-[2rem] bg-slate-950 p-7 text-white shadow-[0_24px_64px_rgba(10,10,10,0.22)] sm:p-10">
          <BrandLogo className="w-52 brightness-0 invert" priority />
          <h1 className="mt-7 text-balance font-display text-5xl font-bold leading-[0.9]">教練端登入</h1>
        </section>
        <section className="lab-card p-5 sm:p-6">
          <div>
            <div className="mt-3">
              <LoginForm
                mode="coach"
                initialError={oauthMessageParam ?? getOAuthErrorMessage(oauthErrorParam) ?? null}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
