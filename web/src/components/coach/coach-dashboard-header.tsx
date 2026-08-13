'use client'

import { useState } from 'react'

import { PasswordUpdateForm } from '@/components/auth/password-update-form'

type CoachDashboardHeaderProps = {
  roleLabel: string
  athleteCount: number
  userEmail?: string | null
  coachName?: string | null
  allowPasswordManagement?: boolean
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-h-[3.5rem] min-w-[9.5rem] items-center gap-2 rounded-[0.9rem] bg-slate-50 px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">
      <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}：</span>
      <span className="truncate text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export function CoachDashboardHeader({
  roleLabel,
  athleteCount,
  userEmail,
  coachName,
  allowPasswordManagement = true,
}: CoachDashboardHeaderProps) {
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  return (
    <>
      <section className="lab-card overflow-hidden p-4 sm:p-8">
        <div className="lab-section-heading lab-section-heading-flush flex-col gap-3 !px-4 !py-4 sm:gap-4 sm:!px-6 sm:!py-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="lab-eyebrow">Coach Dashboard</p>
            <h2 className="lab-section-title mt-2 sm:mt-3">教練總覽</h2>
          </div>

          <div className="flex gap-2 sm:flex-wrap sm:gap-3">
            <button
              type="button"
              className="lab-btn-secondary !min-h-9 flex-1 px-3 py-2 text-sm font-bold sm:!min-h-10 sm:flex-none sm:px-4"
              onClick={() => setIsProfileOpen(true)}
            >
              教練資料
            </button>
            {allowPasswordManagement ? (
              <button
                type="button"
                className="lab-btn-secondary !min-h-9 flex-1 px-3 py-2 text-sm font-bold sm:!min-h-10 sm:flex-none sm:px-4"
                onClick={() => setIsPasswordOpen(true)}
              >
                修改密碼
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 sm:mt-6 sm:flex-wrap sm:gap-3">
          <span className={roleLabel === '總教練' ? 'lab-badge-primary' : 'lab-badge-info'}>{roleLabel}</span>
          <div className="sm:hidden rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">學員 {athleteCount}</div>
          <div className="hidden sm:block"><SummaryStat label="學員" value={athleteCount} /></div>
        </div>
      </section>

      {isProfileOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[1.5rem] bg-white p-5 shadow-[0_28px_64px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="lab-eyebrow">Coach Profile</p>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">教練資料</h3>
              </div>
              <button
                type="button"
                className="lab-btn-secondary !min-h-10 shrink-0 border-slate-200 bg-slate-50 px-4 py-2 text-sm shadow-none"
                onClick={() => setIsProfileOpen(false)}
              >
                關閉
              </button>
            </div>

            <div className="rounded-[1.25rem] bg-slate-50 px-5 py-5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">
              <dl className="space-y-3 text-sm text-slate-600">
                <div className="flex items-start justify-between gap-6 border-b border-slate-200/70 pb-3">
                  <dt className="shrink-0 font-medium text-slate-500">姓名</dt>
                  <dd className="text-right font-semibold text-slate-900">{coachName ?? '-'}</dd>
                </div>
                <div className="flex items-start justify-between gap-6 border-b border-slate-200/70 pb-3">
                  <dt className="shrink-0 font-medium text-slate-500">Email</dt>
                  <dd className="max-w-[15rem] break-all text-right font-semibold text-slate-900 sm:max-w-none">{userEmail ?? '-'}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="shrink-0 font-medium text-slate-500">可管理學員</dt>
                  <dd className="text-right font-semibold text-slate-900">{athleteCount}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      ) : null}

      {allowPasswordManagement && isPasswordOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[1.5rem] bg-white p-5 shadow-[0_28px_64px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="lab-eyebrow">Password</p>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">修改密碼</h3>
                <p className="lab-copy mt-3">需要時再更新自己的教練端密碼。更新成功後，下次請使用新密碼登入。</p>
              </div>
              <button
                type="button"
                className="lab-btn-secondary !min-h-10 shrink-0 border-slate-200 bg-slate-50 px-4 py-2 text-sm shadow-none"
                onClick={() => setIsPasswordOpen(false)}
              >
                關閉
              </button>
            </div>

            <PasswordUpdateForm
              title="修改密碼"
              description="需要時再更新自己的教練端密碼。更新成功後，下次請使用新密碼登入。"
              successMessage="密碼已更新。下次請使用新密碼登入。"
              surface="plain"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
