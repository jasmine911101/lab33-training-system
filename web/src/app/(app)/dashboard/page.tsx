import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { getAppContextForUser } from '@/lib/auth/roles'
import { requireSession } from '@/lib/auth/session'

export default async function DashboardRedirectPage() {
  const user = await requireSession('/')
  const context = await getAppContextForUser(user)

  if (context.role === 'coach' && context.hasCoachAccess && !context.hasStudentAccess) {
    redirect('/coach')
  }

  if (context.role === 'student' && !context.hasCoachAccess && context.hasStudentAccess) {
    redirect('/student')
  }

  if (!context.hasCoachAccess && !context.hasStudentAccess) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f6efe5_0%,#fbfaf7_55%,#ffffff_100%)] px-4 py-10 text-stone-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-500">Account Check</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight">找不到對應身份</h1>
          <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">
            目前這個登入帳號尚未對應到 `coaches` 或 `athletes` 資料。請先確認 Supabase 內是否已有對應資料，再重新登入。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full bg-stone-900 px-5 py-3 font-semibold text-white transition hover:bg-stone-700">
              回首頁
            </Link>
            <LogoutButton />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6efe5_0%,#fbfaf7_55%,#ffffff_100%)] px-4 py-10 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-500">Account Check</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight">這個帳號存在身份衝突</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">
          目前同一個登入 Email 同時匹配到 `coaches` 與 `athletes`。為了避免誤把教練或學員資料綁錯到另一個身份，系統已停止自動分流，請先聯絡管理員整理資料後再登入。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="lab-btn-primary">
            回首頁
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  )
}
