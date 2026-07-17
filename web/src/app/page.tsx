import Link from 'next/link'

import { getAuthenticatedUser } from '@/lib/auth/session'
import { getAppContextForUser } from '@/lib/auth/roles'
import { getFirstHeadCoachRegistrationAvailability } from '@/services/coach-auth'

export default async function HomePage() {
  const user = await getAuthenticatedUser()
  const context = user ? await getAppContextForUser(user) : null
  const signedInHref = context?.hasCoachAccess ? '/coach' : context?.hasStudentAccess ? '/student' : '/'
  const headCoachAvailability = user ? null : await getFirstHeadCoachRegistrationAvailability()

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6efe5_0%,#fbfaf7_55%,#ffffff_100%)] px-4 py-10 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-500">Phase 2 Migration</p>
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                LAB33 Training System Web
              </h1>
              <p className="max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
                新網站目前已完成角色保護、登入後自動分流、基本 dashboard、導覽列與登出，並已搬移學員管理、學員回報、行事曆安排與板塊管理。舊版 Streamlit 仍保留並行，Excel 匯入會在後續階段完成。
              </p>
              <div className="flex flex-wrap gap-3">
                {user ? (
                  <Link href={signedInHref} className="rounded-full bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-stone-700">
                    前往我的 Dashboard
                  </Link>
                ) : (
                  <>
                    <Link href="/coach/login" className="rounded-full bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-stone-700">
                      教練端登入
                    </Link>
                    <Link href="/student/login" className="rounded-full border border-stone-300 px-5 py-3 font-semibold text-stone-800 transition hover:border-stone-900">
                      學員端登入
                    </Link>
                    {headCoachAvailability?.canRegisterFirstHeadCoach ? (
                      <Link href="/coach/login" className="rounded-full border border-orange-200 bg-orange-50 px-5 py-3 font-semibold text-orange-700 transition hover:border-orange-500 hover:bg-orange-100">
                        初始化系統（建立第一位總教練）
                      </Link>
                    ) : null}
                  </>
                )}
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-6">
              <h2 className="text-lg font-bold">目前狀態</h2>
              <dl className="mt-4 space-y-3 text-sm text-stone-600">
                <div className="flex justify-between gap-4">
                  <dt>Session</dt>
                  <dd>{user ? '已登入' : '未登入'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Email</dt>
                  <dd className="truncate text-right">{user?.email ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>教練權限</dt>
                  <dd>{context?.hasCoachAccess ? '有' : '無'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>學員權限</dt>
                  <dd>{context?.hasStudentAccess ? '有' : '無'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>舊版系統</dt>
                  <dd>保留並行</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            ['Coach', '可依現有權限查看可管理學員；總教練可看全部，一般教練只看被指派學生。'],
            ['Student', '登入後會自動判斷身份，學員端可看到目前登入學員的基本資料。'],
            ['Supabase', '沿用現有 Supabase 專案、帳號與資料，不暴露 service role key 到前端。'],
          ].map(([title, description]) => (
            <article key={title} className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-stone-600">{description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
