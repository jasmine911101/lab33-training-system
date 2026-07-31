import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth/login-form'
import { BrandLogo } from '@/components/layout/brand-logo'
import { getOAuthErrorMessage } from '@/lib/auth/oauth-errors'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getAuthenticatedUser()

  if (user) {
    const context = await getAppContextForUser(user)
    if (context.hasStudentAccess) {
      redirect('/student')
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
        <section className="lab-card p-7 sm:p-10">
          <BrandLogo className="w-52" priority />
          <h1 className="mt-7 text-balance font-display text-5xl font-bold leading-[0.9] text-slate-950">學員端登入</h1>
        </section>
        <section className="lab-card p-5 sm:p-6">
          <LoginForm
            mode="student"
            initialError={oauthMessageParam ?? getOAuthErrorMessage(oauthErrorParam) ?? null}
          />
        </section>
      </div>
    </main>
  )
}
