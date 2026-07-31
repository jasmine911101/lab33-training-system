'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { DangerConfirmDialog } from '@/components/common/danger-confirm-dialog'

type Props = {
  name: string
  endpoint: string
  parentHref: string
}

export function BlockTaxonomyEntryActions({ name, endpoint, parentHref }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [nextName, setNextName] = useState(name)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function request(method: 'PATCH' | 'DELETE', body?: Record<string, string>) {
    const response = await fetch(endpoint, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) throw new Error(payload?.error ?? '操作失敗，請稍後再試。')
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      await request('PATCH', { name: nextName })
      setIsEditing(false)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新分類失敗。')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    try {
      await request('DELETE')
      router.push(parentHref)
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '刪除分類失敗。')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="mt-4 border-t border-slate-100 pt-4">
        {isEditing ? (
          <div className="space-y-2">
            <label className="sr-only" htmlFor={`taxonomy-name-${endpoint}`}>分類名稱</label>
            <input
              id={`taxonomy-name-${endpoint}`}
              className="lab-input !min-h-10 px-3 py-2 text-sm"
              value={nextName}
              onChange={(event) => setNextName(event.target.value)}
              disabled={isSaving}
            />
            <div className="flex gap-2">
              <button type="button" className="lab-btn-primary !min-h-9 px-3 py-1.5 text-xs" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? '儲存中…' : '儲存'}
              </button>
              <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" onClick={() => { setIsEditing(false); setNextName(name); setError(null) }} disabled={isSaving}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs" onClick={() => setIsEditing(true)}>
              編輯名稱
            </button>
            <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1.5 text-xs text-rose-700" onClick={() => setIsDeleteOpen(true)}>
              刪除
            </button>
          </div>
        )}
        {error ? <p role="alert" aria-live="polite" className="lab-notice mt-3">{error}</p> : null}
      </div>

      {isDeleteOpen ? createPortal(
        <DangerConfirmDialog
          title={`刪除「${name}」？`}
          description="此操作無法復原。若資料夾仍有下層分類或板塊，系統會保留資料並告訴你需先處理的內容。"
          impacts={[{ label: '分類資料夾', value: name }]}
          confirmLabel="確認刪除"
          pending={isDeleting}
          error={error}
          onCancel={() => !isDeleting && setIsDeleteOpen(false)}
          onConfirm={() => void handleDelete()}
        />,
        document.body,
      ) : null}
    </>
  )
}
