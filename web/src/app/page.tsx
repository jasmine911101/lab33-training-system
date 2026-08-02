import Link from 'next/link'

import { BrandLogo } from '@/components/layout/brand-logo'
import { getAuthenticatedUser } from '@/lib/auth/session'
import { getAppContextForUser } from '@/lib/auth/roles'

export default async function HomePage() {
  const user = await getAuthenticatedUser()
  const context = user ? await getAppContextForUser(user) : null
  const signedInHref = context?.hasCoachAccess ? '/coach' : context?.hasStudentAccess ? '/student' : '/'

  return (
    <main id="main-content" className="lab-page px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="lab-page-shell max-w-6xl">
        <section className="lab-card p-6 sm:p-8 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div className="space-y-5">
              <BrandLogo className="w-52 sm:w-64" priority />
              <div className="flex flex-wrap gap-3">
                {user ? (
                  <Link href={signedInHref} className="lab-btn-primary">
                    前往我的 Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/coach/login" className="lab-btn-primary">
                      教練端登入
                    </Link>
                    <Link href="/student/login" className="lab-btn-secondary">
                      學員端登入
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="lab-card-muted p-5 sm:p-6">
              <h2 className="text-lg font-bold">目前狀態</h2>
              <dl className="mt-4 space-y-3 text-sm text-stone-600">
                <div className="flex justify-between gap-4 border-b border-slate-200/80 py-3">
                  <dt>Session</dt>
                  <dd>{user ? '已登入' : '未登入'}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-4 border-b border-slate-200/80 py-3">
                  <dt>Email</dt>
                  <dd className="truncate text-right">{user?.email ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-slate-200/80 py-3">
                  <dt>教練權限</dt>
                  <dd>{context?.hasCoachAccess ? '有' : '無'}</dd>
                </div>
                <div className="flex justify-between gap-4 py-3">
                  <dt>學員權限</dt>
                  <dd>{context?.hasStudentAccess ? '有' : '無'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
