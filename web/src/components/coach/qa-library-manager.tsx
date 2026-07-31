'use client'

import { useMemo, useState } from 'react'

import { DangerConfirmDialog } from '@/components/common/danger-confirm-dialog'
import type { QaEntry, QaInput } from '@/lib/types/qa-library'

const emptyForm: QaInput = { question: '', answer_video_url: '' }

function broadcastQaChange() {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel('lab33-qa-library')
  channel.postMessage({ type: 'qa-updated' })
  channel.close()
}

async function request<T>(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const payload = (await response.json().catch(() => null)) as { entry?: T; error?: string; message?: string } | null
  if (!response.ok) throw new Error(payload?.error ?? '操作失敗，請稍後再試。')
  return payload
}

function parseCsv(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [question = '', answer_video_url = ''] = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
    return { question, answer_video_url }
  }).filter((row) => row.question && row.answer_video_url)
}

function rowsToQa(rows: unknown[][]) {
  return rows
    .map((row) => ({ question: String(row[0] ?? '').trim(), answer_video_url: String(row[1] ?? '').trim() }))
    .filter((row) => row.question && row.answer_video_url)
    .filter((row) => !(/^(問題|question)$/i.test(row.question) && /^(影片連結|影片解答連結|video|video url)$/i.test(row.answer_video_url)))
}

async function parseImportFile(file: File) {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text())
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return []
    return rowsToQa(XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], { header: 1, blankrows: false }))
  }
  throw new Error('請選擇 CSV 或 XLSX 檔案。')
}

export function QaLibraryManager({ initialEntries }: { initialEntries: QaEntry[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [createForm, setCreateForm] = useState<QaInput>(emptyForm)
  const [editForm, setEditForm] = useState<QaInput>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<QaEntry | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [importPreview, setImportPreview] = useState<QaInput[] | null>(null)
  const [selectedImportRows, setSelectedImportRows] = useState<number[]>([])

  const filteredEntries = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-Hant')
    return entries
      .map((entry, index) => ({ ...entry, number: index + 1 }))
      .filter((entry) => !keyword || String(entry.number).includes(keyword) || String(entry.number).padStart(2, '0').includes(keyword) || entry.question.toLocaleLowerCase('zh-Hant').includes(keyword))
  }, [entries, query])

  function clearFeedback() {
    setError(null)
    setMessage(null)
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true); clearFeedback()
    try {
      const payload = await request<QaEntry>('/api/coach/qa', { method: 'POST', body: JSON.stringify(createForm) })
      const entry = payload?.entry
      if (entry) setEntries((current) => [entry, ...current])
      broadcastQaChange()
      setCreateForm(emptyForm)
      setMessage('QA 已新增。')
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '新增 QA 失敗。') } finally { setPending(false) }
  }

  function startEditing(entry: QaEntry) {
    setEditingId(entry.id)
    setEditForm({ question: entry.question, answer_video_url: entry.answer_video_url })
    clearFeedback()
  }

  async function saveEdit(id: number) {
    setPending(true); clearFeedback()
    try {
      const payload = await request<QaEntry>(`/api/coach/qa/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) })
      const entry = payload?.entry
      if (entry) setEntries((current) => current.map((current) => current.id === id ? entry : current))
      broadcastQaChange()
      setEditingId(null)
      setEditForm(emptyForm)
      setMessage('QA 已更新。')
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '更新 QA 失敗。') } finally { setPending(false) }
  }

  async function previewImport(file: File | null) {
    if (!file) return
    setPending(true); clearFeedback()
    try {
      const rows = await parseImportFile(file)
      if (!rows.length) throw new Error('找不到可匯入資料。請使用前兩欄「問題、影片連結」的 CSV 或 XLSX 格式。')
      setImportPreview(rows)
      setSelectedImportRows(rows.map((_, index) => index))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '讀取匯入檔失敗。') } finally { setPending(false) }
  }

  function toggleImportRow(index: number) {
    setSelectedImportRows((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])
  }

  async function confirmImport() {
    if (!importPreview?.length || !selectedImportRows.length) return
    setPending(true); clearFeedback()
    try {
      const added: QaEntry[] = []
      for (const index of selectedImportRows) {
        const row = importPreview[index]
        if (!row) continue
        const payload = await request<QaEntry>('/api/coach/qa', { method: 'POST', body: JSON.stringify(row) })
        const entry = payload?.entry
        if (entry) added.push(entry)
      }
      setEntries((current) => [...added, ...current])
      broadcastQaChange()
      setMessage(`已匯入 ${added.length} 筆 QA。`)
      setImportPreview(null)
      setSelectedImportRows([])
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '匯入 QA 失敗。') } finally { setPending(false) }
  }

  async function remove() {
    if (!deleting) return
    setPending(true); clearFeedback()
    try {
      await request(`/api/coach/qa/${deleting.id}`, { method: 'DELETE' })
      setEntries((current) => current.filter((entry) => entry.id !== deleting.id))
      broadcastQaChange()
      setDeleting(null)
      setMessage('QA 已刪除。')
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '刪除 QA 失敗。') } finally { setPending(false) }
  }

  return <div className="space-y-6">
    <article className="lab-card p-6 sm:p-7">
      <p className="lab-eyebrow">QA Library</p><h1 className="lab-section-title mt-3">QA 庫管理</h1>
      <p className="lab-copy mt-3">建立常見問題與影片解答；學員端將以影片連結閱讀解答。</p>
      <form className="mt-6 grid gap-4" onSubmit={(event) => void create(event)}>
        <div className="space-y-2"><label htmlFor="qa-question" className="text-sm font-semibold text-slate-800">問題</label><textarea id="qa-question" name="qa-question" autoComplete="off" className="lab-input min-h-24" value={createForm.question} onChange={(event) => setCreateForm((current) => ({ ...current, question: event.target.value }))} placeholder="例如：訓練前需要做哪些暖身？" /></div>
        <div className="space-y-2"><label htmlFor="qa-video" className="text-sm font-semibold text-slate-800">影片解答連結</label><input id="qa-video" name="qa-video" type="url" autoComplete="off" className="lab-input" value={createForm.answer_video_url} onChange={(event) => setCreateForm((current) => ({ ...current, answer_video_url: event.target.value }))} placeholder="https://影片網址…" /></div>
        <div><button type="submit" className="lab-btn-primary" disabled={pending}>{pending ? '儲存中…' : '新增 QA'}</button></div>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <label htmlFor="qa-import" className="text-sm font-semibold text-slate-800">匯入 CSV 或 Excel</label>
        <p className="mt-1 text-xs leading-6 text-[color:var(--color-text-muted)]">CSV 或第一個 Excel 工作表的前兩欄：問題、影片連結。選檔後可逐筆選取要匯入的資料。</p>
        <input id="qa-import" name="qa-import" type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="mt-3 block max-w-full text-sm text-slate-800 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" onChange={(event) => void previewImport(event.target.files?.[0] ?? null)} disabled={pending} />
      </div>

      {importPreview ? <section className="mt-5 rounded-[1.25rem] border border-slate-300 bg-slate-50 p-4 sm:p-5" aria-labelledby="qa-import-preview-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="qa-import-preview-title" className="text-base font-bold text-slate-950">匯入預覽</h2><p className="mt-1 text-sm text-slate-700">已讀取 {importPreview.length} 筆，已選取 {selectedImportRows.length} 筆。</p></div><div className="flex flex-wrap gap-2"><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" onClick={() => setSelectedImportRows(importPreview.map((_, index) => index))} disabled={pending}>全選</button><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" onClick={() => setSelectedImportRows([])} disabled={pending}>取消全選</button></div></div>
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">{importPreview.map((row, index) => <label key={`${row.question}-${index}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm has-[:checked]:border-slate-950 has-[:checked]:bg-slate-100"><input type="checkbox" name="qa-import-row" className="mt-1 h-4 w-4 accent-slate-950" checked={selectedImportRows.includes(index)} onChange={() => toggleImportRow(index)} disabled={pending} /><span className="min-w-0"><span className="block font-semibold text-slate-950 break-words">{index + 1}. {row.question}</span><span className="mt-1 block truncate text-xs text-slate-700">{row.answer_video_url}</span></span></label>)}</div>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => { setImportPreview(null); setSelectedImportRows([]) }} disabled={pending}>清除預覽</button><button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" onClick={() => void confirmImport()} disabled={pending || selectedImportRows.length === 0}>{pending ? '匯入中…' : `確認匯入 ${selectedImportRows.length} 筆`}</button></div>
      </section> : null}
      {error ? <p role="alert" aria-live="polite" className="lab-notice mt-5">{error}</p> : null}{message ? <p aria-live="polite" className="lab-notice mt-5">{message}</p> : null}
    </article>

    <article className="lab-card p-6 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="lab-eyebrow">Entries</p><h2 className="lab-section-title mt-3">已建立 QA</h2></div><label className="w-full sm:w-72" htmlFor="coach-qa-search"><span className="sr-only">搜尋 QA</span><input id="coach-qa-search" name="coach-qa-search" autoComplete="off" className="lab-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋編號或問題…" /></label></div>
      <div className="mt-6 space-y-3">{filteredEntries.map((entry) => <article key={entry.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-5"><div className="flex items-start gap-4"><span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-950 px-2 text-xs font-bold tabular-nums text-white">{String(entry.number).padStart(2, '0')}</span><div className="min-w-0 flex-1">{editingId === entry.id ? <div className="space-y-3"><div><label htmlFor={`qa-edit-question-${entry.id}`} className="text-sm font-semibold text-slate-800">問題</label><textarea id={`qa-edit-question-${entry.id}`} name={`qa-edit-question-${entry.id}`} autoComplete="off" className="lab-input mt-2 min-h-24" value={editForm.question} onChange={(event) => setEditForm((current) => ({ ...current, question: event.target.value }))} /></div><div><label htmlFor={`qa-edit-video-${entry.id}`} className="text-sm font-semibold text-slate-800">影片解答連結</label><input id={`qa-edit-video-${entry.id}`} name={`qa-edit-video-${entry.id}`} type="url" autoComplete="off" className="lab-input mt-2" value={editForm.answer_video_url} onChange={(event) => setEditForm((current) => ({ ...current, answer_video_url: event.target.value }))} /></div><div className="flex flex-wrap gap-2"><button type="button" className="lab-btn-primary !min-h-10 px-4 py-2 text-sm" onClick={() => void saveEdit(entry.id)} disabled={pending}>{pending ? '儲存中…' : '儲存修改'}</button><button type="button" className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm" onClick={() => { setEditingId(null); setEditForm(emptyForm); clearFeedback() }} disabled={pending}>取消</button></div></div> : <><p className="font-semibold text-slate-950 break-words">{entry.question}</p><a href={entry.answer_video_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-slate-800 underline decoration-slate-400 underline-offset-4 hover:text-slate-950">觀看影片連結 <span aria-hidden="true">↗</span></a><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" onClick={() => startEditing(entry)} disabled={pending}>編輯</button><button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs text-rose-700" onClick={() => setDeleting(entry)} disabled={pending}>刪除</button></div></>}</div></div></article>)}{filteredEntries.length === 0 ? <p className="lab-card-muted px-5 py-6 text-sm text-slate-700">尚無符合的 QA 資料。</p> : null}</div>
    </article>
    {deleting ? <DangerConfirmDialog title="刪除這筆 QA？" description="刪除後學員端將無法再看到這筆問題與影片解答。" impacts={[{ label: '問題', value: deleting.question }]} pending={pending} error={error} onCancel={() => !pending && setDeleting(null)} onConfirm={() => void remove()} /> : null}
  </div>
}
