'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { getOAuthErrorMessage } from '@/lib/auth/oauth-errors'
import { createClient } from '@/lib/supabase/client'

type LoginFormProps = {
  mode: 'coach' | 'student'
  initialError?: string | null
  initialMessage?: string | null
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!response.ok) {
    throw new Error(payload?.error ?? '操作失敗，請稍後再試。')
  }

  return (payload ?? {}) as T
}

type AccessResponse = {
  authenticated: boolean
  hasCoachAccess?: boolean
  hasStudentAccess?: boolean
  errorCode?: string | null
}

const RECOVERY_COOLDOWN_SECONDS = 60

function isRecoveryRateLimitError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { status?: number; code?: string; message?: string }
  const code = maybeError.code?.toLowerCase() ?? ''
  const message = maybeError.message?.toLowerCase() ?? ''

  return (
    maybeError.status === 429 ||
    code.includes('over_email_send_rate_limit') ||
    code.includes('rate_limit') ||
    message.includes('email rate limit exceeded') ||
    message.includes('over_email_send_rate_limit') ||
    message.includes('rate limit')
  )
}

function recoveryRateLimitMessage(mode: 'coach' | 'student') {
  return mode === 'coach'
    ? '重設密碼信寄送次數已達上限，請稍後再試，或聯絡總教練重設暫時密碼。'
    : '重設密碼信寄送次數已達上限，請稍後再試，或聯絡負責教練重設暫時密碼。'
}

export function LoginForm({ mode, initialError = null, initialMessage = null }: LoginFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [message, setMessage] = useState<string | null>(initialMessage)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingRecovery, setIsSendingRecovery] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [recoveryCooldown, setRecoveryCooldown] = useState(0)

  useEffect(() => {
    if (recoveryCooldown <= 0) return

    const timer = window.setTimeout(() => {
      setRecoveryCooldown((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [recoveryCooldown])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setIsSubmitting(false)
      return
    }

    try {
      const access = await requestJson<AccessResponse>(`/api/auth/${mode}-access`)

      if (!access.authenticated) {
        throw new Error('登入成功，但尚未取得有效 session。請再試一次。')
      }

      if (mode === 'coach' && access.hasCoachAccess) {
        router.replace('/coach')
        router.refresh()
        return
      }

      if (mode === 'student' && access.hasStudentAccess) {
        router.replace('/student')
        router.refresh()
        return
      }

      await supabase.auth.signOut({ scope: 'local' })
      setIsSubmitting(false)
      setError(
        getOAuthErrorMessage(access.errorCode) ??
          (mode === 'coach' ? '這個登入帳號目前沒有對應到 LAB33 的教練資料。' : '這個登入帳號目前沒有對應到 LAB33 的學員資料。'),
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登入後驗證身份失敗。')
      setIsSubmitting(false)
    }
  }

  async function handleSendRecovery() {
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('請先輸入 Email，再寄送重設密碼連結。')
      return
    }

    if (isSendingRecovery || recoveryCooldown > 0) {
      return
    }

    setIsSendingRecovery(true)
    try {
      const redirectTo = `${window.location.origin}/auth/callback?intent=recovery`
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (recoveryError) {
        throw recoveryError
      }

      setMessage('如果此 Email 有對應帳號，重設密碼信將會寄出。')
      setRecoveryCooldown(RECOVERY_COOLDOWN_SECONDS)
    } catch (requestError) {
      setError(
        isRecoveryRateLimitError(requestError)
          ? recoveryRateLimitMessage(mode)
          : '寄送重設密碼連結失敗，請稍後再試。',
      )
    } finally {
      setIsSendingRecovery(false)
    }
  }

  async function handleGoogleLogin() {
    setError(null)
    setMessage(null)
    setIsGoogleLoading(true)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?intent=${mode}`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lab-card space-y-5 p-6 sm:p-7">
      <div className="space-y-3">
        <button type="button" onClick={() => void handleGoogleLogin()} disabled={isSubmitting || isGoogleLoading} className="lab-btn-primary w-full disabled:opacity-60">
          {isGoogleLoading ? 'Google 驗證中...' : '使用 Google 登入'}
        </button>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">備用：Email + Password</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor={`${mode}-email`}>
          Email
        </label>
        <input
          id={`${mode}-email`}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="lab-input"
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor={`${mode}-password`}>
          Password
        </label>
        <input
          id={`${mode}-password`}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="lab-input"
          required
        />
      </div>
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      <button type="submit" disabled={isSubmitting || isGoogleLoading} className="lab-btn-secondary w-full disabled:opacity-60">
        {isSubmitting ? '登入中...' : '使用 Email + Password 登入'}
      </button>
      <button
        type="button"
        onClick={() => void handleSendRecovery()}
        disabled={isSendingRecovery || isGoogleLoading || recoveryCooldown > 0}
        className="lab-btn-secondary w-full disabled:opacity-60"
      >
        {isSendingRecovery
          ? '寄送中...'
          : recoveryCooldown > 0
            ? `${recoveryCooldown} 秒後可重新寄送`
            : '忘記密碼？寄送重設連結'}
      </button>
      <Link href="/reset-password" className="block text-center text-sm font-semibold text-slate-500 underline-offset-4 hover:underline">
        已有 recovery link？到這裡設定新密碼
      </Link>
    </form>
  )
}
