import { Suspense } from 'react'

import { PasswordRecoveryForm } from '@/components/auth/password-recovery-form'

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#efe7db_0%,#fbfaf7_100%)] px-4 py-10 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-stone-500">Password Reset</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">設定新密碼</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600 sm:text-base">
            請輸入新的密碼，完成後系統會帶你回到教練登入頁，再用新密碼登入。
          </p>
        </section>
        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<div className="lab-card p-6 text-sm text-slate-600">載入中...</div>}>
            <PasswordRecoveryForm />
          </Suspense>
        </section>
      </div>
    </main>
  )
}
