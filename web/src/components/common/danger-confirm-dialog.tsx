'use client'

import { useEffect, useMemo, useState } from 'react'

export type DangerImpactItem = {
  label: string
  value?: string | number | null
  description?: string
}

type DangerConfirmDialogProps = {
  title: string
  description: string
  impacts?: DangerImpactItem[]
  confirmLabel?: string
  cancelLabel?: string
  expectedText?: string | null
  expectedTextLabel?: string
  pending?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (confirmationText: string) => void
}

export function DangerConfirmDialog({
  title,
  description,
  impacts = [],
  confirmLabel = '確認刪除',
  cancelLabel = '取消',
  expectedText = null,
  expectedTextLabel = '請輸入確認文字',
  pending = false,
  error = null,
  onCancel,
  onConfirm,
}: DangerConfirmDialogProps) {
  const [confirmationText, setConfirmationText] = useState('')
  const normalizedExpectedText = expectedText?.trim() ?? ''
  const needsTypedConfirmation = normalizedExpectedText.length > 0
  const canConfirm = !pending && (!needsTypedConfirmation || confirmationText.trim() === normalizedExpectedText)

  const renderedImpacts = useMemo(() => impacts.filter((item) => item.label.trim().length > 0), [impacts])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel, pending])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6" onMouseDown={() => !pending && onCancel()}>
      <div
        className="w-full max-w-2xl rounded-[1.75rem] border border-slate-300 bg-white p-6 shadow-[0_24px_70px_rgba(10,10,10,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="danger-confirm-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="lab-eyebrow text-slate-600">Confirmation Required</p>
            <h2 id="danger-confirm-title" className="text-2xl font-bold text-slate-950">{title}</h2>
            <p className="text-sm leading-7 text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            onClick={onCancel}
            disabled={pending}
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {renderedImpacts.length > 0 ? (
          <div className="lab-notice mt-5">
            <p className="text-sm font-semibold text-slate-900">此操作會永久影響：</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {renderedImpacts.map((item) => (
                <li key={item.label} className="flex items-start justify-between gap-4 rounded-[0.9rem] bg-white/70 px-3 py-2">
                  <span>{item.label}</span>
                  <span className="text-right font-semibold">{item.value ?? ''}</span>
                  {item.description ? <span className="sr-only">{item.description}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {needsTypedConfirmation ? (
          <div className="mt-5 space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="danger-confirm-input">
              {expectedTextLabel}
            </label>
            <input
              id="danger-confirm-input"
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              className="lab-input"
              placeholder={normalizedExpectedText}
              disabled={pending}
              autoFocus
            />
            <p className="text-xs leading-6 text-slate-500">必須完全輸入：{normalizedExpectedText}</p>
          </div>
        ) : null}

        {error ? <p role="alert" aria-live="polite" className="lab-notice mt-5">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="lab-btn-secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button type="button" className="lab-btn-primary" onClick={() => onConfirm(confirmationText.trim())} disabled={!canConfirm}>
            {pending ? '處理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
