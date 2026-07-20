'use client'

import { useMemo, useState } from 'react'

import type { TeamCoachRole, TeamManagementSnapshot, TeamRecord } from '@/lib/types/team-programs'

type Props = TeamManagementSnapshot

type TeamDraft = { name: string; description: string; sportType: string }
type CoachDraft = { coachId: string; role: TeamCoachRole; canManageRoster: boolean; canManagePrograms: boolean; canViewResults: boolean }

const ROLE_OPTIONS: Array<{ value: TeamCoachRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'coach', label: 'Coach' },
  { value: 'viewer', label: 'Viewer' },
]

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

function memberStatusClass(status: string) {
  if (status === 'active') return 'lab-badge-success'
  if (status === 'removed') return 'lab-badge bg-rose-100 text-rose-700'
  return 'lab-badge bg-slate-100 text-slate-600'
}

function roleDefaults(role: TeamCoachRole) {
  if (role === 'owner' || role === 'manager') return { canManageRoster: true, canManagePrograms: true, canViewResults: true }
  if (role === 'coach') return { canManageRoster: false, canManagePrograms: false, canViewResults: true }
  return { canManageRoster: false, canManagePrograms: false, canViewResults: true }
}

function newCoachDraft(): CoachDraft {
  return { coachId: '', role: 'coach', ...roleDefaults('coach') }
}

function roleClass(role: string) {
  if (role === 'owner') return 'lab-badge-primary'
  if (role === 'manager') return 'lab-badge-success'
  if (role === 'viewer') return 'lab-badge bg-slate-100 text-slate-600'
  return 'lab-badge-warning'
}

export function TeamManagementPanel({ teams: initialTeams, athleteOptions, coachOptions }: Props) {
  const [teams, setTeams] = useState(initialTeams)
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState<TeamDraft>({ name: '', description: '', sportType: '' })
  const [selectedAthletes, setSelectedAthletes] = useState<Record<number, string>>({})
  const [coachDrafts, setCoachDrafts] = useState<Record<number, CoachDraft>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stats = useMemo(() => ({ total: teams.length, members: teams.reduce((sum, team) => sum + team.activeRosterCount, 0) }), [teams])

  function upsertTeam(nextTeam: TeamRecord) {
    setTeams((current) => current.some((team) => team.id === nextTeam.id) ? current.map((team) => team.id === nextTeam.id ? nextTeam : team) : [nextTeam, ...current])
  }

  function updateCoachDraft(teamId: number, patch: Partial<CoachDraft>) {
    setCoachDrafts((current) => {
      const next = { ...(current[teamId] ?? newCoachDraft()), ...patch }
      if (patch.role) Object.assign(next, roleDefaults(patch.role))
      return { ...current, [teamId]: next }
    })
  }

  async function createTeam() {
    setPending('create')
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ team: TeamRecord; message?: string }>('/api/coach/teams', { method: 'POST', body: JSON.stringify(draft) })
      upsertTeam(payload.team)
      setDraft({ name: '', description: '', sportType: '' })
      setCreateOpen(false)
      setMessage(payload.message ?? '已建立球隊。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '建立球隊失敗。')
    } finally {
      setPending(null)
    }
  }

  async function addMember(teamId: number) {
    const athleteId = Number(selectedAthletes[teamId])
    if (!Number.isFinite(athleteId)) return
    setPending(`add:${teamId}`)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ team: TeamRecord; message?: string }>(`/api/coach/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ athleteId }) })
      upsertTeam(payload.team)
      setSelectedAthletes((current) => ({ ...current, [teamId]: '' }))
      setMessage(payload.message ?? '已加入球員。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加入球員失敗。')
    } finally {
      setPending(null)
    }
  }

  async function updateMember(teamId: number, membershipId: number, status: 'active' | 'inactive' | 'removed') {
    setPending(`member:${membershipId}`)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ team: TeamRecord; message?: string }>(`/api/coach/teams/${teamId}/members/${membershipId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      upsertTeam(payload.team)
      setMessage(payload.message ?? '已更新球員狀態。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新球員狀態失敗。')
    } finally {
      setPending(null)
    }
  }

  async function addTeamCoach(teamId: number) {
    const draftForTeam = coachDrafts[teamId] ?? newCoachDraft()
    const coachId = Number(draftForTeam.coachId)
    if (!Number.isFinite(coachId)) return
    setPending(`coach:add:${teamId}`)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ team: TeamRecord; message?: string }>(`/api/coach/teams/${teamId}/coaches`, { method: 'POST', body: JSON.stringify({
        coachId,
        role: draftForTeam.role,
        canManageRoster: draftForTeam.canManageRoster,
        canManagePrograms: draftForTeam.canManagePrograms,
        canViewResults: draftForTeam.canViewResults,
      }) })
      upsertTeam(payload.team)
      setCoachDrafts((current) => ({ ...current, [teamId]: newCoachDraft() }))
      setMessage(payload.message ?? '已新增 Team 教練。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '新增 Team 教練失敗。')
    } finally {
      setPending(null)
    }
  }

  async function updateTeamCoach(teamId: number, teamCoachId: number, patch: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setPending(`coach:${teamCoachId}`)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ team: TeamRecord; message?: string }>(`/api/coach/teams/${teamId}/coaches/${teamCoachId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      upsertTeam(payload.team)
      setMessage(payload.message ?? '已更新 Team 教練。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新 Team 教練失敗。')
    } finally {
      setPending(null)
    }
  }

  async function removeTeamCoach(teamId: number, teamCoachId: number) {
    if (!window.confirm('移除此 Team 教練？這只會移除 Team 管理權，不會刪除教練帳號。')) return
    setPending(`coach:${teamCoachId}`)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ team: TeamRecord; message?: string }>(`/api/coach/teams/${teamId}/coaches/${teamCoachId}/remove`, { method: 'POST', body: JSON.stringify({}) })
      upsertTeam(payload.team)
      setMessage(payload.message ?? '已移除 Team 教練。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '移除 Team 教練失敗。')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="lab-eyebrow">Teams</p>
            <h2 className="lab-section-title mt-3">球隊管理</h2>
            <p className="lab-copy mt-3">Team roster 採 dynamic roster。加入 active member 後會自動取得有效 Team Program 的存取權，不複製整套課表。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="lab-badge-primary">{stats.total} 支球隊</span>
            <span className="lab-badge-success">{stats.members} active members</span>
          </div>
        </div>
      </article>

      <article className="lab-card p-6 sm:p-7">
        <button type="button" className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setCreateOpen((current) => !current)} aria-expanded={createOpen}>
          <div>
            <p className="lab-eyebrow">New Team</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">建立 Team</h3>
          </div>
          <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{createOpen ? '收起' : '展開'}</span>
        </button>
        {createOpen ? (
          <div className="mt-6 grid gap-4 border-t border-slate-200 pt-6 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <label className="space-y-2 text-sm font-semibold text-slate-700">名稱<input className="lab-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">運動項目<input className="lab-input" value={draft.sportType} onChange={(event) => setDraft({ ...draft, sportType: event.target.value })} /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">描述<input className="lab-input" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <button type="button" className="lab-btn-primary" onClick={() => void createTeam()} disabled={pending === 'create'}>{pending === 'create' ? '建立中...' : '建立 Team'}</button>
          </div>
        ) : null}
      </article>

      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <article className="lab-card p-6 sm:p-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="lab-eyebrow">Team List</p>
            <h3 className="lab-section-title mt-3">球隊列表</h3>
          </div>
          <span className="lab-badge-primary">{teams.length} teams</span>
        </div>
        {teams.length === 0 ? <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">目前沒有可管理的 Team。</div> : (
          <div className="mt-6 space-y-4">
            {teams.map((team) => {
              const activeAthleteIds = new Set(team.memberships.filter((member) => member.status === 'active').map((member) => member.athlete_id))
              const activeCoachIds = new Set(team.coaches.filter((teamCoach) => teamCoach.status === 'active').map((teamCoach) => teamCoach.coach_id))
              const availableAthletes = athleteOptions.filter((athlete) => !activeAthleteIds.has(athlete.id))
              const availableCoaches = coachOptions.filter((coachOption) => !activeCoachIds.has(coachOption.id))
              const coachDraft = coachDrafts[team.id] ?? newCoachDraft()
              const activeOwners = team.coaches.filter((teamCoach) => teamCoach.status === 'active' && teamCoach.role === 'owner').length
              return (
                <div key={team.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="lab-badge-primary">{team.activeRosterCount} active</span>
                        {team.activeSeatLimit ? <span className="lab-badge-warning">Seat limit {team.activeSeatLimit}</span> : null}
                        <span className="lab-badge bg-slate-100 text-slate-600">建立者：{team.created_by_name ?? team.created_by_email ?? '-'}</span>
                      </div>
                      <h4 className="mt-3 text-2xl font-bold text-slate-900">{team.name}</h4>
                      <p className="lab-copy mt-2">{team.description || '尚未填寫描述。'}</p>
                      <p className="mt-2 text-sm text-slate-500">{team.sport_type || '未設定運動項目'} · 更新 {formatDate(team.updated_at)}</p>
                    </div>
                    <div className="flex min-w-0 gap-2 lg:min-w-[360px]">
                      <select className="lab-input" value={selectedAthletes[team.id] ?? ''} onChange={(event) => setSelectedAthletes((current) => ({ ...current, [team.id]: event.target.value }))}>
                        <option value="">選擇學員加入 Team</option>
                        {availableAthletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.name ?? athlete.email ?? `Athlete ${athlete.id}`}</option>)}
                      </select>
                      <button type="button" className="lab-btn-secondary whitespace-nowrap" onClick={() => void addMember(team.id)} disabled={!selectedAthletes[team.id] || pending === `add:${team.id}`}>加入</button>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.25rem] border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <p className="lab-eyebrow">Team Coaches</p>
                        <h5 className="mt-2 text-lg font-bold text-slate-900">教練管理</h5>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_140px_auto] lg:min-w-[520px]">
                        <select className="lab-input" value={coachDraft.coachId} onChange={(event) => updateCoachDraft(team.id, { coachId: event.target.value })}>
                          <option value="">選擇教練</option>
                          {availableCoaches.map((coachOption) => <option key={coachOption.id} value={coachOption.id}>{coachOption.name ?? coachOption.email ?? `Coach ${coachOption.id}`}{coachOption.is_head_coach ? '（總教練）' : ''}</option>)}
                        </select>
                        <select className="lab-input" value={coachDraft.role} onChange={(event) => updateCoachDraft(team.id, { role: event.target.value as TeamCoachRole })}>
                          {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </select>
                        <button type="button" className="lab-btn-secondary whitespace-nowrap" onClick={() => void addTeamCoach(team.id)} disabled={!coachDraft.coachId || pending === `coach:add:${team.id}`}>新增教練</button>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-[0.16em] text-slate-400"><tr><th className="py-2 pr-4">教練</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Roster</th><th className="py-2 pr-4">Program</th><th className="py-2 pr-4">Results</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">操作</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {team.coaches.length === 0 ? <tr><td colSpan={7} className="py-4 text-slate-500">尚無 Team Coach。請先套用 2.1 migration backfill owner。</td></tr> : team.coaches.map((teamCoach) => (
                            <tr key={teamCoach.id}>
                              <td className="py-3 pr-4 font-semibold text-slate-900">{teamCoach.coach_name ?? teamCoach.coach_email ?? `Coach ${teamCoach.coach_id}`}</td>
                              <td className="py-3 pr-4"><span className={roleClass(teamCoach.role)}>{teamCoach.role}</span></td>
                              <td className="py-3 pr-4">{teamCoach.can_manage_roster ? '可管理' : '-'}</td>
                              <td className="py-3 pr-4">{teamCoach.can_manage_programs ? '可管理' : '-'}</td>
                              <td className="py-3 pr-4">{teamCoach.can_view_results ? '可查看' : '-'}</td>
                              <td className="py-3 pr-4"><span className={memberStatusClass(teamCoach.status)}>{teamCoach.status}</span></td>
                              <td className="py-3 pr-4">
                                <div className="flex flex-wrap gap-2">
                                  {teamCoach.status !== 'active' ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => void updateTeamCoach(team.id, teamCoach.id, { status: 'active', role: teamCoach.role, canManageRoster: teamCoach.can_manage_roster, canManagePrograms: teamCoach.can_manage_programs, canViewResults: teamCoach.can_view_results })} disabled={pending === `coach:${teamCoach.id}`}>啟用</button> : null}
                                  {teamCoach.role !== 'owner' ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => void updateTeamCoach(team.id, teamCoach.id, { role: 'owner' }, '設為 Owner？Owner 可以管理 Team 教練。')} disabled={pending === `coach:${teamCoach.id}`}>設為 Owner</button> : null}
                                  {teamCoach.role === 'owner' && activeOwners > 1 ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => void updateTeamCoach(team.id, teamCoach.id, { role: 'manager' }, '降為 Manager？')} disabled={pending === `coach:${teamCoach.id}`}>降為 Manager</button> : null}
                                  {teamCoach.status !== 'removed' ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs !text-rose-600" onClick={() => void removeTeamCoach(team.id, teamCoach.id)} disabled={pending === `coach:${teamCoach.id}` || (teamCoach.role === 'owner' && activeOwners <= 1)}>移除</button> : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.16em] text-slate-400"><tr><th className="py-2 pr-4">學員</th><th className="py-2 pr-4">狀態</th><th className="py-2 pr-4">加入時間</th><th className="py-2 pr-4">操作</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {team.memberships.length === 0 ? <tr><td colSpan={4} className="py-4 text-slate-500">尚無 team members。</td></tr> : team.memberships.map((member) => (
                          <tr key={member.id}>
                            <td className="py-3 pr-4 font-semibold text-slate-900">{member.athlete_name ?? member.athlete_email ?? `Athlete ${member.athlete_id}`}</td>
                            <td className="py-3 pr-4"><span className={memberStatusClass(member.status)}>{member.status}</span></td>
                            <td className="py-3 pr-4 text-slate-500">{formatDate(member.joined_at)}</td>
                            <td className="py-3 pr-4">
                              <div className="flex flex-wrap gap-2">
                                {member.status !== 'active' ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => void updateMember(team.id, member.id, 'active')}>啟用</button> : null}
                                {member.status === 'active' ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => void updateMember(team.id, member.id, 'inactive')}>停用</button> : null}
                                {member.status !== 'removed' ? <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs !text-rose-600" onClick={() => { if (window.confirm('移除此球員？歷史團隊訓練結果會保留。')) void updateMember(team.id, member.id, 'removed') }}>移除</button> : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </article>
    </section>
  )
}
