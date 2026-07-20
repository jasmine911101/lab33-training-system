'use client'

import Link from 'next/link'
import { useState } from 'react'

import type { StudentTeamProgramDetail, StudentTeamProgramSummary } from '@/lib/types/team-programs'

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? '操作失敗。')
  return payload as T
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(new Date(value))
}

function statusLabel(status: string) {
  if (status === 'completed') return '已完成'
  if (status === 'in_progress') return '進行中'
  if (status === 'skipped') return '略過'
  return '未開始'
}

export function StudentTeamProgramsPanel({ programs }: { programs: StudentTeamProgramSummary[] }) {
  return (
    <section className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="lab-eyebrow">Team Programs</p>
            <h2 className="lab-section-title mt-3">我的團隊課表</h2>
            <p className="lab-copy mt-3">這裡顯示你目前 active team membership 可存取的團隊課表。你只能看到自己的完成狀態與結果。</p>
          </div>
          <span className="lab-badge-info">{programs.length} 個團隊課表</span>
        </div>
      </article>

      <article className="lab-card p-6 sm:p-7">
        {programs.length === 0 ? <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">目前沒有可存取的團隊課表。</div> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {programs.map((program) => {
              const percent = program.progress.total > 0 ? Math.round((program.progress.completed / program.progress.total) * 100) : 0
              return (
                <Link key={program.id} href={`/student/team-programs/${program.id}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-wrap gap-2">
                    <span className="lab-badge-info">{program.teamName}</span>
                    <span className="lab-badge-primary">V{program.productVersionNumber}</span>
                    <span className="lab-badge bg-slate-100 text-slate-600">{program.status}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold text-slate-900">{program.programName}</h3>
                  <p className="lab-copy mt-2">{program.productName}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="lab-stat-card"><p className="lab-eyebrow">期間</p><p className="mt-2 text-sm font-bold">{formatDate(program.startDate)} - {formatDate(program.endDate)}</p></div>
                    <div className="lab-stat-card"><p className="lab-eyebrow">進度</p><p className="mt-2 text-sm font-bold">{program.progress.completed}/{program.progress.total} · {percent}%</p></div>
                    <div className="lab-stat-card"><p className="lab-eyebrow">下一堂</p><p className="mt-2 text-sm font-bold">{program.nextSession?.title ?? '目前沒有下一堂'}</p></div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </article>
    </section>
  )
}

export function StudentTeamProgramDetailPanel({ initialProgram }: { initialProgram: StudentTeamProgramDetail }) {
  const [program, setProgram] = useState(initialProgram)
  const [draftBySession, setDraftBySession] = useState<Record<number, { status: string; notes: string }>>(() => Object.fromEntries(initialProgram.sessions.map((session) => [session.id, { status: session.result?.status ?? 'not_started', notes: session.result?.notes ?? '' }])))
  const [pendingSessionId, setPendingSessionId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveResult(sessionId: number) {
    const draft = draftBySession[sessionId]
    setPendingSessionId(sessionId)
    setMessage(null)
    setError(null)
    try {
      const payload = await requestJson<{ program: StudentTeamProgramDetail; message?: string }>(`/api/student/team-programs/${program.id}/sessions/${sessionId}/result`, {
        method: 'PATCH',
        body: JSON.stringify({ status: draft?.status ?? 'not_started', notes: draft?.notes ?? '', resultJson: null }),
      })
      setProgram(payload.program)
      setMessage(payload.message ?? '已儲存結果。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '儲存結果失敗。')
    } finally {
      setPendingSessionId(null)
    }
  }

  return (
    <section className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="lab-eyebrow">Team Program</p>
            <h2 className="lab-section-title mt-3">{program.programName}</h2>
            <p className="lab-copy mt-3">{program.teamName} · {program.productName} V{program.productVersionNumber}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="lab-badge-info">{program.status}</span>
            <span className="lab-badge-primary">{program.progress.completed}/{program.progress.total} completed</span>
          </div>
        </div>
      </article>
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      <article className="lab-card p-6 sm:p-7">
        <div className="space-y-4">
          {program.sessions.map((session) => {
            const draft = draftBySession[session.id] ?? { status: session.result?.status ?? 'not_started', notes: session.result?.notes ?? '' }
            return (
              <div key={session.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="lab-badge-primary">Week {session.week_number ?? '-'}</span>
                      <span className="lab-badge bg-slate-100 text-slate-600">Day {session.day_number ?? '-'}</span>
                      <span className="lab-badge bg-slate-100 text-slate-600">{formatDate(session.scheduled_date)}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-slate-900">{session.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{session.block_code ?? '無代號'} | {session.block_name ?? '未命名板塊'}</p>
                  </div>
                  <span className="lab-badge-info">{statusLabel(session.result?.status ?? 'not_started')}</span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[12rem_1fr_auto] lg:items-end">
                  <label className="space-y-2 text-sm font-semibold text-slate-700">完成狀態
                    <select className="lab-input" value={draft.status} onChange={(event) => setDraftBySession((current) => ({ ...current, [session.id]: { ...draft, status: event.target.value } }))}>
                      <option value="not_started">未開始</option>
                      <option value="in_progress">進行中</option>
                      <option value="completed">已完成</option>
                      <option value="skipped">略過</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-slate-700">備註
                    <input className="lab-input" value={draft.notes} onChange={(event) => setDraftBySession((current) => ({ ...current, [session.id]: { ...draft, notes: event.target.value } }))} />
                  </label>
                  <button type="button" className="lab-btn-primary" onClick={() => void saveResult(session.id)} disabled={pendingSessionId === session.id}>{pendingSessionId === session.id ? '儲存中...' : '儲存結果'}</button>
                </div>
              </div>
            )
          })}
        </div>
      </article>
    </section>
  )
}