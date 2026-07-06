'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

export function PasswordRecoveryForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    const baseUrl = `${window.location.origin}${window.location.pathname}`
    const nextUrl = `${baseUrl}?${hash.slice(1)}`
    window.location.replace(nextUrl)
  }, [])

  const recoveryState = useMemo(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const type = searchParams.get('type')

    return {
      accessToken,
      refreshToken,
      isRecovery: Boolean(accessToken && refreshToken && type === 'recovery'),
    }
  }, [searchParams])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!newPassword) {
      setError('請輸入新 Password。')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('兩次輸入的 Password 不一致。')
      return
    }

    if (!recoveryState.accessToken || !recoveryState.refreshToken) {
      setError('找不到 recovery token，請重新開啟重設密碼連結。')
      return
    }

    setIsSubmitting(true)
    try {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: recoveryState.accessToken,
        refresh_token: recoveryState.refreshToken,
      })
      if (sessionError) throw sessionError

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      await supabase.auth.signOut()
      setMessage('密碼已更新，請回到登入頁用新密碼登入。')
      window.history.replaceState({}, '', window.location.pathname)
      setNewPassword('')
      setConfirmPassword('')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新密碼失敗。')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!recoveryState.isRecovery) {
    return (
      <div className="lab-card space-y-5 p-6 sm:p-7">
        <p className="text-sm leading-7 text-slate-600">這個頁面需要從 Supabase 的 recovery link 進入，才能設定新密碼。</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/student/login" className="lab-btn-primary">學員登入</Link>
          <Link href="/coach/login" className="lab-btn-secondary">教練登入</Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="lab-card space-y-5 p-6 sm:p-7">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="recovery-password">新 Password</label>
        <input id="recovery-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="lab-input" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="recovery-confirm-password">確認新 Password</label>
        <input id="recovery-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="lab-input" required />
      </div>
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <button type="submit" disabled={isSubmitting} className="lab-btn-primary w-full disabled:opacity-60">
        {isSubmitting ? '更新中...' : '更新密碼'}
      </button>
      <div className="flex flex-wrap gap-3">
        <Link href="/student/login" className="lab-btn-secondary">學員登入</Link>
        <Link href="/coach/login" className="lab-btn-secondary">教練登入</Link>
      </div>
    </form>
  )
}
