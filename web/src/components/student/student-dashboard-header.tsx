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
      <section className="lab-card overflow-hidden">
        <div className="lab-section-heading !rounded-none !border-x-0 !border-t-0 flex-col gap-4 sm:gap-5 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
            <div className="min-w-0 max-w-3xl">
              <p className="lab-eyebrow hidden sm:block">Student Dashboard</p>
              <h2 className="lab-section-title sm:mt-3">我的訓練</h2>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-start sm:gap-3 xl:justify-end">
              <button
                type="button"
                className="lab-btn-secondary !min-h-11 min-w-0 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold shadow-none sm:min-w-[7.5rem] sm:px-5"
                onClick={() => setIsProfileOpen(true)}
              >
                學員資料
              </button>
              {allowPasswordManagement ? (
                <button
                  type="button"
                  className="lab-btn-secondary !min-h-11 min-w-0 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold shadow-none sm:min-w-[8.5rem] sm:px-5"
                  onClick={() => setIsPasswordOpen(true)}
                >
                  修改密碼
                </button>
                ) : null}
            </div>
        </div>
        {mustChangePassword || sport ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
            <span className={mustChangePassword ? 'lab-badge-warning' : 'lab-badge-info'}>{mustChangePassword ? '需更新密碼' : '學員'}</span>
            {sport ? <span className="lab-badge bg-white text-slate-600">運動項目：{sport}</span> : null}
          </div>
        ) : null}
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
