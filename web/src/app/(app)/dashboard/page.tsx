import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth/logout-button'
import { getAppContextForUser } from '@/lib/auth/roles'
import { requireSession } from '@/lib/auth/session'

export default async function DashboardRedirectPage() {
  const user = await requireSession('/')
  const context = await getAppContextForUser(user)

  if (context.hasCoachAccess && !context.hasStudentAccess) {
    redirect('/coach')
  }

  if (!context.hasCoachAccess && context.hasStudentAccess) {
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
        <h1 className="mt-4 text-3xl font-black tracking-tight">這個帳號同時具有兩種身份</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">
          依照目前 Streamlit 的實際資料邏輯，當同一個 Auth 帳號同時能匹配 `coaches` 與 `athletes` 時，並沒有全域單一角色，而是依你進入的頁面分別驗證權限。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/student" className="lab-btn-primary">
            以學員身份進入
          </Link>
          <Link href="/coach" className="lab-btn-secondary">
            以教練身份進入
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  )
}
