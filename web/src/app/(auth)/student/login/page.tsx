import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth/login-form'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getAuthenticatedUser } from '@/lib/auth/session'

export default async function StudentLoginPage() {
  const user = await getAuthenticatedUser()

  if (user) {
    const context = await getAppContextForUser(user)
    if (context.hasStudentAccess) {
      redirect('/student')
    }
    if (context.hasCoachAccess) {
      redirect('/coach')
    }
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#efe7db_0%,#fbfaf7_100%)] px-4 py-10 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-500">Student Portal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">學員端登入</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">
            登入後會進入學員端頁面，再依照目前資料是否能匹配到 athlete 進行驗證，不會只靠登入入口決定身份。
          </p>
        </section>
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <LoginForm mode="student" />
        </section>
      </div>
    </main>
  )
}
