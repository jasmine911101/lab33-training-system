'use client'

import { useEffect, useMemo, useState } from 'react'

import type { QaEntry } from '@/lib/types/qa-library'

export function StudentQaLibrary({ entries }: { entries: QaEntry[] }) {
  const [query, setQuery] = useState('')
  const [syncedEntries, setSyncedEntries] = useState(entries)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function refreshQa() {
      try {
        const response = await fetch('/api/student/qa', { cache: 'no-store' })
        const payload = (await response.json().catch(() => null)) as { entries?: QaEntry[]; error?: string } | null
        if (!response.ok) throw new Error(payload?.error ?? '同步 QA 失敗。')
        if (active && payload?.entries) {
          setSyncedEntries(payload.entries)
          setSyncError(null)
        }
      } catch (error) {
        if (active) setSyncError(error instanceof Error ? error.message : '同步 QA 失敗。')
      }
    }

    const intervalId = window.setInterval(() => void refreshQa(), 5000)
    window.addEventListener('focus', refreshQa)
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('lab33-qa-library')
    channel?.addEventListener('message', refreshQa)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshQa)
      channel?.close()
    }
  }, [])

  const matches = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-Hant')
    return syncedEntries
      .map((entry, index) => ({ ...entry, number: index + 1 }))
      .filter((entry) => !keyword || String(entry.number).includes(keyword) || String(entry.number).padStart(2, '0').includes(keyword) || entry.question.toLocaleLowerCase('zh-Hant').includes(keyword))
  }, [syncedEntries, query])

  return (
    <section className="lab-card overflow-hidden p-6 sm:p-7">
      <div className="rounded-[1.35rem] bg-slate-950 px-5 py-6 text-white sm:px-7 sm:py-8">
        <p className="text-xs font-semibold tracking-[0.22em] text-slate-300">VIDEO ANSWERS</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">找到你的答案</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">以編號或關鍵字搜尋，選擇題目後即可開啟教練準備的影片解答。</p>
        <label className="mt-6 block max-w-2xl" htmlFor="student-qa-search">
          <span className="sr-only">搜尋 QA 編號或問題</span>
          <input id="student-qa-search" name="qa-search" autoComplete="off" className="lab-input bg-white text-slate-900" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="輸入 1、2、3… 或問題關鍵字…" />
        </label>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{query ? `找到 ${matches.length} 筆結果` : `共 ${syncedEntries.length} 個問題`}</p>
        <span className="lab-badge-primary">QA 庫</span>
      </div>

      <ol className="mt-4 space-y-3">
        {matches.map((entry) => (
          <li key={entry.id} className="group rounded-[1.25rem] border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] sm:p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-slate-100 px-2 text-sm font-black tabular-nums text-slate-900">{String(entry.number).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-7 text-slate-900 break-words sm:text-lg">{entry.question}</h2>
                <a href={entry.answer_video_url} target="_blank" rel="noreferrer" className="lab-btn-primary mt-4 !min-h-10 px-4 py-2 text-sm !text-white">觀看影片解答 <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {matches.length === 0 && syncedEntries.length > 0 ? <div className="lab-card-muted mt-4 px-5 py-7 text-sm text-slate-700">找不到符合的 QA。試試輸入編號或其他問題關鍵字。</div> : null}
      {syncedEntries.length === 0 ? <div className="lab-card-muted mt-4 px-5 py-7 text-sm text-slate-700">目前尚無 QA，請稍後再回來查看。</div> : null}
      {syncError ? <p className="lab-notice mt-4" role="status" aria-live="polite">目前無法自動同步，系統會稍後再試。</p> : null}
    </section>
  )
}
