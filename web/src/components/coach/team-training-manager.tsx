'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CoachDashboardHeader } from '@/components/coach/coach-dashboard-header'
import { TemporaryCredentialDialog, type TemporaryCredentialDialogState } from '@/components/coach/coach-athlete-manager'
import { DangerConfirmDialog } from '@/components/common/danger-confirm-dialog'
import type { BlockRecord } from '@/services/team-training'

type Athlete = { id: number; name: string | null; email: string | null }
type Team = { id: number; name: string; description: string; members: Athlete[]; batchAccounts: Athlete[] }
type Props = {
  initialData: { teams: Team[]; athletes: Athlete[]; blocks: BlockRecord[] }
  roleLabel: string
  userEmail?: string | null
  coachName?: string | null
}
type TeamAccount = { athleteId: number; name: string; email: string; temporaryPassword: string }

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '儲存失敗，請稍後再試。')
  return data as { message?: string }
}

async function remove(url: string, body: unknown) {
  const response = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '移除成員失敗，請稍後再試。')
  return data as { message?: string }
}

export function TeamTrainingManager({ initialData, roleLabel, userEmail, coachName }: Props) {
  const router = useRouter()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<Record<number, number[]>>({})
  const [accountCounts, setAccountCounts] = useState<Record<number, string>>({})
  const [accountPrefixes, setAccountPrefixes] = useState<Record<number, string>>({})
  const [credentials, setCredentials] = useState<Record<number, TeamAccount[]>>({})
  const [showMembers, setShowMembers] = useState<Record<number, boolean>>({})
  const [deletedMemberIds, setDeletedMemberIds] = useState<number[]>([])
  const [memberSearches, setMemberSearches] = useState<Record<number, string>>({})
  const [showMemberAdder, setShowMemberAdder] = useState<Record<number, boolean>>({})
  const [showAccountCreator, setShowAccountCreator] = useState<Record<number, boolean>>({})
  const [teamSearch, setTeamSearch] = useState('')
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [resetCredential, setResetCredential] = useState<TemporaryCredentialDialogState | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)
  const [selectedBatchAccountIds, setSelectedBatchAccountIds] = useState<number[]>([])
  const matchingTeams = initialData.teams.filter((team) => {
    const query = teamSearch.trim().toLowerCase()
    return !query || `${team.name} ${team.description || ''}`.toLowerCase().includes(query)
  })

  async function submit(action: () => Promise<{ message?: string }>) {
    setSaving(true); setError(''); setNotice('')
    try { const result = await action(); setNotice(result.message || '已儲存。'); router.refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : '儲存失敗。') } finally { setSaving(false) }
  }
  function toggle(teamId: number, athleteId: number, checked: boolean) { setSelected((current) => ({ ...current, [teamId]: checked ? [...new Set([...(current[teamId] || []), athleteId])] : (current[teamId] || []).filter((id) => id !== athleteId) })) }
  async function createAccounts(teamId: number) {
    const count = Number(accountCounts[teamId] || 0)
    const accountPrefix = accountPrefixes[teamId] || ''
    await submit(async () => {
      const result = await post(`/api/coach/teams/${teamId}/member-accounts`, { count, accountPrefix }) as { message?: string; accounts?: TeamAccount[] }
      setCredentials((current) => ({ ...current, [teamId]: result.accounts || [] }))
      return result
    })
  }

  async function deleteMemberAccount(teamId: number, athlete: Athlete) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await post(`/api/coach/teams/${teamId}/members/${athlete.id}/account`, {})
      setDeletedMemberIds((current) => [...new Set([...current, athlete.id])])
      setNotice(result.message || '已永久刪除帳號。')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '刪除帳號失敗。')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteTeam(confirmationName: string) {
    if (!deletingTeam) return
    const team = deletingTeam
    await submit(async () => {
      const result = await remove(`/api/coach/teams/${team.id}`, { confirmationName, selectedBatchAccountIds })
      setDeletingTeam(null)
      setSelectedBatchAccountIds([])
      return result
    })
  }

  async function resetMemberPassword(athlete: Athlete) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await post(`/api/coach/athletes/${athlete.id}/reset-password`, {}) as { message?: string; tempPassword?: string; athlete?: Athlete }
      if (!result.tempPassword) throw new Error('系統未能產生暫時密碼，請稍後再試。')
      setResetCredential({
        title: '已重設學員暫時密碼',
        email: result.athlete?.email || athlete.email || '-',
        temporaryPassword: result.tempPassword,
        message: result.message || '已重設暫時密碼。',
        reminder: '請安全地將帳密提供給該學員。新暫時密碼登入後，學員可以立即修改密碼。',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重設密碼失敗。')
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-6" aria-live="polite">
    <CoachDashboardHeader roleLabel={roleLabel} athleteCount={initialData.athletes.length} userEmail={userEmail} coachName={coachName} />
    <article className="lab-card overflow-hidden p-7 sm:p-8">
      <div className="lab-section-heading lab-section-heading-flush flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="lab-eyebrow">Managed Teams</p><h2 className="lab-section-title mt-3">團隊列表</h2></div>
        <div className="flex flex-wrap items-center gap-3"><span className="lab-badge-primary">{initialData.teams.length} 個團隊</span><button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm font-bold" onClick={() => setShowCreateTeam((current) => !current)}>{showCreateTeam ? '收起建立團隊' : '＋ 建立團隊'}</button></div>
      </div>
    {showCreateTeam ? <section className="mt-6 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5"><h3 className="font-bold text-slate-900">建立團隊</h3><p className="lab-copy mt-1">每個團隊只需維護一份共享課表；運動員仍各自記錄重量。</p>
      <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void submit(async () => { const result = await post('/api/coach/teams', { name: teamName, description }); setTeamName(''); setDescription(''); setShowCreateTeam(false); return result }) }}>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">團隊名稱<input required name="teamName" autoComplete="off" value={teamName} onChange={(event) => setTeamName(event.target.value)} className="lab-input" placeholder="例如：U18 棒球隊…" /></label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">說明（選填）<input name="description" autoComplete="off" value={description} onChange={(event) => setDescription(event.target.value)} className="lab-input" placeholder="例如：2026 秋季賽…" /></label>
        <button className="lab-btn-primary self-end" disabled={saving}>{saving ? '建立中…' : '建立團隊'}</button>
      </form>
    </section> : null}
    {notice ? <p className="lab-badge-success">{notice}</p> : null}{error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
    {initialData.teams.length ? <section className="mt-6 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><label htmlFor="team-search" className="text-sm font-semibold text-slate-700">搜尋團隊</label><input id="team-search" name="team-search" type="search" autoComplete="off" className="lab-input mt-2 !min-h-10" placeholder="搜尋團隊名稱或說明…" value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} /></div><span className="mt-7 text-sm text-slate-500">找到 {matchingTeams.length} 個團隊</span></section> : null}
    {initialData.teams.length === 0 ? <section className="mt-6 rounded-[1.25rem] bg-slate-50 p-8 text-center text-slate-600">尚未建立團隊。請使用上方按鈕建立第一個團隊。</section> : matchingTeams.length === 0 ? <section className="mt-6 rounded-[1.25rem] bg-slate-50 p-8 text-center text-slate-600">找不到符合的團隊。</section> : <div className="mt-6 space-y-5">{matchingTeams.map((team) => {
      const visibleMembers = team.members.filter((member) => !deletedMemberIds.includes(member.id))
      const memberIds = new Set(visibleMembers.map((member) => member.id))
      const availableAthletes = initialData.athletes.filter((athlete) => !memberIds.has(athlete.id))
      const membersOpen = Boolean(showMembers[team.id])
      const memberSearch = (memberSearches[team.id] || '').trim().toLowerCase()
      const matchingAthletes = availableAthletes.filter((athlete) => !memberSearch || [athlete.name, athlete.email].some((value) => value?.toLowerCase().includes(memberSearch)))
      const memberAdderOpen = Boolean(showMemberAdder[team.id])
      const accountCreatorOpen = Boolean(showAccountCreator[team.id])
      return <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 sm:p-6" key={team.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-900">{team.name}</h2><p className="lab-copy mt-1">{team.description || '尚未填寫團隊說明'}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setShowMembers((current) => ({ ...current, [team.id]: !membersOpen }))}>
              {membersOpen ? '收起目前成員' : `查看目前成員（${visibleMembers.length}）`}
            </button>
            <button type="button" className="lab-btn-secondary !min-h-10 border-rose-200 px-4 py-2 text-sm text-rose-700 hover:border-rose-300 hover:bg-rose-50" disabled={saving} onClick={() => { setError(''); setNotice(''); setSelectedBatchAccountIds([]); setDeletingTeam(team) }}>
              刪除團隊
            </button>
          </div>
        </div>

        {membersOpen ? <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">目前成員</h3><p className="mt-1 text-sm text-slate-600">移出只會解除團隊身分；刪除帳號會永久移除登入資料與所有訓練紀錄。</p></div><span className="lab-badge-primary">{visibleMembers.length} 位成員</span></div>
          {visibleMembers.length ? <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">{visibleMembers.map((member) => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="font-semibold text-slate-900">{member.name || member.email || `運動員 #${member.id}`}</p>{member.email ? <p className="mt-1 text-xs text-slate-500">{member.email}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-sm" disabled={saving} onClick={() => void resetMemberPassword(member)}>重設密碼</button><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-sm !text-rose-700" disabled={saving} onClick={() => void submit(() => remove(`/api/coach/teams/${team.id}/members`, { athleteId: member.id }))}>移出團隊</button><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-sm !border-rose-300 !bg-rose-50 !text-rose-700" disabled={saving} onClick={() => { if (window.confirm(`確定永久刪除 ${member.name || member.email || '這位隊員'} 的登入帳號與所有資料嗎？此操作無法復原。`)) void deleteMemberAccount(team.id, member) }}>刪除帳號</button></div></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">目前尚無成員。</p>}
        </section> : null}

      <div className="mt-5 grid gap-6 xl:grid-cols-2"><div className="space-y-4"><section className="rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">新增既有成員</h3><p className="mt-1 text-sm text-slate-600">搜尋既有學員後加入團隊。</p></div><button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setShowMemberAdder((current) => ({ ...current, [team.id]: !memberAdderOpen }))}>{memberAdderOpen ? '收起' : '新增成員'}</button></div>{memberAdderOpen ? <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void submit(() => post(`/api/coach/teams/${team.id}/members`, { athleteIds: selected[team.id] || [] })) }}><label className="sr-only" htmlFor={`member-search-${team.id}`}>搜尋成員</label><input id={`member-search-${team.id}`} type="search" className="lab-input !min-h-10" placeholder="搜尋姓名或 Email…" value={memberSearches[team.id] || ''} onChange={(event) => setMemberSearches((current) => ({ ...current, [team.id]: event.target.value }))} /><p className="mt-2 text-xs text-slate-500">找到 {matchingAthletes.length} 位可加入成員</p><div className="mt-2 max-h-28 space-y-2 overflow-y-auto pr-1">{matchingAthletes.length ? matchingAthletes.map((athlete) => <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700" key={athlete.id}><input type="checkbox" checked={(selected[team.id] || []).includes(athlete.id)} onChange={(event) => toggle(team.id, athlete.id, event.target.checked)} />{athlete.name || athlete.email || `運動員 #${athlete.id}`}</label>) : <p className="text-sm text-slate-500">{availableAthletes.length ? '找不到符合的成員。' : '所有可管理的運動員都已在團隊中。'}</p>}</div><button className="lab-btn-secondary mt-4" disabled={saving || !(selected[team.id] || []).length}>{saving ? '處理中…' : '加入所選成員'}</button></form> : null}</section>
        <section className="rounded-2xl border border-sky-100 bg-sky-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">批次建立隊員帳號</h3><p className="mt-1 text-sm leading-6 text-slate-600">大量建立新隊員時使用。</p></div><button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => setShowAccountCreator((current) => ({ ...current, [team.id]: !accountCreatorOpen }))}>{accountCreatorOpen ? '收起' : '批次建立'}</button></div>{accountCreatorOpen ? <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void createAccounts(team.id) }}><p className="text-sm leading-6 text-slate-600">建立後自動加入此團隊；隊員首次登入必須更新密碼。</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-slate-700">帳號前綴<input required name={`account-prefix-${team.id}`} autoComplete="off" spellCheck={false} value={accountPrefixes[team.id] || ''} onChange={(event) => setAccountPrefixes((current) => ({ ...current, [team.id]: event.target.value }))} className="lab-input" placeholder="例如：u18-2026…" /></label><label className="grid gap-1 text-sm font-semibold text-slate-700">建立人數<input required type="number" min="1" max="100" name={`account-count-${team.id}`} inputMode="numeric" value={accountCounts[team.id] || ''} onChange={(event) => setAccountCounts((current) => ({ ...current, [team.id]: event.target.value }))} className="lab-input" placeholder="例如：30…" /></label></div><button className="lab-btn-primary mt-4" disabled={saving}>{saving ? '建立中…' : '建立並加入團隊'}</button></form> : null}</section>
        {credentials[team.id]?.length ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">本次建立的登入帳密</h3><p className="mt-1 text-sm text-amber-900">請立即複製保存；重新整理頁面後不再顯示暫時密碼。</p></div><button type="button" className="lab-btn-secondary !min-h-10 px-3 py-2 text-sm" onClick={() => void navigator.clipboard?.writeText(credentials[team.id].map((account) => `${account.name}\t${account.email}\t${account.temporaryPassword}`).join('\n'))}>複製帳密</button></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm"><thead><tr className="text-slate-500"><th className="pb-2">姓名</th><th className="pb-2">登入帳號</th><th className="pb-2">暫時密碼</th></tr></thead><tbody>{credentials[team.id].map((account) => <tr key={account.athleteId} className="border-t border-amber-200 text-slate-800"><td className="py-2">{account.name}</td><td className="py-2 font-mono">{account.email}</td><td className="py-2 font-mono">{account.temporaryPassword}</td></tr>)}</tbody></table></div></section> : null}</div>
        <div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-bold text-slate-900">安排團隊課表</h3><p className="mt-2 text-sm text-slate-600">進入專屬行事曆，在日期上安排全隊共用的訓練內容。</p><Link className="lab-btn-primary mt-5 !text-white" href={`/coach/teams/${team.id}/calendar`}>開啟團隊行事曆</Link>{team.members.length === 0 ? <p className="mt-2 text-xs text-amber-700">可先安排課表；加入成員後，他們會看到仍在日期範圍內的課表。</p> : null}</div></div>
    </section>
    })}</div>}
    </article>
    {deletingTeam ? <DangerConfirmDialog
      title={`刪除團隊「${deletingTeam.name}」？`}
      description={selectedBatchAccountIds.length
        ? '這會永久刪除團隊的共享課表、行事曆事件、週期標記、隊員關聯與訓練回報；你選取的團隊批次帳號、個人資料與個人訓練紀錄也會一併刪除。手動加入的既有學員帳號與板塊模板會保留。'
        : '這會永久刪除團隊的共享課表、行事曆事件、週期標記、隊員關聯與訓練回報。運動員帳號、個人課表及板塊模板不會被刪除。'}
      impacts={[
        { label: '團隊', value: deletingTeam.name },
        { label: '目前成員', value: selectedBatchAccountIds.length ? `${selectedBatchAccountIds.length} 個選取帳號會刪除，其餘保留` : `${deletingTeam.members.length} 位（帳號保留）` },
        { label: '共享課表與團隊行事曆', value: '永久刪除' },
      ]}
      expectedText={deletingTeam.name}
      expectedTextLabel="請輸入團隊名稱以確認"
      confirmLabel="永久刪除團隊"
      pending={saving}
      error={error || null}
      onCancel={() => { if (!saving) { setDeletingTeam(null); setSelectedBatchAccountIds([]); setError('') } }}
      onConfirm={(confirmationName) => void confirmDeleteTeam(confirmationName)}
    >
      {deletingTeam.batchAccounts.length ? <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">選擇要一併刪除的批次帳號</p><p className="mt-1 leading-6">勾選後會永久刪除帳號、個人資料與訓練紀錄；未勾選帳號會保留。</p></div><div className="flex gap-2"><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" disabled={saving} onClick={() => setSelectedBatchAccountIds(deletingTeam.batchAccounts.map((account) => account.id))}>全選</button><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" disabled={saving} onClick={() => setSelectedBatchAccountIds([])}>全不選</button></div></div>
        <ul className="mt-3 max-h-[min(18rem,35dvh)] space-y-2 overflow-y-auto overscroll-contain pr-1 touch-pan-y">{deletingTeam.batchAccounts.map((account) => <li key={account.id}><label className="flex cursor-pointer items-start gap-3 rounded-lg border border-rose-100 bg-white px-3 py-2"><input type="checkbox" name={`delete-team-account-${account.id}`} checked={selectedBatchAccountIds.includes(account.id)} onChange={(event) => setSelectedBatchAccountIds((current) => event.target.checked ? [...new Set([...current, account.id])] : current.filter((id) => id !== account.id))} disabled={saving} className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block font-semibold text-slate-900 break-words">{account.name || `隊員 #${account.id}`}</span>{account.email ? <span className="mt-0.5 block break-all text-xs text-slate-600">{account.email}</span> : null}</span></label></li>)}</ul>
      </section> : <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">這個團隊沒有可隨團隊刪除的批次帳號。</p>}
    </DangerConfirmDialog> : null}
    {resetCredential ? <TemporaryCredentialDialog state={resetCredential} onClose={() => setResetCredential(null)} /> : null}
    </div>
}
