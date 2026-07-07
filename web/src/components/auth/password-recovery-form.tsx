'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { validateNewPassword } from '@/lib/auth/password-rules'
import { createClient } from '@/lib/supabase/client'

type RecoveryBootstrapState = 'idle' | 'loading' | 'ready' | 'error'

function getRecoveryParamsFromBrowser(searchParams: URLSearchParams) {
  if (typeof window === 'undefined') {
    return {
      accessToken: searchParams.get('access_token'),
      refreshToken: searchParams.get('refresh_token'),
      type: searchParams.get('type'),
      code: searchParams.get('code'),
    }
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return {
    accessToken: hashParams.get('access_token') ?? searchParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') ?? searchParams.get('refresh_token'),
    type: hashParams.get('type') ?? searchParams.get('type'),
    code: searchParams.get('code'),
  }
}

export function PasswordRecoveryForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bootstrapState, setBootstrapState] = useState<RecoveryBootstrapState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const recoveryState = useMemo(() => {
    const params = getRecoveryParamsFromBrowser(searchParams)
    return {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      type: params.type,
      code: params.code,
      hasRecoveryTokens: Boolean(params.accessToken && params.refreshToken && params.type === 'recovery'),
      hasAuthCode: Boolean(params.code),
    }
  }, [searchParams])

  useEffect(() => {
    let isCancelled = false

    async function bootstrapRecoverySession() {
      setError(null)
      setMessage(null)

      if (!recoveryState.hasRecoveryTokens && !recoveryState.hasAuthCode) {
        setBootstrapState('idle')
        return
      }

      setBootstrapState('loading')

      try {
        if (recoveryState.hasRecoveryTokens && recoveryState.accessToken && recoveryState.refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: recoveryState.accessToken,
            refresh_token: recoveryState.refreshToken,
          })
          if (sessionError) throw sessionError
        } else if (recoveryState.hasAuthCode && recoveryState.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(recoveryState.code)
          if (exchangeError) throw exchangeError
        }

        if (isCancelled) return

        setBootstrapState('ready')
        window.history.replaceState({}, '', window.location.pathname)
      } catch (requestError) {
        if (isCancelled) return
        setBootstrapState('error')
        setError(requestError instanceof Error ? requestError.message : '無法驗證 recovery session。')
      }
    }

    void bootstrapRecoverySession()

    return () => {
      isCancelled = true
    }
  }, [recoveryState.accessToken, recoveryState.code, recoveryState.hasAuthCode, recoveryState.hasRecoveryTokens, recoveryState.refreshToken, supabase])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const validationMessage = validateNewPassword(newPassword, confirmPassword)
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    if (bootstrapState !== 'ready') {
      setError('目前 recovery session 尚未完成，請重新開啟重設密碼連結。')
      return
    }

    setIsSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      await supabase.auth.signOut()
      setMessage('密碼更新成功，正在帶你回到教練登入頁。')
      setNewPassword('')
      setConfirmPassword('')
      window.setTimeout(() => {
        router.replace('/coach/login')
        router.refresh()
      }, 1200)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新密碼失敗。')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!recoveryState.hasRecoveryTokens && !recoveryState.hasAuthCode) {
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
      {bootstrapState === 'loading' ? (
        <div className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm text-slate-600">正在驗證重設密碼連結...</div>
      ) : null}

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
          disabled={bootstrapState !== 'ready' || isSubmitting}
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
          disabled={bootstrapState !== 'ready' || isSubmitting}
        />
      </div>
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <button type="submit" disabled={isSubmitting || bootstrapState !== 'ready'} className="lab-btn-primary w-full disabled:opacity-60">
        {isSubmitting ? '更新中...' : '更新密碼'}
      </button>
      <div className="flex flex-wrap gap-3">
        <Link href="/coach/login" className="lab-btn-secondary">教練登入</Link>
        <Link href="/student/login" className="lab-btn-secondary">學員登入</Link>
      </div>
    </form>
  )
}
