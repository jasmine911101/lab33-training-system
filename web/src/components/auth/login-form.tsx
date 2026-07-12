'use client'

import Link from 'next/link'
import { useState } from 'react'
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
  role: 'coach' | 'student' | 'unknown' | 'conflict'
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
      const access = await requestJson<AccessResponse>('/api/auth/access')

      if (!access.authenticated) {
        throw new Error('登入成功，但尚未取得有效 session。請再試一次。')
      }

      if (access.role === 'coach') {
        router.replace('/coach')
        router.refresh()
        return
      }

      if (access.role === 'student') {
        router.replace('/student')
        router.refresh()
        return
      }

      await supabase.auth.signOut({ scope: 'local' })
      setIsSubmitting(false)
      setError(
        access.role === 'conflict'
          ? getOAuthErrorMessage('role-conflict')
          : '這個登入帳號目前沒有對應到 LAB33 的教練或學員資料。',
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登入後驗證身份失敗。')
      setIsSubmitting(false)
    }
  }

  async function handleSendRecovery() {
    setError(null)
    setMessage(null)

    if (mode !== 'coach') {
      setError('學員忘記密碼請聯絡教練協助重設臨時密碼。')
      return
    }

    if (!email.trim()) {
      setError('請先輸入 Email，再寄送重設密碼連結。')
      return
    }

    setIsSendingRecovery(true)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      if (recoveryError) {
        throw recoveryError
      }

      setMessage('已寄出重設密碼 Email，請到信箱開啟連結後設定新密碼。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '寄送重設密碼 Email 失敗。')
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
      {mode === 'coach' ? (
        <button type="button" onClick={() => void handleSendRecovery()} disabled={isSendingRecovery || isGoogleLoading} className="lab-btn-secondary w-full disabled:opacity-60">
          {isSendingRecovery ? '寄送中...' : '忘記密碼？寄送重設連結'}
        </button>
      ) : (
        <div className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm leading-7 text-slate-600">
          Google 是主要登入方式。若你仍在使用舊的 Email + Password 備援帳號，忘記密碼時請聯絡教練協助處理。
        </div>
      )}
      <Link href="/reset-password" className="block text-center text-sm font-semibold text-slate-500 underline-offset-4 hover:underline">
        已有 recovery link？到這裡設定新密碼
      </Link>
    </form>
  )
}
