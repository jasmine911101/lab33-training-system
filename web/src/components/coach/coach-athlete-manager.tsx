'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { CoachDashboardHeader } from '@/components/coach/coach-dashboard-header'
import {
  coachDisplayName,
  rankAthletesBySearch,
  type CoachDirectoryEntry,
  type ManagedAthleteRecord,
} from '@/lib/types/coach-management'

type CoachAthleteManagerProps = {
  roleLabel: string
  userEmail?: string | null
  coachName?: string | null
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

function CreateAthleteSection({
  isHeadCoach,
  assignableCoaches,
  isCreateOpen,
  setIsCreateOpen,
  createName,
  setCreateName,
  createEmail,
  setCreateEmail,
  createSport,
  setCreateSport,
  selectedCreateCoachIds,
  toggleCreateCoach,
  handleCreateAthlete,
  createError,
  createSuccess,
  createdTempPassword,
  isCreating,
}: {
  isHeadCoach: boolean
  assignableCoaches: CoachDirectoryEntry[]
  isCreateOpen: boolean
  setIsCreateOpen: React.Dispatch<React.SetStateAction<boolean>>
  createName: string
  setCreateName: React.Dispatch<React.SetStateAction<string>>
  createEmail: string
  setCreateEmail: React.Dispatch<React.SetStateAction<string>>
  createSport: string
  setCreateSport: React.Dispatch<React.SetStateAction<string>>
  selectedCreateCoachIds: number[]
  toggleCreateCoach: (coachId: number) => void
  handleCreateAthlete: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  createError: string | null
  createSuccess: string | null
  createdTempPassword: { email: string; password: string } | null
  isCreating: boolean
}) {
  return (
    <div className="w-full xl:max-w-[30rem]">
      <div className="flex justify-end">
        <button
          type="button"
          className="lab-btn-secondary !min-h-10 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold shadow-none"
          onClick={() => setIsCreateOpen((current) => !current)}
          aria-expanded={isCreateOpen}
        >
          {isCreateOpen ? '收起新增學員' : '＋ 新增學員'}
        </button>
      </div>

      {isCreateOpen ? (
        <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_16px_32px_rgba(15,23,42,0.08)] sm:p-6">
          <form className="grid gap-4" onSubmit={(event) => void handleCreateAthlete(event)}>
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
        </div>
      ) : null}
    </div>
  )
}

function ManagedAthletesSection({
  athletes,
  isHeadCoach,
  search,
  setSearch,
  filter,
  setFilter,
  filterOptions,
  openActionId,
  setOpenActionId,
  actionLoadingId,
  handleResetPassword,
  handleDeleteAthlete,
}: {
  athletes: ManagedAthleteRecord[]
  isHeadCoach: boolean
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
  filter: FilterValue
  setFilter: React.Dispatch<React.SetStateAction<FilterValue>>
  filterOptions: { value: FilterValue; label: string }[]
  openActionId: number | null
  setOpenActionId: React.Dispatch<React.SetStateAction<number | null>>
  actionLoadingId: number | null
  handleResetPassword: (athlete: ManagedAthleteRecord) => Promise<void>
  handleDeleteAthlete: (athlete: ManagedAthleteRecord) => Promise<void>
}) {
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

  return (
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
          <div className="space-y-3 md:hidden">
            {filteredAthletes.map((athlete, index) => {
              const openUpward = index >= filteredAthletes.length - 2

              return (
                <article key={athlete.id} className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/coach/athletes/${athlete.id}`}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-transparent bg-slate-50 px-4 py-2 text-base font-bold text-slate-900 transition hover:border-[var(--lab-accent-soft)] hover:bg-[var(--lab-accent-ghost)] hover:text-[var(--lab-accent)] active:scale-[0.99]"
                      >
                        <span className="truncate">{athlete.name ?? '未命名學員'}</span>
                        <span className="text-sm text-slate-400">›</span>
                      </Link>
                      <p className="mt-3 truncate text-sm text-slate-600">{athlete.email ?? '-'}</p>
                      <p className="mt-1 text-sm font-medium text-slate-700">{athlete.sport ?? '-'}</p>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => setOpenActionId((current) => (current === athlete.id ? null : athlete.id))}
                      >
                        操作
                      </button>

                      {openActionId === athlete.id ? (
                        <div
                          className={`absolute right-0 z-20 min-w-[12.5rem] rounded-[1rem] border border-slate-200 bg-white p-2 shadow-[0_16px_32px_rgba(15,23,42,0.14)] ${
                            openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
                          }`}
                        >
                          <button
                            type="button"
                            className="flex w-full min-w-0 items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            onClick={() => {
                              setOpenActionId(null)
                              void handleResetPassword(athlete)
                            }}
                            disabled={actionLoadingId === athlete.id}
                          >
                            <span>重設密碼</span>
                            <span className="text-slate-400">›</span>
                          </button>
                          <button
                            type="button"
                            className="flex w-full min-w-0 items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                            onClick={() => {
                              setOpenActionId(null)
                              void handleDeleteAthlete(athlete)
                            }}
                            disabled={actionLoadingId === athlete.id}
                          >
                            <span>刪除學員</span>
                            <span className="text-rose-300">›</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">狀態</span>
                    {athlete.must_change_password ? (
                      <span className="lab-badge-warning">需要更新密碼</span>
                    ) : (
                      <span className="lab-badge-success">正常</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="relative hidden md:block">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[32%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                    <th className="px-6 py-4">學員姓名</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">運動項目</th>
                    <th className="px-6 py-4">狀態</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAthletes.map((athlete, index) => {
                    const openUpward = index >= filteredAthletes.length - 2

                    return (
                      <tr key={athlete.id} className="align-middle">
                        <td className="px-6 py-4">
                          <Link
                            href={`/coach/athletes/${athlete.id}`}
                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-transparent bg-slate-50 px-4 py-2 text-sm font-bold text-slate-900 transition hover:border-[var(--lab-accent-soft)] hover:bg-[var(--lab-accent-ghost)] hover:text-[var(--lab-accent)] active:scale-[0.99]"
                          >
                            <span className="truncate">{athlete.name ?? '未命名學員'}</span>
                            <span className="text-sm text-slate-400">›</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          <div className="truncate">{athlete.email ?? '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                          <div className="truncate">{athlete.sport ?? '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          {athlete.must_change_password ? (
                            <span className="lab-badge-warning">需要更新密碼</span>
                          ) : (
                            <span className="lab-badge-success">正常</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="relative inline-flex">
                            <button
                              type="button"
                              className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              onClick={() => setOpenActionId((current) => (current === athlete.id ? null : athlete.id))}
                            >
                              操作
                            </button>

                            {openActionId === athlete.id ? (
                              <div
                                className={`absolute right-0 z-20 min-w-[12.5rem] rounded-[1rem] border border-slate-200 bg-white p-2 text-left shadow-[0_16px_32px_rgba(15,23,42,0.14)] ${
                                  openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
                                }`}
                              >
                                <button
                                  type="button"
                                  className="flex w-full min-w-0 items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                  onClick={() => {
                                    setOpenActionId(null)
                                    void handleResetPassword(athlete)
                                  }}
                                  disabled={actionLoadingId === athlete.id}
                                >
                                  <span>重設密碼</span>
                                  <span className="text-slate-400">›</span>
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full min-w-0 items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                                  onClick={() => {
                                    setOpenActionId(null)
                                    void handleDeleteAthlete(athlete)
                                  }}
                                  disabled={actionLoadingId === athlete.id}
                                >
                                  <span>刪除學員</span>
                                  <span className="text-rose-300">›</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export function CoachAthleteManager({ roleLabel, userEmail, coachName, initialAthletes, assignableCoaches, isHeadCoach }: CoachAthleteManagerProps) {
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
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const filterOptions = useMemo(() => buildFilterOptions(assignableCoaches), [assignableCoaches])

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

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord }>(`/api/coach/athletes/${athlete.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setAthletes((current) => current.map((item) => (item.id === athlete.id ? payload.athlete : item)))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDeleteAthlete(athlete: ManagedAthleteRecord) {
    const confirmed = window.confirm(`確認要刪除 ${athlete.name ?? athlete.email ?? '這位學員'} 嗎？`)
    if (!confirmed) return

    setActionLoadingId(athlete.id)

    try {
      const payload = await requestJson<{ athleteId: number }>(`/api/coach/athletes/${athlete.id}`, {
        method: 'DELETE',
      })
      setAthletes((current) => current.filter((item) => item.id !== payload.athleteId))
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <CoachDashboardHeader
        roleLabel={roleLabel}
        athleteCount={athletes.length}
        userEmail={userEmail}
        coachName={coachName}
        createAthleteSlot={
          <CreateAthleteSection
            isHeadCoach={isHeadCoach}
            assignableCoaches={assignableCoaches}
            isCreateOpen={isCreateOpen}
            setIsCreateOpen={setIsCreateOpen}
            createName={createName}
            setCreateName={setCreateName}
            createEmail={createEmail}
            setCreateEmail={setCreateEmail}
            createSport={createSport}
            setCreateSport={setCreateSport}
            selectedCreateCoachIds={selectedCreateCoachIds}
            toggleCreateCoach={toggleCreateCoach}
            handleCreateAthlete={handleCreateAthlete}
            createError={createError}
            createSuccess={createSuccess}
            createdTempPassword={createdTempPassword}
            isCreating={isCreating}
          />
        }
      />

      <ManagedAthletesSection
        athletes={athletes}
        isHeadCoach={isHeadCoach}
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={setFilter}
        filterOptions={filterOptions}
        openActionId={openActionId}
        setOpenActionId={setOpenActionId}
        actionLoadingId={actionLoadingId}
        handleResetPassword={handleResetPassword}
        handleDeleteAthlete={handleDeleteAthlete}
      />
    </div>
  )
}
