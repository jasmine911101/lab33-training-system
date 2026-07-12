'use client'

import { useState } from 'react'

import { PasswordUpdateForm } from '@/components/auth/password-update-form'

type StudentDashboardHeaderProps = {
  athleteId: number
  studentName?: string | null
  userEmail?: string | null
  sport?: string | null
  mustChangePassword: boolean
  allowPasswordManagement?: boolean
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[3.5rem] min-w-[9.5rem] items-center gap-2 rounded-[0.9rem] bg-slate-50 px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">
      <span className="shrink-0 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}：</span>
      <span className="truncate text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export function StudentDashboardHeader({
  athleteId,
  studentName,
  userEmail,
  sport,
  mustChangePassword,
  allowPasswordManagement = true,
}: StudentDashboardHeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(mustChangePassword && allowPasswordManagement)

  return (
    <>
      <section className="lab-card overflow-hidden px-6 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-6">
            <div className="min-w-0 max-w-3xl">
              <p className="lab-eyebrow">Logged In Experience</p>
              <h2 className="mt-3 font-display text-4xl leading-none text-slate-900 sm:text-5xl">Student Dashboard</h2>
              <p className="lab-copy mt-3">以行事曆查看自己的課表與一般事件，並直接回報實際訓練狀況。</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <SummaryStat label="Role" value="學員" />
                <SummaryStat label="Sport" value={sport ?? '-'} />
              </div>
            </div>

            <div className="flex flex-wrap justify-start gap-3 xl:justify-self-end xl:self-start">
              <button
                type="button"
                className="lab-btn-secondary !min-h-11 min-w-[7.5rem] border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold shadow-none"
                onClick={() => setIsProfileOpen(true)}
              >
                學員資料
              </button>
              {allowPasswordManagement ? (
                <button
                  type="button"
                  className="lab-btn-secondary !min-h-11 min-w-[8.5rem] border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-bold shadow-none"
                  onClick={() => setIsPasswordOpen(true)}
                >
                  修改密碼
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={mustChangePassword ? 'lab-badge-warning' : 'lab-badge-info'}>{mustChangePassword ? '需更新密碼' : '可正常登入'}</span>
            <span className="lab-badge bg-slate-100 text-slate-600">{userEmail ?? '未登入'}</span>
          </div>
        </div>
      </section>

      {isProfileOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[1.5rem] bg-white p-5 shadow-[0_28px_64px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="lab-eyebrow">Athlete Profile</p>
                <h3 className="mt-3 text-2xl font-bold text-slate-900">學員資料</h3>
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
                  <dd className="text-right font-semibold text-slate-900">{studentName ?? '-'}</dd>
                </div>
                <div className="flex items-start justify-between gap-6 border-b border-slate-200/70 pb-3">
                  <dt className="shrink-0 font-medium text-slate-500">Email</dt>
                  <dd className="max-w-[15rem] break-all text-right font-semibold text-slate-900 sm:max-w-none">{userEmail ?? '-'}</dd>
                </div>
                <div className="flex items-start justify-between gap-6">
                  <dt className="shrink-0 font-medium text-slate-500">運動項目</dt>
                  <dd className="text-right font-semibold text-slate-900">{sport ?? '-'}</dd>
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
                <p className="lab-copy mt-3">
                  {mustChangePassword
                    ? '你目前使用的是臨時密碼。請先完成更新，之後才能正常使用學員端功能。'
                    : '需要時再更新自己的學員端密碼。更新成功後，下次請使用新密碼登入。'}
                </p>
              </div>
              {!mustChangePassword ? (
                <button
                  type="button"
                  className="lab-btn-secondary !min-h-10 shrink-0 border-slate-200 bg-slate-50 px-4 py-2 text-sm shadow-none"
                  onClick={() => setIsPasswordOpen(false)}
                >
                  關閉
                </button>
              ) : null}
            </div>

            <PasswordUpdateForm
              athleteId={athleteId}
              forceReset={mustChangePassword}
              title="修改密碼"
              description={
                mustChangePassword
                  ? '你目前使用的是臨時密碼。請先完成更新，之後才能正常使用學員端功能。'
                  : '需要時再更新自己的學員端密碼。更新成功後，下次請使用新密碼登入。'
              }
              successMessage={
                mustChangePassword
                  ? '密碼已更新。重新整理後即可正常查看課表。'
                  : '密碼已更新。下次請使用新密碼登入。'
              }
              surface="plain"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
