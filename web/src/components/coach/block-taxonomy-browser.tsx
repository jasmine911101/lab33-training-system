'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

type Breadcrumb = {
  label: string
  href?: string
}

type Entry = {
  id: number | string
  name: string
  href: string
  meta?: string
  nodeType?: 'sports' | 'age-groups' | 'training-categories'
  canManage?: boolean
}

type DeletePreview = {
  nodeName: string
  directChildTaxonomyCount: number
  descendantTaxonomyCount: number
  blockCount: number
  deletableBlocks: number
  permanentDeleteAllowed: boolean
  archiveAvailable: boolean
  referencedBlocks: Array<{
    blockId: number
    blockCode: string | null
    displayName: string | null
    usage: {
      products: number
      schedules: number
      teamPrograms: number
      results: number
    }
  }>
}

type Props = {
  eyebrow: string
  title: string
  description: string
  breadcrumbs?: Breadcrumb[]
  entries: Entry[]
  emptyMessage: string
  createForm?: ReactNode
  aside?: ReactNode
  backHref?: string
  backLabel?: string
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? '操作失敗。')
  return payload as T
}

function TaxonomyActionMenu({
  entry,
  openMenuId,
  setOpenMenuId,
}: {
  entry: Entry
  openMenuId: string | null
  setOpenMenuId: (menuId: string | null) => void
}) {
  const router = useRouter()
  const menuRootRef = useRef<HTMLDivElement | null>(null)
  const [editing, setEditing] = useState(false)
  const [nextName, setNextName] = useState(entry.name)
  const [preview, setPreview] = useState<DeletePreview | null>(null)
  const [confirmationName, setConfirmationName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const menuId = entry.nodeType ? `${entry.nodeType}:${entry.id}` : `disabled:${entry.id}`
  const open = openMenuId === menuId

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && menuRootRef.current?.contains(target)) return
      setOpenMenuId(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, setOpenMenuId])

  if (!entry.nodeType || entry.canManage === false) return null

  const baseEndpoint = `/api/coach/block-taxonomy/${entry.nodeType}/${entry.id}`

  async function renameNode() {
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ message?: string }>(baseEndpoint, {
        method: 'PATCH',
        body: JSON.stringify({ name: nextName }),
      })
      setMessage(payload.message ?? '已更新分類名稱。')
      setEditing(false)
      setOpenMenuId(null)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新分類名稱失敗。')
    } finally {
      setPending(false)
    }
  }

  async function loadDeletePreview() {
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const payload = await requestJson<{ preview: DeletePreview }>(`${baseEndpoint}/delete-preview`)
      setPreview(payload.preview)
      setOpenMenuId(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '讀取刪除預覽失敗。')
    } finally {
      setPending(false)
    }
  }

  async function deleteNode() {
    if (!preview) return
    setPending(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string }>(baseEndpoint, {
        method: 'DELETE',
        body: JSON.stringify({ confirmationName }),
      })
      setMessage(payload.message ?? '已刪除分類。')
      setPreview(null)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '刪除分類失敗。')
    } finally {
      setPending(false)
    }
  }

  async function archiveNode() {
    setPending(true)
    setError(null)
    try {
      const payload = await requestJson<{ message?: string }>(`${baseEndpoint}/archive`, { method: 'POST', body: JSON.stringify({}) })
      setMessage(payload.message ?? '已封存分類。')
      setPreview(null)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '封存分類失敗。')
    } finally {
      setPending(false)
    }
  }

  return (
    <div ref={menuRootRef} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        aria-label={`管理 ${entry.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${menuId}-menu` : undefined}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpenMenuId(open ? null : menuId)
        }}
      >
        ⋯
      </button>

      {open ? (
        <div
          id={`${menuId}-menu`}
          role="menu"
          className="absolute right-0 top-11 z-30 w-48 rounded-[1rem] border border-slate-200 bg-white p-2 text-sm shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded-xl px-3 py-2 text-left font-semibold text-slate-700 hover:bg-slate-50"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setOpenMenuId(null)
              setEditing(true)
            }}
          >
            編輯名稱
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center rounded-xl px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setOpenMenuId(null)
              void loadDeletePreview()
            }}
            disabled={pending}
          >
            刪除分類
          </button>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4" onClick={() => setEditing(false)}>
          <div className="w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <p className="lab-eyebrow">Rename Folder</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">編輯分類名稱</h3>
            <input className="lab-input mt-5" value={nextName} onChange={(event) => setNextName(event.target.value)} autoFocus />
            {error ? <p className="mt-3 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="lab-btn-primary" onClick={() => void renameNode()} disabled={pending}>{pending ? '儲存中...' : '儲存名稱'}</button>
              <button type="button" className="lab-btn-secondary" onClick={() => setEditing(false)} disabled={pending}>取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4" onClick={() => setPreview(null)}>
          <div className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <p className="lab-eyebrow">Delete Preview</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">刪除「{preview.nodeName}」</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="lab-stat-card"><p className="lab-eyebrow">子分類</p><p className="mt-2 text-xl font-bold">{preview.directChildTaxonomyCount}</p></div>
              <div className="lab-stat-card"><p className="lab-eyebrow">所有子孫分類</p><p className="mt-2 text-xl font-bold">{preview.descendantTaxonomyCount}</p></div>
              <div className="lab-stat-card"><p className="lab-eyebrow">板塊</p><p className="mt-2 text-xl font-bold">{preview.blockCount}</p></div>
            </div>
            {preview.referencedBlocks.length > 0 ? (
              <div className="mt-5 rounded-[1rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-bold">此分類內有 {preview.referencedBlocks.length} 個板塊正在被商品、課表、方案或回報使用，因此無法永久刪除。</p>
                <div className="mt-3 space-y-2">
                  {preview.referencedBlocks.map((block) => (
                    <div key={block.blockId} className="rounded-xl bg-white/70 px-3 py-2">
                      <span className="font-semibold">{block.blockCode ?? '無代號'} | {block.displayName ?? '未命名板塊'}</span>
                      <span className="ml-2 text-xs">商品 {block.usage.products} · 課表 {block.usage.schedules} · 方案 {block.usage.teamPrograms} · 回報 {block.usage.results}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                永久刪除會移除分類、所有子分類，以及分類內未被引用的 Blocks。此操作無法復原。
              </div>
            )}

            {preview.permanentDeleteAllowed ? (
              <div className="mt-5 space-y-2">
                <label className="text-sm font-semibold text-slate-700">輸入分類名稱確認永久刪除</label>
                <input className="lab-input" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} placeholder={preview.nodeName} />
              </div>
            ) : null}
            {error ? <p className="mt-3 rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              {preview.permanentDeleteAllowed ? <button type="button" className="lab-btn-secondary !text-rose-600" onClick={() => void deleteNode()} disabled={pending || confirmationName.trim() !== preview.nodeName.trim()}>{pending ? '刪除中...' : '永久刪除'}</button> : null}
              {preview.archiveAvailable ? <button type="button" className="lab-btn-primary" onClick={() => void archiveNode()} disabled={pending}>{pending ? '封存中...' : '封存分類及子分類'}</button> : null}
              <button type="button" className="lab-btn-secondary" onClick={() => setPreview(null)} disabled={pending}>取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <div className="fixed bottom-5 right-5 z-50 rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">{message}</div> : null}
    </div>
  )
}

export function BlockTaxonomyBrowser({
  eyebrow,
  title,
  description,
  breadcrumbs = [],
  entries,
  emptyMessage,
  createForm,
  aside,
  backHref,
  backLabel = '返回上一層',
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <article className="lab-card p-4 sm:p-5">
        {breadcrumbs.length > 0 ? (
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span>/</span> : null}
                {breadcrumb.href ? <Link href={breadcrumb.href} className="hover:text-slate-900">{breadcrumb.label}</Link> : <span className="font-semibold text-slate-900">{breadcrumb.label}</span>}
              </div>
            ))}
          </nav>
        ) : null}

        {backHref ? <Link href={backHref} className="mb-3 inline-flex text-sm font-semibold text-slate-600 hover:text-orange-600">← {backLabel}</Link> : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="lab-eyebrow">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            <p className="lab-copy mt-2 max-w-3xl">{description}</p>
          </div>
          {aside ? <div className="lg:max-w-sm lg:min-w-[280px]">{aside}</div> : null}
        </div>
      </article>

      {createForm ? createForm : null}

      <article className="lab-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="lab-eyebrow">Folders</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">分類資料夾</h2>
          </div>
          <span className="lab-badge-primary">{entries.length} 個項目</span>
        </div>

        {entries.length === 0 ? (
          <div className="lab-card-muted mt-5 px-5 py-6 text-sm text-slate-600">{emptyMessage}</div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
              <div key={entry.id} className="group rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <Link href={entry.href} className="min-w-0 flex-1">
                    <p className="lab-eyebrow text-[0.72rem]">資料夾</p>
                    <h3 className="mt-3 truncate text-xl font-bold text-slate-900 group-hover:text-orange-600">{entry.name}</h3>
                    {entry.meta ? <p className="mt-2 text-sm text-slate-500">{entry.meta}</p> : null}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link href={entry.href} className="lab-badge bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-700">前往</Link>
                    <TaxonomyActionMenu entry={entry} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  )
}
