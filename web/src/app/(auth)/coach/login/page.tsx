import { redirect } from 'next/navigation'

import { CoachRegistrationForm } from '@/components/auth/coach-registration-form'
import { LoginForm } from '@/components/auth/login-form'
import { getOAuthErrorMessage } from '@/lib/auth/oauth-errors'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { getCoachRegistrationAvailability } from '@/services/coach-auth'

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

  const registration = getCoachRegistrationAvailability()

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-[linear-gradient(145deg,#1c1917,#3f3f46)] p-8 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-300">Coach Portal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">教練端登入</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-300 sm:text-base">
            登入後只會驗證 `public.coaches` 的教練身份；同一個人也可以同時擁有學員身份。
          </p>
        </section>
        <section className="grid gap-5 rounded-[2rem] bg-white p-6 text-stone-900 shadow-2xl">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">登入</p>
            <div className="mt-3">
              <LoginForm
                mode="coach"
                initialError={oauthMessageParam ?? getOAuthErrorMessage(oauthErrorParam) ?? null}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">建立總教練</p>
            <div className="mt-3">
              <CoachRegistrationForm
                headCoachRegistrationCodeConfigured={registration.headCoachRegistrationCodeConfigured}
                serviceRoleConfigured={registration.serviceRoleConfigured}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
