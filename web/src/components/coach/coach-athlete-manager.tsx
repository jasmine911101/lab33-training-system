'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import {
  coachDisplayName,
  rankAthletesBySearch,
  type CoachDirectoryEntry,
  type ManagedAthleteRecord,
} from '@/lib/types/coach-management'

type CoachAthleteManagerProps = {
  initialAthletes: ManagedAthleteRecord[]
  assignableCoaches: CoachDirectoryEntry[]
  isHeadCoach: boolean
}

type ApiSuccess<T> = T & {
  message?: string
}

type FilterValue = 'all' | 'unassigned' | `coach:${number}`

function buildFilterOptions(assignableCoaches: CoachDirectoryEntry[]) {
  const sorted = [...assignableCoaches].sort((left, right) => coachDisplayName(left).localeCompare(coachDisplayName(right), 'zh-Hant'))

  return [
    { value: 'all' as const, label: '全部' },
    { value: 'unassigned' as const, label: '未指派' },
    ...sorted.map((coach) => ({ value: `coach:${coach.id}` as const, label: coachDisplayName(coach) })),
  ]
}

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
  const [open, setOpen] = useState(false)
  const [selectedCoachIds, setSelectedCoachIds] = useState<number[]>(athlete.assignedCoachIds)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord }>(`/api/coach/athletes/${athlete.id}/assignment`, {
        method: 'PUT',
        body: JSON.stringify({ coachIds: selectedCoachIds }),
      })
      onSaved(payload.athlete, payload.message)
      setOpen(false)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新教練指派失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  function toggleCoach(coachId: number) {
    setSelectedCoachIds((current) =>
      current.includes(coachId) ? current.filter((value) => value !== coachId) : [...current, coachId],
    )
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-xs" onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '編輯'}
        </button>
      </div>
      {open ? (
        <div className="mt-3 rounded-[1rem] border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">直接調整這位學員可被哪些教練看到</p>
          <div className="mt-3 space-y-2">
            {assignableCoaches.length === 0 ? (
              <p className="text-sm text-slate-500">目前沒有可指派的一般教練。</p>
            ) : (
              assignableCoaches.map((coach) => (
                <label key={coach.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedCoachIds.includes(coach.id)}
                    onChange={() => toggleCoach(coach.id)}
                  />
                  <span>{coachDisplayName(coach)}</span>
                </label>
              ))
            )}
          </div>
          {error ? <p className="mt-3 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isSaving} onClick={handleSave}>
              {isSaving ? '儲存中...' : '儲存指派'}
            </button>
            <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setOpen(false)}>
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CoachAthleteManager({ initialAthletes, assignableCoaches, isHeadCoach }: CoachAthleteManagerProps) {
  const [athletes, setAthletes] = useState(initialAthletes)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createSport, setCreateSport] = useState('')
  const [selectedCreateCoachIds, setSelectedCreateCoachIds] = useState<number[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [createdTempPassword, setCreatedTempPassword] = useState<{ email: string; password: string } | null>(null)
  const [actionFeedback, setActionFeedback] = useState<Record<number, string>>({})
  const [actionError, setActionError] = useState<Record<number, string>>({})
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [confirmResetId, setConfirmResetId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [tempPasswordByAthleteId, setTempPasswordByAthleteId] = useState<Record<number, { email: string; password: string }>>({})

  const filterOptions = useMemo(() => buildFilterOptions(assignableCoaches), [assignableCoaches])

  const filteredAthletes = useMemo(() => {
    let rows = rankAthletesBySearch(athletes, search)

    if (filter === 'unassigned') {
      rows = rows.filter((athlete) => athlete.assignedCoachIds.length === 0)
    } else if (filter.startsWith('coach:')) {
      const coachId = Number(filter.split(':')[1])
      rows = rows.filter((athlete) => athlete.assignedCoachIds.includes(coachId))
    }

    return rows
  }, [athletes, filter, search])

  function patchAthlete(updatedAthlete: ManagedAthleteRecord) {
    setAthletes((current) => {
      const next = current.map((athlete) => (athlete.id === updatedAthlete.id ? updatedAthlete : athlete))
      return isHeadCoach
        ? [...next].sort((left, right) => {
            const leftAssigned = left.assignedCoachIds.length > 0 ? 1 : 0
            const rightAssigned = right.assignedCoachIds.length > 0 ? 1 : 0
            if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned
            return left.id - right.id
          })
        : next
    })
  }

  function setPerAthleteMessage(athleteId: number, message: string | undefined) {
    setActionFeedback((current) => ({ ...current, [athleteId]: message ?? '' }))
    setActionError((current) => ({ ...current, [athleteId]: '' }))
  }

  function setPerAthleteError(athleteId: number, message: string) {
    setActionError((current) => ({ ...current, [athleteId]: message }))
    setActionFeedback((current) => ({ ...current, [athleteId]: '' }))
  }

  function clearPerAthleteMessage(athleteId: number) {
    setActionFeedback((current) => ({ ...current, [athleteId]: '' }))
    setActionError((current) => ({ ...current, [athleteId]: '' }))
  }

  async function handleCreateAthlete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setCreateError(null)
    setCreateSuccess(null)
    setCreatedTempPassword(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord; tempPassword?: string }>(`/api/coach/athletes`, {
        method: 'POST',
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          sport: createSport,
          assignedCoachIds: selectedCreateCoachIds,
        }),
      })

      setAthletes((current) => {
        const next = [payload.athlete, ...current]
        return isHeadCoach
          ? [...next].sort((left, right) => {
              const leftAssigned = left.assignedCoachIds.length > 0 ? 1 : 0
              const rightAssigned = right.assignedCoachIds.length > 0 ? 1 : 0
              if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned
              return left.id - right.id
            })
          : next
      })
      setCreateSuccess(payload.message ?? '已新增學員。')
      if (payload.tempPassword) {
        setCreatedTempPassword({ email: payload.athlete.email ?? createEmail.trim().toLowerCase(), password: payload.tempPassword })
      }
      setCreateName('')
      setCreateEmail('')
      setCreateSport('')
      setSelectedCreateCoachIds([])
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : '新增學員失敗。')
    } finally {
      setIsCreating(false)
    }
  }

  function toggleCreateCoach(coachId: number) {
    setSelectedCreateCoachIds((current) =>
      current.includes(coachId) ? current.filter((value) => value !== coachId) : [...current, coachId],
    )
  }

  async function handleResetPassword(athlete: ManagedAthleteRecord) {
    setActionLoadingId(athlete.id)
    clearPerAthleteMessage(athlete.id)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord; tempPassword?: string }>(`/api/coach/athletes/${athlete.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      patchAthlete(payload.athlete)
      setPerAthleteMessage(athlete.id, payload.message)
      if (payload.tempPassword) {
        const tempPassword = payload.tempPassword
        setTempPasswordByAthleteId((current) => ({
          ...current,
          [athlete.id]: { email: payload.athlete.email ?? athlete.email ?? '-', password: tempPassword },
        }))
      }
      setConfirmResetId(null)
    } catch (requestError) {
      setPerAthleteError(athlete.id, requestError instanceof Error ? requestError.message : '重設臨時密碼失敗。')
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDeleteAthlete(athlete: ManagedAthleteRecord) {
    setActionLoadingId(athlete.id)
    clearPerAthleteMessage(athlete.id)

    try {
      const payload = await requestJson<{ athleteId: number }>(`/api/coach/athletes/${athlete.id}`, {
        method: 'DELETE',
      })
      setAthletes((current) => current.filter((item) => item.id !== payload.athleteId))
      setConfirmDeleteId(null)
    } catch (requestError) {
      setPerAthleteError(athlete.id, requestError instanceof Error ? requestError.message : '刪除學員失敗。')
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <article className="lab-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="lab-eyebrow">New Athlete</p>
            <h2 className="mt-2 text-3xl font-bold leading-none text-slate-900">新增學員</h2>
            {isCreateOpen ? (
              <p className="mt-3 text-sm leading-7 text-slate-600">
                新學員建立時會同時建立或連結 Supabase Auth 帳號，並產生臨時密碼。一般教練新增後會自動指派給自己；總教練可先保留未指派或直接指派給教練。
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isCreateOpen ? (
              <span className={isHeadCoach ? 'lab-badge-primary' : 'lab-badge-info'}>
                {isHeadCoach ? '總教練可跨教練分派' : '一般教練自動綁定自己'}
              </span>
            ) : null}
            <button
              type="button"
              className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
              onClick={() => setIsCreateOpen((current) => !current)}
              aria-expanded={isCreateOpen}
            >
              {isCreateOpen ? '收起' : '展開'}
            </button>
          </div>
        </div>

        {isCreateOpen ? (
          <form className="mt-6 grid gap-4" onSubmit={handleCreateAthlete}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="athlete-name">姓名</label>
                <input id="athlete-name" className="lab-input" value={createName} onChange={(event) => setCreateName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="athlete-email">Email</label>
                <input id="athlete-email" type="email" className="lab-input" value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="athlete-sport">運動項目</label>
                <input id="athlete-sport" className="lab-input" value={createSport} onChange={(event) => setCreateSport(event.target.value)} />
              </div>
            </div>

            {isHeadCoach ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">建立後直接指派給教練</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {assignableCoaches.map((coach) => (
                    <label key={coach.id} className="flex items-center gap-3 rounded-[1rem] border border-slate-200 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedCreateCoachIds.includes(coach.id)}
                        onChange={() => toggleCreateCoach(coach.id)}
                      />
                      <span>{coachDisplayName(coach)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {createError ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</p> : null}
            {createSuccess ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createSuccess}</p> : null}
            {createdTempPassword ? (
              <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">請把這組臨時密碼交給學員</p>
                <p className="mt-2">Email：{createdTempPassword.email}</p>
                <p className="mt-1 font-mono">Temporary Password：{createdTempPassword.password}</p>
              </div>
            ) : null}

            <div>
              <button type="submit" className="lab-btn-primary w-full sm:w-auto" disabled={isCreating}>
                {isCreating ? '建立中...' : '新增學員'}
              </button>
            </div>
          </form>
        ) : null}
      </article>

      <article className="lab-card p-6 sm:p-7">
        <p className="lab-eyebrow">Managed Athletes</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="lab-section-title">學員列表</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {isHeadCoach
                ? '總教練可查看全部學員、快速篩選未指派學員，並直接在列表中調整教練指派。'
                : '一般教練只會看到 coach_athletes 中已指派給自己的學員，不能查看或操作其他教練的學生。'}
            </p>
          </div>
          <span className={isHeadCoach ? 'lab-badge-primary' : 'lab-badge-info'}>
            {isHeadCoach ? '全部學員可見' : '僅自己管理學員'}
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-2">
            <label htmlFor="coach-athlete-search" className="text-sm font-semibold text-slate-700">搜尋學員</label>
            <input
              id="coach-athlete-search"
              className="lab-input"
              placeholder="輸入姓名、Email 或運動項目"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {isHeadCoach ? (
            <div className="space-y-2">
              <label htmlFor="coach-athlete-filter" className="text-sm font-semibold text-slate-700">篩選學員</label>
              <select id="coach-athlete-filter" className="lab-input" value={filter} onChange={(event) => setFilter(event.target.value as FilterValue)}>
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {filteredAthletes.length === 0 ? (
          <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">目前沒有符合條件的學員。</div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredAthletes.map((athlete) => {
              const athleteTempPassword = tempPasswordByAthleteId[athlete.id]
              const rowFeedback = actionFeedback[athlete.id]
              const rowError = actionError[athlete.id]
              const isBusy = actionLoadingId === athlete.id

              return (
                <article key={athlete.id} className="lab-card-muted p-5 sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{athlete.name ?? '未命名學員'}</h3>
                          <p className="mt-1 text-sm text-slate-600">{athlete.email ?? '-'}</p>
                        </div>
                        {athlete.must_change_password ? (
                          <span className="lab-badge-warning">需更新密碼</span>
                        ) : (
                          <span className="lab-badge-success">可正常登入</span>
                        )}
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                        <div className="rounded-[1rem] bg-white px-4 py-3"><dt className="font-medium text-slate-500">運動項目</dt><dd className="mt-1 font-semibold text-slate-900">{athlete.sport ?? '-'}</dd></div>
                        <div className="rounded-[1rem] bg-white px-4 py-3"><dt className="font-medium text-slate-500">學員 ID</dt><dd className="mt-1 font-semibold text-slate-900">{athlete.id}</dd></div>
                        <div className="rounded-[1rem] bg-white px-4 py-3"><dt className="font-medium text-slate-500">程度</dt><dd className="mt-1 font-semibold text-slate-900">{athlete.level ?? '-'}</dd></div>
                      </dl>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
                        <p className="text-sm font-semibold text-slate-700">指派教練：</p>
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            {athlete.assignedCoachBadges.length > 0 ? (
                              athlete.assignedCoachBadges.map((badge) => (
                                <span key={`${athlete.id}-${badge.id}`} className={badge.roleLabel === '總教練' ? 'lab-badge-primary' : 'lab-badge-info'}>
                                  {badge.label} · {badge.roleLabel}
                                </span>
                              ))
                            ) : (
                              <span className="lab-badge-warning">未指派</span>
                            )}
                          </div>
                          {isHeadCoach ? (
                            <div className="mt-3 max-w-2xl">
                              <AssignmentEditor
                                athlete={athlete}
                                assignableCoaches={assignableCoaches}
                                onSaved={(updatedAthlete, message) => {
                                  patchAthlete(updatedAthlete)
                                  setPerAthleteMessage(athlete.id, message)
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {rowError ? <p className="mt-4 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{rowError}</p> : null}
                      {rowFeedback ? <p className="mt-4 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{rowFeedback}</p> : null}
                      {athleteTempPassword ? (
                        <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                          <p className="font-semibold">請把這組臨時密碼交給學員</p>
                          <p className="mt-2">Email：{athleteTempPassword.email}</p>
                          <p className="mt-1 font-mono">Temporary Password：{athleteTempPassword.password}</p>
                        </div>
                      ) : null}

                      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <Link href={`/coach/athletes/${athlete.id}`} className="lab-btn-primary w-full">
                          查看課表
                        </Link>
                        <button type="button" className="lab-btn-secondary w-full sm:w-auto" disabled={isBusy} onClick={() => setConfirmResetId((current) => (current === athlete.id ? null : athlete.id))}>
                          {confirmResetId === athlete.id ? '收起重設確認' : '重設臨時密碼'}
                        </button>
                        <button type="button" className="lab-btn-secondary w-full sm:w-auto" disabled={isBusy} onClick={() => setConfirmDeleteId((current) => (current === athlete.id ? null : athlete.id))}>
                          {confirmDeleteId === athlete.id ? '收起刪除確認' : '刪除學員'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {confirmResetId === athlete.id ? (
                    <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                      <p className="font-semibold">確認要重設 {athlete.name ?? athlete.email ?? '這位學員'} 的臨時密碼嗎？</p>
                      <p className="mt-2">重設後舊密碼會失效，學員下次登入時會被要求修改密碼。</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isBusy} onClick={() => void handleResetPassword(athlete)}>
                          {isBusy ? '重設中...' : '確認重設'}
                        </button>
                        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setConfirmResetId(null)}>
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {confirmDeleteId === athlete.id ? (
                    <div className="mt-4 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
                      <p className="font-semibold">確認要刪除 {athlete.name ?? athlete.email ?? '這位學員'} 嗎？</p>
                      <p className="mt-2">刪除後會移除學員資料，並清掉已安排的課表板塊。這個操作需要再次確認。</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isBusy} onClick={() => void handleDeleteAthlete(athlete)}>
                          {isBusy ? '刪除中...' : '確認刪除'}
                        </button>
                        <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setConfirmDeleteId(null)}>
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </article>
    </div>
  )
}
