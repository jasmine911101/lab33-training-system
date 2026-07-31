'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { validateNewPassword } from '@/lib/auth/password-rules'
import { createClient } from '@/lib/supabase/client'

export function PasswordRecoveryForm({ recoveryReady }: { recoveryReady: boolean }) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const validationMessage = validateNewPassword(newPassword, confirmPassword)
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    if (!recoveryReady) {
      setError('重設密碼連結已失效，請重新申請。')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/auth/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(result?.error ?? '更新密碼失敗，請重新申請重設連結後再試。')
      }

      await createClient().auth.signOut({ scope: 'local' })
      setMessage('密碼更新成功，正在帶你回到教練登入頁。')
      setNewPassword('')
      setConfirmPassword('')
      window.setTimeout(() => {
        router.replace('/coach/login')
        router.refresh()
      }, 1200)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新密碼失敗，請稍後再試。')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!recoveryReady) {
    return (
      <div className="lab-card space-y-5 p-6 sm:p-7">
        <p className="text-sm leading-7 text-slate-600">這個頁面需要從 Supabase 的 recovery link 進入，才能設定新密碼。</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/coach/login" className="lab-btn-primary">教練登入</Link>
          <Link href="/student/login" className="lab-btn-secondary">學員登入</Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="lab-card space-y-5 p-6 sm:p-7">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="recovery-password">新 Password</label>
        <input
          id="recovery-password"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="lab-input"
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="recovery-confirm-password">確認新 Password</label>
        <input
          id="recovery-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="lab-input"
          autoComplete="new-password"
          required
          disabled={isSubmitting}
        />
      </div>
      {error ? <p role="alert" aria-live="polite" className="lab-notice">{error}</p> : null}
      {message ? <p aria-live="polite" className="lab-notice">{message}</p> : null}
      <button type="submit" disabled={isSubmitting} className="lab-btn-primary w-full disabled:opacity-60">
        {isSubmitting ? '更新中...' : '更新密碼'}
      </button>
      <div className="flex flex-wrap gap-3">
        <Link href="/coach/login" className="lab-btn-secondary">教練登入</Link>
        <Link href="/student/login" className="lab-btn-secondary">學員登入</Link>
      </div>
    </form>
  )
}
