'use client'

import { useState } from 'react'

import { PasswordUpdateForm } from '@/components/auth/password-update-form'

type StudentDashboardPanelsProps = {
  athleteId: number
  studentName: string | null
  email: string | null
  sport: string | null
  mustChangePassword: boolean
}

export function StudentDashboardPanels({
  athleteId,
  studentName,
  email,
  sport,
  mustChangePassword,
}: StudentDashboardPanelsProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  return (
    <section className="mt-6 space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-4 rounded-[1.25rem] text-left transition hover:bg-slate-50/80"
          onClick={() => setIsProfileOpen((current) => !current)}
          aria-expanded={isProfileOpen}
        >
          <div className="min-w-0 space-y-3">
            <div>
              <p className="lab-eyebrow">Athlete Profile</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-900">{studentName ?? '未命名學員'}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="truncate font-medium text-slate-700">{email ?? '-'}</span>
              {mustChangePassword ? <span className="lab-badge-warning">需更新密碼</span> : <span className="lab-badge-success">可正常登入</span>}
            </div>
          </div>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition">
            {isProfileOpen ? '⌃' : '⌄'}
          </span>
        </button>

        {isProfileOpen ? (
          <dl className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[1rem] bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-500">姓名</dt>
              <dd className="mt-1 font-semibold text-slate-900">{studentName ?? '-'}</dd>
            </div>
            <div className="rounded-[1rem] bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-500">Email</dt>
              <dd className="mt-1 break-all font-semibold text-slate-900">{email ?? '-'}</dd>
            </div>
            <div className="rounded-[1rem] bg-slate-50 px-4 py-3">
              <dt className="font-medium text-slate-500">運動項目</dt>
              <dd className="mt-1 font-semibold text-slate-900">{sport ?? '-'}</dd>
            </div>
          </dl>
        ) : null}
      </article>

      <PasswordUpdateForm
        athleteId={athleteId}
        forceReset={mustChangePassword}
        title="修改密碼"
        description={
          mustChangePassword
            ? '你目前使用的是臨時密碼。請先完成更新，之後才能正常使用學員端功能。'
            : '需要時再打開修改。更新成功後，下次請使用新密碼登入。'
        }
        successMessage={
          mustChangePassword
            ? '密碼已更新。重新整理後即可正常查看課表。'
            : '密碼已更新。下次請使用新密碼登入。'
        }
        collapsible={!mustChangePassword}
        defaultOpen={mustChangePassword}
      />
    </section>
  )
}
