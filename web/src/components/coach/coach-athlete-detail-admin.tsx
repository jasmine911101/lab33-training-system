'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { coachDisplayName, type CoachDirectoryEntry, type ManagedAthleteRecord } from '@/lib/types/coach-management'

type ApiSuccess<T> = T & { message?: string }

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null
  if (!response.ok) {
    throw new Error(payload?.error ?? '操作失敗，請稍後再試。')
  }

  return (payload ?? {}) as ApiSuccess<T>
}

function AssignmentEditor({
  athlete,
  assignableCoaches,
  onSaved,
}: {
  athlete: ManagedAthleteRecord
  assignableCoaches: CoachDirectoryEntry[]
  onSaved: (athlete: ManagedAthleteRecord, message?: string) => void
}) {
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(athlete.assignedCoachIds[0] ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord }>(`/api/coach/athletes/${athlete.id}/assignment`, {
        method: 'PUT',
        body: JSON.stringify({ coachId: selectedCoachId }),
      })
      onSaved(payload.athlete, payload.message)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新教練指派失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <p className="text-sm font-semibold text-slate-900">指派教練</p>
        <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{isOpen ? '收起' : '展開'}</span>
      </button>

      {isOpen ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input
                type="radio"
                name={`detail-assignment-${athlete.id}`}
                checked={selectedCoachId === null}
                onChange={() => setSelectedCoachId(null)}
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block font-semibold text-slate-900">未指派</span>
                <span className="block text-xs leading-6 text-slate-500">移除目前負責教練，但保留已安排課表、板塊與回報資料。</span>
              </span>
            </label>
            {assignableCoaches.length === 0 ? (
              <p className="text-sm text-slate-500">目前沒有可指派的一般教練。</p>
            ) : (
              <>
                {assignableCoaches.map((coach) => (
                  <label key={coach.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={`detail-assignment-${athlete.id}`}
                      checked={selectedCoachId === coach.id}
                      onChange={() => setSelectedCoachId(coach.id)}
                      className="mt-1"
                    />
                    <span className="block leading-6">{coachDisplayName(coach)}</span>
                  </label>
                ))}
              </>
            )}
          </div>
          {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isSaving} onClick={handleSave}>
            {isSaving ? '儲存中...' : '儲存指派'}
          </button>
        </>
      ) : null}
    </div>
  )
}

export function CoachAthleteDetailAdmin({
  initialAthlete,
  assignableCoaches,
  isHeadCoach,
}: {
  initialAthlete: ManagedAthleteRecord
  assignableCoaches: CoachDirectoryEntry[]
  isHeadCoach: boolean
}) {
  const router = useRouter()
  const [athlete, setAthlete] = useState(initialAthlete)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  async function handleResetPassword() {
    setIsResetting(true)
    setError(null)
    setFeedback(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord; tempPassword?: string }>(`/api/coach/athletes/${athlete.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setAthlete(payload.athlete)
      setFeedback(payload.message ?? '已重設臨時密碼。')
      if (payload.tempPassword) {
        setTempPassword({ email: payload.athlete.email ?? athlete.email ?? '-', password: payload.tempPassword })
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '重設臨時密碼失敗。')
    } finally {
      setIsResetting(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    setFeedback(null)

    try {
      await requestJson<{ athleteId: number }>(`/api/coach/athletes/${athlete.id}`, {
        method: 'DELETE',
      })
      router.push('/coach')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '刪除學員失敗。')
      setIsDeleting(false)
    }
  }

  return (
    <section className="space-y-6">
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
              <h3 className="mt-3 text-2xl font-bold text-slate-900">{athlete.name ?? '未命名學員'}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="truncate font-medium text-slate-700">{athlete.email ?? '-'}</span>
              {!athlete.user_id ? (
                <span className="lab-badge-info">等待 Google 綁定</span>
              ) : athlete.must_change_password ? (
                <span className="lab-badge-warning">需更新密碼</span>
              ) : (
                <span className="lab-badge-success">可正常登入</span>
              )}
            </div>
          </div>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition">
            {isProfileOpen ? '⌃' : '⌄'}
          </span>
        </button>

        {isProfileOpen ? (
          <>
            <dl className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1rem] bg-slate-50 px-4 py-3"><dt className="font-medium text-slate-500">姓名</dt><dd className="mt-1 font-semibold text-slate-900">{athlete.name ?? '-'}</dd></div>
              <div className="rounded-[1rem] bg-slate-50 px-4 py-3"><dt className="font-medium text-slate-500">Email</dt><dd className="mt-1 font-semibold text-slate-900 break-all">{athlete.email ?? '-'}</dd></div>
              <div className="rounded-[1rem] bg-slate-50 px-4 py-3"><dt className="font-medium text-slate-500">運動項目</dt><dd className="mt-1 font-semibold text-slate-900">{athlete.sport ?? '-'}</dd></div>
              <div className="rounded-[1rem] bg-slate-50 px-4 py-3"><dt className="font-medium text-slate-500">程度</dt><dd className="mt-1 font-semibold text-slate-900">{athlete.level ?? '-'}</dd></div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              {athlete.user_id ? (
                <button type="button" className="lab-btn-secondary" disabled={isResetting} onClick={() => void handleResetPassword()}>
                  {isResetting ? '重設中...' : '重設臨時密碼'}
                </button>
              ) : null}
              <button type="button" className="lab-btn-secondary" onClick={() => setConfirmDelete((current) => !current)}>
                {confirmDelete ? '收起刪除確認' : '刪除學員'}
              </button>
            </div>

            {!athlete.user_id ? (
              <p className="mt-4 rounded-[1rem] bg-sky-50 px-4 py-3 text-sm text-sky-700">
                這位學員尚未完成第一次 Google 登入綁定，目前不會建立臨時密碼或 Supabase Auth 帳號。
              </p>
            ) : null}

            {feedback ? <p className="mt-4 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p> : null}
            {error ? <p className="mt-4 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {tempPassword ? (
              <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">請把這組臨時密碼交給學員</p>
                <p className="mt-2">Email：{tempPassword.email}</p>
                <p className="mt-1 font-mono">Temporary Password：{tempPassword.password}</p>
              </div>
            ) : null}

            {confirmDelete ? (
              <div className="mt-4 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
                <p className="font-semibold">確認要刪除 {athlete.name ?? athlete.email ?? '這位學員'} 嗎？</p>
                <p className="mt-2">刪除後會移除學員資料，並清掉已安排的課表板塊。</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isDeleting} onClick={() => void handleDelete()}>
                    {isDeleting ? '刪除中...' : '確認刪除'}
                  </button>
                  <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setConfirmDelete(false)}>
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </article>

      {isHeadCoach ? (
        <AssignmentEditor
          key={`${athlete.id}-${athlete.assignedCoachIds.join(',')}`}
          athlete={athlete}
          assignableCoaches={assignableCoaches}
          onSaved={(updatedAthlete, message) => {
            setAthlete(updatedAthlete)
            setFeedback(message ?? '已更新教練指派。')
            setError(null)
          }}
        />
      ) : null}
    </section>
  )
}
