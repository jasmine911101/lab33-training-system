'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CoachDashboardHeader } from '@/components/coach/coach-dashboard-header'
import {
  coachDisplayName,
  rankAthletesBySearch,
  type CoachDirectoryEntry,
  type ManagedCoachRecord,
  type ManagedAthleteRecord,
  rankCoachesBySearch,
} from '@/lib/types/coach-management'

type CoachAthleteManagerProps = {
  roleLabel: string
  userEmail?: string | null
  coachName?: string | null
  currentCoachId: number
  initialAthletes: ManagedAthleteRecord[]
  initialCoaches: ManagedCoachRecord[]
  assignableCoaches: CoachDirectoryEntry[]
  isHeadCoach: boolean
  allowPasswordManagement?: boolean
}

type ApiSuccess<T> = T & {
  message?: string
}

type FilterValue = 'all' | 'mine' | 'unassigned' | `coach:${number}`

type AssignmentDialogState = {
  athlete: ManagedAthleteRecord
  selectedCoachId: number | null
}

type CoachEditorState = {
  coachId: number | null
  name: string
  email: string
  hasBoundGoogle: boolean
}

type CoachDeleteDialogState = {
  coach: ManagedCoachRecord
}

function buildFilterOptions(assignableCoaches: CoachDirectoryEntry[], isHeadCoach: boolean) {
  const sorted = [...assignableCoaches].sort((left, right) => coachDisplayName(left).localeCompare(coachDisplayName(right), 'zh-Hant'))

  return [
    { value: 'all' as const, label: '全部' },
    ...(isHeadCoach ? [{ value: 'mine' as const, label: '只看自己管理學員' }] : []),
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
  selectedCreateCoachId,
  setSelectedCreateCoachId,
  handleCreateAthlete,
  createError,
  createSuccess,
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
  selectedCreateCoachId: number | null
  setSelectedCreateCoachId: React.Dispatch<React.SetStateAction<number | null>>
  handleCreateAthlete: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  createError: string | null
  createSuccess: string | null
  isCreating: boolean
}) {
  return (
    <div className="w-full">
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
        <div className="mt-4 w-full rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_16px_32px_rgba(15,23,42,0.08)] sm:p-6 lg:p-7">
          <form className="grid gap-4" onSubmit={(event) => void handleCreateAthlete(event)}>
            <div className="grid gap-4 lg:grid-cols-3">
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
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="flex min-h-[4.25rem] cursor-pointer items-start gap-3 rounded-[1rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                    <input
                      type="radio"
                      name="create-athlete-coach"
                      checked={selectedCreateCoachId === null}
                      onChange={() => setSelectedCreateCoachId(null)}
                      className="mt-1"
                    />
                    <span className="space-y-1">
                      <span className="block font-semibold text-slate-900">先不指派</span>
                      <span className="block text-xs leading-6 text-slate-500">建立後保持未指派，之後再轉給特定教練。</span>
                    </span>
                  </label>
                  {assignableCoaches.map((coach) => (
                    <label key={coach.id} className="flex min-h-[4.25rem] cursor-pointer items-start gap-3 rounded-[1rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                      <input
                        type="radio"
                        name="create-athlete-coach"
                        checked={selectedCreateCoachId === coach.id}
                        onChange={() => setSelectedCreateCoachId(coach.id)}
                        className="mt-1"
                      />
                      <span className="block leading-6">{coachDisplayName(coach)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {createError ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</p> : null}
            {createSuccess ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{createSuccess}</p> : null}
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

function AssignmentDialog({
  state,
  assignableCoaches,
  isSaving,
  error,
  onClose,
  onSelectCoach,
  onSave,
}: {
  state: AssignmentDialogState
  assignableCoaches: CoachDirectoryEntry[]
  isSaving: boolean
  error: string | null
  onClose: () => void
  onSelectCoach: (coachId: number | null) => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-2xl rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="lab-eyebrow">Coach Assignment</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">指派教練</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              目前正在調整 <span className="font-semibold text-slate-900">{state.athlete.name ?? state.athlete.email ?? '這位學員'}</span> 的教練指派。
            </p>
          </div>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onClose}>
            關閉
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-[4.25rem] cursor-pointer items-start gap-3 rounded-[1rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            <input
              type="radio"
              name="assignment-coach"
              checked={state.selectedCoachId === null}
              onChange={() => onSelectCoach(null)}
              className="mt-1"
            />
            <span className="space-y-1">
              <span className="block font-semibold text-slate-900">未指派</span>
              <span className="block text-xs leading-6 text-slate-500">移除目前負責教練，但保留學員既有課表與回報資料。</span>
            </span>
          </label>
          {assignableCoaches.length === 0 ? (
            <p className="text-sm text-slate-500">目前沒有可指派的一般教練。</p>
          ) : (
            assignableCoaches.map((coach) => (
              <label key={coach.id} className="flex min-h-[4.25rem] cursor-pointer items-start gap-3 rounded-[1rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                <input
                  type="radio"
                  name="assignment-coach"
                  checked={state.selectedCoachId === coach.id}
                  onChange={() => onSelectCoach(coach.id)}
                  className="mt-1"
                />
                <span className="block leading-6">{coachDisplayName(coach)}</span>
              </label>
            ))
          )}
        </div>

        {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isSaving} onClick={onSave}>
            {isSaving ? '儲存中...' : '儲存指派'}
          </button>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" disabled={isSaving} onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

function formatCreatedDate(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function CoachEditorDialog({
  state,
  error,
  success,
  isSaving,
  onClose,
  onChange,
  onSubmit,
}: {
  state: CoachEditorState
  error: string | null
  success: string | null
  isSaving: boolean
  onClose: () => void
  onChange: (field: 'name' | 'email', value: string) => void
  onSubmit: () => void
}) {
  const isEditing = state.coachId != null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-2xl rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="lab-eyebrow">Coach Management</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">{isEditing ? '編輯教練' : '新增教練'}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {isEditing
                ? '只會更新 public.coaches 的教練資料，不會自動修改 Google Auth 帳號。'
                : '只建立 public.coaches 資料，第一次 Google 登入時才會自動綁定 user_id。'}
            </p>
          </div>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onClose}>
            關閉
          </button>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="coach-editor-name" className="text-sm font-semibold text-slate-700">姓名</label>
              <input
                id="coach-editor-name"
                className="lab-input"
                value={state.name}
                onChange={(event) => onChange('name', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="coach-editor-email" className="text-sm font-semibold text-slate-700">Google Email</label>
              <input
                id="coach-editor-email"
                type="email"
                className="lab-input"
                value={state.email}
                onChange={(event) => onChange('email', event.target.value)}
              />
            </div>
          </div>

          {state.hasBoundGoogle ? (
            <p className="rounded-[1rem] bg-amber-50 px-4 py-3 text-sm text-amber-800">
              修改 Email 後，這位教練下次需要使用新的 Google Email 登入。系統不會自動修改 `auth.users`。
            </p>
          ) : null}

          {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" disabled={isSaving} onClick={onSubmit}>
              {isSaving ? '儲存中...' : isEditing ? '儲存教練資料' : '新增教練'}
            </button>
            <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" disabled={isSaving} onClick={onClose}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CoachDeleteDialog({
  state,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: {
  state: CoachDeleteDialogState
  isDeleting: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const coach = state.coach

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-2xl rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="lab-eyebrow">Delete Coach</p>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">確認刪除教練</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              你即將刪除 <span className="font-semibold text-slate-900">{coach.name ?? coach.email ?? `Coach ${coach.id}`}</span>。
            </p>
          </div>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={onClose}>
            關閉
          </button>
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          <p className="font-semibold">此操作無法復原。</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
            <li>該教練負責的學員會變成「未指派」</li>
            <li>該教練的 `public.coaches` 資料會刪除</li>
            <li>若該教練已綁定登入帳號，對應的 Supabase `auth.users` 也會刪除</li>
            <li>學員、課表、回報與一般事件都會保留</li>
          </ul>
        </div>

        <div className="mt-5 rounded-[1rem] bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p>教練 Email：{coach.email ?? '-'}</p>
          <p className="mt-1">目前負責學員數：{coach.managedAthleteCount}</p>
          <p className="mt-1">登入綁定：{coach.user_id ? '已綁定 Google / Auth user' : '尚未綁定登入帳號'}</p>
        </div>

        {error ? <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? '刪除中...' : '確認刪除教練'}
          </button>
          <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" disabled={isDeleting} onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

function CoachManagementSection({
  coaches,
  search,
  setSearch,
  isOpen,
  setIsOpen,
  currentCoachId,
  onCreate,
  onEdit,
  onDeleteRequest,
  deletingCoachId,
  feedbackMessage,
  feedbackError,
}: {
  coaches: ManagedCoachRecord[]
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  currentCoachId: number
  onCreate: () => void
  onEdit: (coach: ManagedCoachRecord) => void
  onDeleteRequest: (coach: ManagedCoachRecord) => void
  deletingCoachId: number | null
  feedbackMessage: string | null
  feedbackError: string | null
}) {
  const filteredCoaches = useMemo(() => rankCoachesBySearch(coaches, search), [coaches, search])

  return (
    <article className="lab-card p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="lab-eyebrow">Coach Management</p>
          <h2 className="lab-section-title mt-3">教練管理</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">只有總教練可以查看教練列表、建立新教練與調整教練資料。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="lab-btn-secondary !min-h-10 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold shadow-none"
            onClick={onCreate}
          >
            ＋ 新增教練
          </button>
          <button
            type="button"
            className="lab-btn-secondary !min-h-10 border-slate-200 bg-white px-4 py-2 text-sm font-bold shadow-none"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
          >
            {isOpen ? '收起教練列表' : '展開教練列表'}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="coach-management-search" className="text-sm font-semibold text-slate-700">搜尋教練</label>
            <input
              id="coach-management-search"
              className="lab-input"
              placeholder="輸入姓名或 Email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {feedbackError ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{feedbackError}</p> : null}
          {feedbackMessage ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedbackMessage}</p> : null}

          {filteredCoaches.length === 0 ? (
            <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">目前沒有符合條件的教練。</div>
          ) : (
            <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                    <th className="border-b border-slate-200 px-6 py-4">姓名</th>
                    <th className="border-b border-slate-200 px-6 py-4">Email</th>
                    <th className="border-b border-slate-200 px-6 py-4">負責學員數</th>
                    <th className="border-b border-slate-200 px-6 py-4">身分</th>
                    <th className="border-b border-slate-200 px-6 py-4">建立日期</th>
                    <th className="border-b border-slate-200 px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoaches.map((coach) => (
                    <tr key={coach.id} className="align-middle transition hover:bg-slate-50/60">
                      <td className="border-b border-slate-100 px-6 py-4 text-sm font-semibold text-slate-900 last:border-b-0">
                        {coach.name ?? '-'}
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-600 last:border-b-0">
                        {coach.email ?? '-'}
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-700 last:border-b-0">
                        {coach.managedAthleteCount} 位學員
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4 last:border-b-0">
                        <span className={coach.is_head_coach ? 'lab-badge-warning' : 'lab-badge-info'}>
                          {coach.is_head_coach ? '總教練' : '一般教練'}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-600 last:border-b-0">
                        {formatCreatedDate(coach.created_at)}
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4 text-right last:border-b-0">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                            onClick={() => onEdit(coach)}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                            onClick={() => onDeleteRequest(coach)}
                            disabled={deletingCoachId === coach.id || coach.id === currentCoachId}
                            title={coach.id === currentCoachId ? '目前不支援刪除正在登入的總教練帳號' : undefined}
                          >
                            {deletingCoachId === coach.id ? '刪除中...' : '刪除'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </article>
  )
}

function ActionDropdown({
  isHeadCoach,
  open,
  openUpward,
  loading,
  onToggle,
  onClose,
  onAssign,
  onReset,
  onDelete,
  canResetPassword,
}: {
  isHeadCoach: boolean
  open: boolean
  openUpward: boolean
  loading: boolean
  onToggle: () => void
  onClose: () => void
  onAssign: () => void
  onReset: () => void
  onDelete: () => void
  canResetPassword: boolean
}) {
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!open) return

    let isVisibleTrigger = false

    function updateMenuPosition() {
      const trigger = buttonRef.current
      if (!trigger) return

      const rect = trigger.getBoundingClientRect()
      const isHiddenTrigger = trigger.offsetParent === null || rect.width === 0 || rect.height === 0
      if (isHiddenTrigger) {
        isVisibleTrigger = false
        setMenuStyle(null)
        return
      }

      isVisibleTrigger = true

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const itemCount = (isHeadCoach ? 1 : 0) + (canResetPassword ? 1 : 0) + 1
      const gap = 8
      const width = 216
      const estimatedHeight = itemCount * 48 + 16

      const left = Math.max(gap, Math.min(rect.right - width, viewportWidth - width - gap))
      const shouldOpenUpward = openUpward || rect.bottom + gap + estimatedHeight > viewportHeight - gap
      const top = shouldOpenUpward
        ? Math.max(gap, rect.top - estimatedHeight - gap)
        : Math.min(viewportHeight - estimatedHeight - gap, rect.bottom + gap)

      setMenuStyle({ top, left, width })
    }

    function handlePointerDown(event: MouseEvent | PointerEvent) {
      if (!isVisibleTrigger) return
      const target = event.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      onClose()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isVisibleTrigger) return
      if (event.key === 'Escape') {
        onClose()
      }
    }

    updateMenuPosition()
    if (!isVisibleTrigger) {
      return
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [canResetPassword, isHeadCoach, open, onClose, openUpward])

  return (
    <div ref={buttonRef} className="relative inline-flex">
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onClick={onToggle}
      >
        操作
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[80] rounded-[1rem] border border-slate-200 bg-white p-2 text-left shadow-[0_16px_32px_rgba(15,23,42,0.14)]"
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width, minWidth: menuStyle.width }}
            >
              {isHeadCoach ? (
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={onAssign}
                >
                  <span className="block flex-1 whitespace-nowrap text-left [word-break:keep-all] [overflow-wrap:normal]">指派教練</span>
                  <span className="shrink-0 text-slate-400">›</span>
                </button>
              ) : null}
              {canResetPassword ? (
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  onClick={onReset}
                  disabled={loading}
                >
                  <span className="block flex-1 whitespace-nowrap text-left [word-break:keep-all] [overflow-wrap:normal]">重設密碼</span>
                  <span className="shrink-0 text-slate-400">›</span>
                </button>
              ) : null}
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between gap-3 whitespace-nowrap rounded-[0.85rem] px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                onClick={onDelete}
                disabled={loading}
              >
                <span className="block flex-1 whitespace-nowrap text-left [word-break:keep-all] [overflow-wrap:normal]">刪除學員</span>
                <span className="shrink-0 text-rose-300">›</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function ManagedAthletesSection({
  athletes,
  isHeadCoach,
  currentCoachId,
  search,
  setSearch,
  filter,
  setFilter,
  filterOptions,
  openActionId,
  setOpenActionId,
  actionLoadingId,
  resetPasswordFeedback,
  resetPasswordError,
  handleAssignCoach,
  handleResetPassword,
  handleDeleteAthlete,
}: {
  athletes: ManagedAthleteRecord[]
  isHeadCoach: boolean
  currentCoachId: number
  search: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
  filter: FilterValue
  setFilter: React.Dispatch<React.SetStateAction<FilterValue>>
  filterOptions: { value: FilterValue; label: string }[]
  openActionId: number | null
  setOpenActionId: React.Dispatch<React.SetStateAction<number | null>>
  actionLoadingId: number | null
  resetPasswordFeedback: { email: string; password: string; message: string } | null
  resetPasswordError: string | null
  handleAssignCoach: (athlete: ManagedAthleteRecord) => void
  handleResetPassword: (athlete: ManagedAthleteRecord) => Promise<void>
  handleDeleteAthlete: (athlete: ManagedAthleteRecord) => Promise<void>
}) {
  const filteredAthletes = useMemo(() => {
    let rows = rankAthletesBySearch(athletes, search)

    if (filter === 'mine') {
      rows = rows.filter((athlete) => athlete.assignedCoachIds.includes(currentCoachId))
    } else if (filter === 'unassigned') {
      rows = rows.filter((athlete) => athlete.assignedCoachIds.length === 0)
    } else if (filter.startsWith('coach:')) {
      const coachId = Number(filter.split(':')[1])
      rows = rows.filter((athlete) => athlete.assignedCoachIds.includes(coachId))
    }

    return rows
  }, [athletes, currentCoachId, filter, search])

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

      {resetPasswordError ? (
        <p className="mt-5 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{resetPasswordError}</p>
      ) : null}

      {resetPasswordFeedback ? (
        <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">{resetPasswordFeedback.message}</p>
          <p className="mt-2">Email：{resetPasswordFeedback.email}</p>
          <p className="mt-1 font-mono">Temporary Password：{resetPasswordFeedback.password}</p>
        </div>
      ) : null}

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
                      <ActionDropdown
                        isHeadCoach={isHeadCoach}
                        open={openActionId === athlete.id}
                        openUpward={openUpward}
                        loading={actionLoadingId === athlete.id}
                        canResetPassword={Boolean(athlete.user_id)}
                        onToggle={() => setOpenActionId((current) => (current === athlete.id ? null : athlete.id))}
                        onClose={() => setOpenActionId(null)}
                        onAssign={() => {
                          setOpenActionId(null)
                          handleAssignCoach(athlete)
                              }}
                        onReset={() => {
                          setOpenActionId(null)
                          void handleResetPassword(athlete)
                        }}
                        onDelete={() => {
                          setOpenActionId(null)
                          void handleDeleteAthlete(athlete)
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">指派教練</span>
                      <p className="mt-2 truncate text-sm text-slate-600">
                        {athlete.assignedCoachLabels.length > 0 ? athlete.assignedCoachLabels.join(', ') : '未指派'}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">狀態</span>
                    <div>
                      {!athlete.user_id ? (
                        <span className="lab-badge-info">等待 Google 綁定</span>
                      ) : athlete.must_change_password ? (
                        <span className="lab-badge-warning">需要更新密碼</span>
                      ) : (
                        <span className="lab-badge-success">正常</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="relative hidden md:block">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[26%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                      <th className="border-b border-slate-200 px-6 py-4">學員姓名</th>
                      <th className="border-b border-slate-200 px-6 py-4">Email</th>
                      <th className="border-b border-slate-200 px-6 py-4">運動項目</th>
                      <th className="border-b border-slate-200 px-6 py-4">指派教練</th>
                      <th className="border-b border-slate-200 px-6 py-4">狀態</th>
                      <th className="border-b border-slate-200 px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAthletes.map((athlete, index) => {
                      const openUpward = index >= filteredAthletes.length - 2

                      return (
                        <tr key={athlete.id} className="align-middle transition hover:bg-slate-50/60">
                          <td className="border-b border-slate-100 px-6 py-4 last:border-b-0">
                            <Link
                              href={`/coach/athletes/${athlete.id}`}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-transparent bg-slate-50 px-4 py-2 text-sm font-bold text-slate-900 transition hover:border-[var(--lab-accent-soft)] hover:bg-[var(--lab-accent-ghost)] hover:text-[var(--lab-accent)] active:scale-[0.99]"
                            >
                              <span className="truncate">{athlete.name ?? '未命名學員'}</span>
                              <span className="text-sm text-slate-400">›</span>
                            </Link>
                          </td>
                          <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-600 last:border-b-0">
                            <div className="truncate">{athlete.email ?? '-'}</div>
                          </td>
                          <td className="border-b border-slate-100 px-6 py-4 text-sm font-medium text-slate-700 last:border-b-0">
                            <div className="truncate">{athlete.sport ?? '-'}</div>
                          </td>
                          <td className="border-b border-slate-100 px-6 py-4 text-sm text-slate-600 last:border-b-0">
                            <div className="truncate">
                              {athlete.assignedCoachLabels.length > 0 ? athlete.assignedCoachLabels.join(', ') : '未指派'}
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-6 py-4 last:border-b-0">
                            {!athlete.user_id ? (
                              <span className="lab-badge-info">等待 Google 綁定</span>
                            ) : athlete.must_change_password ? (
                              <span className="lab-badge-warning">需要更新密碼</span>
                            ) : (
                              <span className="lab-badge-success">正常</span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-6 py-4 text-right last:border-b-0">
                            <ActionDropdown
                              isHeadCoach={isHeadCoach}
                              open={openActionId === athlete.id}
                              openUpward={openUpward}
                              loading={actionLoadingId === athlete.id}
                              canResetPassword={Boolean(athlete.user_id)}
                              onToggle={() => setOpenActionId((current) => (current === athlete.id ? null : athlete.id))}
                              onClose={() => setOpenActionId(null)}
                              onAssign={() => {
                                setOpenActionId(null)
                                handleAssignCoach(athlete)
                              }}
                              onReset={() => {
                                setOpenActionId(null)
                                void handleResetPassword(athlete)
                              }}
                              onDelete={() => {
                                setOpenActionId(null)
                                void handleDeleteAthlete(athlete)
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export function CoachAthleteManager({
  roleLabel,
  userEmail,
  coachName,
  currentCoachId,
  initialAthletes,
  initialCoaches,
  assignableCoaches,
  isHeadCoach,
  allowPasswordManagement = true,
}: CoachAthleteManagerProps) {
  const [athletes, setAthletes] = useState(initialAthletes)
  const [coaches, setCoaches] = useState(initialCoaches)
  const [coachDirectory, setCoachDirectory] = useState(assignableCoaches)
  const [search, setSearch] = useState('')
  const [coachSearch, setCoachSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCoachManagementOpen, setIsCoachManagementOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createSport, setCreateSport] = useState('')
  const [selectedCreateCoachId, setSelectedCreateCoachId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [openActionId, setOpenActionId] = useState<number | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState<{ email: string; password: string; message: string } | null>(null)
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null)
  const [assignmentDialog, setAssignmentDialog] = useState<AssignmentDialogState | null>(null)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [coachEditor, setCoachEditor] = useState<CoachEditorState | null>(null)
  const [coachEditorError, setCoachEditorError] = useState<string | null>(null)
  const [coachEditorSuccess, setCoachEditorSuccess] = useState<string | null>(null)
  const [coachEditorSaving, setCoachEditorSaving] = useState(false)
  const [coachDeleteDialog, setCoachDeleteDialog] = useState<CoachDeleteDialogState | null>(null)
  const [coachDeleteError, setCoachDeleteError] = useState<string | null>(null)
  const [coachDeleteSuccess, setCoachDeleteSuccess] = useState<string | null>(null)
  const [coachActionLoadingId, setCoachActionLoadingId] = useState<number | null>(null)

  const filterOptions = useMemo(() => buildFilterOptions(coachDirectory, isHeadCoach), [coachDirectory, isHeadCoach])

  function applyCoachCountToAthletes(nextCoaches: ManagedCoachRecord[]) {
    const labelByCoachId = new Map(nextCoaches.map((coach) => [coach.id, coachDisplayName(coach)]))

    setAthletes((current) =>
      current.map((athlete) => ({
        ...athlete,
        assignedCoachLabels: athlete.assignedCoachIds.map((coachId) => labelByCoachId.get(coachId) ?? `Coach ${coachId}`),
        assignedCoachBadges: athlete.assignedCoachIds.map((coachId) => {
          const match = nextCoaches.find((coach) => coach.id === coachId)
          return {
            id: coachId,
            label: labelByCoachId.get(coachId) ?? `Coach ${coachId}`,
            roleLabel: match?.is_head_coach ? '總教練' : '教練',
          } as const
        }),
      })),
    )
  }

  async function handleCreateAthlete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setCreateError(null)
    setCreateSuccess(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord }>(`/api/coach/athletes`, {
        method: 'POST',
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          sport: createSport,
          assignedCoachId: selectedCreateCoachId,
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
      if (isHeadCoach && payload.athlete.assignedCoachIds.length > 0) {
        setCoaches((current) =>
          current.map((coach) =>
            payload.athlete.assignedCoachIds.includes(coach.id)
              ? { ...coach, managedAthleteCount: coach.managedAthleteCount + 1 }
              : coach,
          ),
        )
      }
      setCreateSuccess(payload.message ?? '已新增學員。')
      setCreateName('')
      setCreateEmail('')
      setCreateSport('')
      setSelectedCreateCoachId(null)
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : '新增學員失敗。')
    } finally {
      setIsCreating(false)
    }
  }

  function openAssignCoachDialog(athlete: ManagedAthleteRecord) {
    setAssignmentError(null)
    setAssignmentDialog({
      athlete,
      selectedCoachId: athlete.assignedCoachIds[0] ?? null,
    })
  }

  function selectAssignmentCoach(coachId: number | null) {
    setAssignmentDialog((current) => {
      if (!current) return current
      return {
        ...current,
        selectedCoachId: coachId,
      }
    })
  }

  async function handleSaveAssignment() {
    if (!assignmentDialog) return

    setAssignmentSaving(true)
    setAssignmentError(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord }>(`/api/coach/athletes/${assignmentDialog.athlete.id}/assignment`, {
        method: 'PUT',
        body: JSON.stringify({ coachId: assignmentDialog.selectedCoachId }),
      })

      setAthletes((current) => current.map((athlete) => (athlete.id === payload.athlete.id ? payload.athlete : athlete)))
      if (isHeadCoach) {
        setCoaches((current) =>
          current.map((coach) => {
            const wasAssigned = assignmentDialog.athlete.assignedCoachIds.includes(coach.id)
            const isAssigned = payload.athlete.assignedCoachIds.includes(coach.id)
            if (wasAssigned === isAssigned) return coach

            return {
              ...coach,
              managedAthleteCount: Math.max(0, coach.managedAthleteCount + (isAssigned ? 1 : -1)),
            }
          }),
        )
      }
      setAssignmentDialog(null)
    } catch (requestError) {
      setAssignmentError(requestError instanceof Error ? requestError.message : '更新教練指派失敗。')
    } finally {
      setAssignmentSaving(false)
    }
  }

  async function handleResetPassword(athlete: ManagedAthleteRecord) {
    setActionLoadingId(athlete.id)
    setResetPasswordError(null)
    setResetPasswordFeedback(null)

    try {
      const payload = await requestJson<{ athlete: ManagedAthleteRecord; tempPassword?: string; message?: string }>(`/api/coach/athletes/${athlete.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setAthletes((current) => current.map((item) => (item.id === athlete.id ? payload.athlete : item)))
      if (payload.tempPassword) {
        setResetPasswordFeedback({
          email: payload.athlete.email ?? athlete.email ?? '-',
          password: payload.tempPassword,
          message: payload.message ?? '已重設臨時密碼。',
        })
      }
    } catch (requestError) {
      setResetPasswordError(requestError instanceof Error ? requestError.message : '重設臨時密碼失敗。')
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
      if (isHeadCoach) {
        setCoaches((current) =>
          current.map((coach) =>
            athlete.assignedCoachIds.includes(coach.id)
              ? { ...coach, managedAthleteCount: Math.max(0, coach.managedAthleteCount - 1) }
              : coach,
          ),
        )
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  function openCreateCoachDialog() {
    setCoachEditorError(null)
    setCoachEditorSuccess(null)
    setCoachDeleteError(null)
    setCoachDeleteSuccess(null)
    setCoachEditor({
      coachId: null,
      name: '',
      email: '',
      hasBoundGoogle: false,
    })
  }

  function openEditCoachDialog(coach: ManagedCoachRecord) {
    setCoachEditorError(null)
    setCoachEditorSuccess(null)
    setCoachDeleteError(null)
    setCoachDeleteSuccess(null)
    setCoachEditor({
      coachId: coach.id,
      name: coach.name ?? '',
      email: coach.email ?? '',
      hasBoundGoogle: Boolean(coach.user_id),
    })
  }

  function updateCoachEditorField(field: 'name' | 'email', value: string) {
    setCoachEditor((current) => (current ? { ...current, [field]: value } : current))
  }

  async function handleSaveCoach() {
    if (!coachEditor) return

    setCoachEditorSaving(true)
    setCoachEditorError(null)
    setCoachEditorSuccess(null)

    try {
      if (coachEditor.coachId == null) {
        const payload = await requestJson<{ coach: ManagedCoachRecord; message?: string }>(`/api/coach/coaches`, {
          method: 'POST',
          body: JSON.stringify({
            name: coachEditor.name,
            email: coachEditor.email,
          }),
        })

        const nextCoaches = [...coaches, payload.coach]
        setCoaches(nextCoaches)
        setCoachDirectory(nextCoaches.filter((coach) => coach.is_head_coach !== true))
        applyCoachCountToAthletes(nextCoaches)
        setCoachEditorSuccess(payload.message ?? '已新增教練。')
        setCoachEditor({
          coachId: null,
          name: '',
          email: '',
          hasBoundGoogle: false,
        })
        setIsCoachManagementOpen(true)
        return
      }

      const payload = await requestJson<{ coach: ManagedCoachRecord; message?: string }>(`/api/coach/coaches/${coachEditor.coachId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: coachEditor.name,
          email: coachEditor.email,
        }),
      })

      const nextCoaches = coaches.map((coach) => (coach.id === payload.coach.id ? payload.coach : coach))
      setCoaches(nextCoaches)
      setCoachDirectory(nextCoaches.filter((coach) => coach.is_head_coach !== true))
      applyCoachCountToAthletes(nextCoaches)
      setCoachEditorSuccess(payload.message ?? '已更新教練資料。')
    } catch (requestError) {
      setCoachEditorError(requestError instanceof Error ? requestError.message : '儲存教練資料失敗。')
    } finally {
      setCoachEditorSaving(false)
    }
  }

  async function handleDeleteCoach(coach: ManagedCoachRecord) {
    setCoachDeleteError(null)
    setCoachDeleteSuccess(null)
    setCoachDeleteDialog({ coach })
  }

  async function confirmDeleteCoach() {
    if (!coachDeleteDialog) return

    const coach = coachDeleteDialog.coach
    setCoachActionLoadingId(coach.id)
    setCoachDeleteError(null)

    try {
      const payload = await requestJson<{ coachId: number; unassignedAthleteCount: number; message?: string }>(`/api/coach/coaches/${coach.id}`, {
        method: 'DELETE',
      })

      const nextCoaches = coaches.filter((entry) => entry.id !== payload.coachId)
      setCoaches(nextCoaches)
      setCoachDirectory(nextCoaches.filter((coach) => coach.is_head_coach !== true))
      setAthletes((current) =>
        current.map((athlete) => {
          if (!athlete.assignedCoachIds.includes(payload.coachId)) return athlete

          const nextAssignedCoachIds = athlete.assignedCoachIds.filter((coachId) => coachId !== payload.coachId)
          const nextAssignedCoachBadges = athlete.assignedCoachBadges.filter((badge) => badge.id !== payload.coachId)
          const nextAssignedCoachLabels = nextAssignedCoachBadges.map((badge) => badge.label)

          return {
            ...athlete,
            assignedCoachIds: nextAssignedCoachIds,
            assignedCoachBadges: nextAssignedCoachBadges,
            assignedCoachLabels: nextAssignedCoachLabels,
          }
        }),
      )
      applyCoachCountToAthletes(nextCoaches)
      setCoachDeleteDialog(null)
      setCoachDeleteSuccess(payload.message ?? `教練已刪除，${payload.unassignedAthleteCount} 位學員已改為未指派。`)
    } catch (requestError) {
      setCoachDeleteError(requestError instanceof Error ? requestError.message : '刪除教練失敗。')
    } finally {
      setCoachActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <CoachDashboardHeader
        roleLabel={roleLabel}
        athleteCount={athletes.length}
        userEmail={userEmail}
        coachName={coachName}
        allowPasswordManagement={allowPasswordManagement}
        createAthleteSlot={
          <CreateAthleteSection
            isHeadCoach={isHeadCoach}
            assignableCoaches={coachDirectory}
            isCreateOpen={isCreateOpen}
            setIsCreateOpen={setIsCreateOpen}
            createName={createName}
            setCreateName={setCreateName}
            createEmail={createEmail}
            setCreateEmail={setCreateEmail}
            createSport={createSport}
            setCreateSport={setCreateSport}
            selectedCreateCoachId={selectedCreateCoachId}
            setSelectedCreateCoachId={setSelectedCreateCoachId}
            handleCreateAthlete={handleCreateAthlete}
            createError={createError}
            createSuccess={createSuccess}
            isCreating={isCreating}
          />
        }
      />

      {isHeadCoach ? (
        <CoachManagementSection
          coaches={coaches}
          search={coachSearch}
          setSearch={setCoachSearch}
          isOpen={isCoachManagementOpen}
          setIsOpen={setIsCoachManagementOpen}
          currentCoachId={currentCoachId}
          onCreate={openCreateCoachDialog}
          onEdit={openEditCoachDialog}
          onDeleteRequest={handleDeleteCoach}
          deletingCoachId={coachActionLoadingId}
          feedbackMessage={coachDeleteSuccess}
          feedbackError={coachDeleteError}
        />
      ) : null}

      <ManagedAthletesSection
        athletes={athletes}
        isHeadCoach={isHeadCoach}
        currentCoachId={currentCoachId}
        search={search}
        setSearch={setSearch}
        filter={filter}
        setFilter={setFilter}
        filterOptions={filterOptions}
        openActionId={openActionId}
        setOpenActionId={setOpenActionId}
        actionLoadingId={actionLoadingId}
        resetPasswordFeedback={resetPasswordFeedback}
        resetPasswordError={resetPasswordError}
        handleAssignCoach={openAssignCoachDialog}
        handleResetPassword={handleResetPassword}
        handleDeleteAthlete={handleDeleteAthlete}
      />

      {assignmentDialog && isHeadCoach ? (
        <AssignmentDialog
          state={assignmentDialog}
          assignableCoaches={coachDirectory}
          isSaving={assignmentSaving}
          error={assignmentError}
          onClose={() => {
            if (assignmentSaving) return
            setAssignmentDialog(null)
          }}
          onSelectCoach={selectAssignmentCoach}
          onSave={() => void handleSaveAssignment()}
        />
      ) : null}

      {coachEditor && isHeadCoach ? (
        <CoachEditorDialog
          state={coachEditor}
          error={coachEditorError}
          success={coachEditorSuccess}
          isSaving={coachEditorSaving}
          onClose={() => {
            if (coachEditorSaving) return
            setCoachEditor(null)
            setCoachEditorError(null)
            setCoachEditorSuccess(null)
          }}
          onChange={updateCoachEditorField}
          onSubmit={() => void handleSaveCoach()}
        />
      ) : null}

      {coachDeleteDialog && isHeadCoach ? (
        <CoachDeleteDialog
          state={coachDeleteDialog}
          isDeleting={coachActionLoadingId === coachDeleteDialog.coach.id}
          error={coachDeleteError}
          onClose={() => {
            if (coachActionLoadingId != null) return
            setCoachDeleteDialog(null)
            setCoachDeleteError(null)
          }}
          onConfirm={() => void confirmDeleteCoach()}
        />
      ) : null}
    </div>
  )
}
