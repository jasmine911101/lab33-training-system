'use client'

import { useState } from 'react'

import type { TeamEnrollmentRecord, TeamProgramsSnapshot } from '@/lib/types/team-programs'

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

function statusClass(status: string) {
  if (status === 'active') return 'lab-badge-success'
  if (status === 'cancelled') return 'lab-badge bg-rose-100 text-rose-700'
  if (status === 'ended') return 'lab-badge bg-slate-100 text-slate-600'
  return 'lab-badge-warning'
}

export function TeamProgramsPanel({ enrollments: initialEnrollments }: TeamProgramsSnapshot) {
  const [enrollments, setEnrollments] = useState(initialEnrollments)
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<number | null>(initialEnrollments[0]?.id ?? null)
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function replaceEnrollment(nextEnrollment: TeamEnrollmentRecord) {
    setEnrollments((current) => current.map((entry) => entry.id === nextEnrollment.id ? nextEnrollment : entry))
  }

  async function transition(enrollment: TeamEnrollmentRecord, action: 'end' | 'cancel') {
    const label = action === 'end' ? '結束' : '取消'
    if (!window.confirm(`${label}這個團隊課表？歷史 enrollment、sessions 與 results 都會保留。`)) return
    setPending(`${action}:${enrollment.id}`)
    setMessage(null)
    setError(null)
    try {
      const payload = await requestJson<{ enrollment: TeamEnrollmentRecord; message?: string }>(`/api/coach/team-product-enrollments/${enrollment.id}/${action}`, { method: 'POST', body: JSON.stringify({}) })
      replaceEnrollment(payload.enrollment)
      setMessage(payload.message ?? '已更新團隊課表。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新團隊課表失敗。')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="lab-eyebrow">Team Program Delivery</p>
            <h2 className="lab-section-title mt-3">團隊課表管理</h2>
            <p className="lab-copy mt-3">這裡顯示 Product Version 指派給 Team 後建立的 Enrollment、Program Instance 與 Sessions。End / Cancel 都不刪除歷史結果。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="lab-badge-primary">{enrollments.length} enrollments</span>
            <span className="lab-badge-success">{enrollments.filter((entry) => entry.status === 'active').length} active</span>
          </div>
        </div>
      </article>

      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <article className="lab-card p-6 sm:p-7">
        {enrollments.length === 0 ? <div className="lab-card-muted px-5 py-6 text-sm text-slate-600">目前沒有團隊課表。請先到商品管理，將 Published Product Version 指派給 Team。</div> : (
          <div className="space-y-4">
            {enrollments.map((enrollment) => {
              const expanded = expandedEnrollmentId === enrollment.id
              return (
                <div key={enrollment.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <button type="button" className="flex w-full flex-col gap-3 text-left lg:flex-row lg:items-start lg:justify-between" onClick={() => setExpandedEnrollmentId(expanded ? null : enrollment.id)} aria-expanded={expanded}>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className={statusClass(enrollment.status)}>{enrollment.status}</span>
                        <span className="lab-badge-primary">V{enrollment.product_version_number}</span>
                        <span className="lab-badge bg-slate-100 text-slate-600">{enrollment.sessionsCount} sessions</span>
                      </div>
                      <h3 className="mt-3 text-2xl font-bold text-slate-900">{enrollment.product_name}</h3>
                      <p className="lab-copy mt-2">{enrollment.team_name} · {formatDate(enrollment.start_date)} - {formatDate(enrollment.end_date)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="lab-badge bg-slate-100 text-slate-600">Roster {enrollment.activeRosterCount}</span>
                      <span className="lab-badge bg-slate-100 text-slate-600">Seat {enrollment.seat_limit ?? '不限'}</span>
                      <span className="lab-btn-secondary !min-h-9 px-3 py-1 text-sm">{expanded ? '收起' : '查看'}</span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="mt-5 border-t border-slate-200 pt-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="lab-stat-card"><p className="lab-eyebrow">Team</p><p className="mt-2 font-bold">{enrollment.team_name}</p></div>
                        <div className="lab-stat-card"><p className="lab-eyebrow">Product Version</p><p className="mt-2 font-bold">V{enrollment.product_version_number}</p></div>
                        <div className="lab-stat-card"><p className="lab-eyebrow">Roster / Seat</p><p className="mt-2 font-bold">{enrollment.activeRosterCount} / {enrollment.seat_limit ?? '不限'}</p></div>
                        <div className="lab-stat-card"><p className="lab-eyebrow">Assigned By</p><p className="mt-2 font-bold">{enrollment.assigned_by_name ?? '-'}</p></div>
                      </div>
                      <div className="mt-5 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs uppercase tracking-[0.16em] text-slate-400"><tr><th className="py-2 pr-4">Session</th><th className="py-2 pr-4">Week</th><th className="py-2 pr-4">Day</th><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Block</th></tr></thead>
                          <tbody className="divide-y divide-slate-100">
                            {(enrollment.program?.sessions ?? []).map((session) => (
                              <tr key={session.id}>
                                <td className="py-3 pr-4 font-semibold text-slate-900">{session.title}</td>
                                <td className="py-3 pr-4">{session.week_number ? `Week ${session.week_number}` : '-'}</td>
                                <td className="py-3 pr-4">{session.day_number ?? '-'}</td>
                                <td className="py-3 pr-4">{formatDate(session.scheduled_date)}</td>
                                <td className="py-3 pr-4 text-slate-500">{session.block_code ?? '無代號'} | {session.block_name ?? '未命名板塊'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {enrollment.status === 'active' ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button type="button" className="lab-btn-secondary" onClick={() => void transition(enrollment, 'end')} disabled={pending === `end:${enrollment.id}`}>End</button>
                          <button type="button" className="lab-btn-secondary !text-rose-600" onClick={() => void transition(enrollment, 'cancel')} disabled={pending === `cancel:${enrollment.id}`}>Cancel</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </article>
    </section>
  )
}