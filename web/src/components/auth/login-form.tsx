'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

type LoginFormProps = {
  mode: 'coach' | 'student'
}

type PortalAccessResponse = {
  authenticated: boolean
  hasCoachAccess?: boolean
  hasStudentAccess?: boolean
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

export function LoginForm({ mode }: LoginFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingRecovery, setIsSendingRecovery] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  useEffect(() => {
    const accessUrl = mode === 'coach' ? '/api/auth/coach-access' : '/api/auth/student-access'

    let isCancelled = false

    async function verifyPortalAccess() {
      try {
        const access = await requestJson<PortalAccessResponse>(accessUrl)
        if (isCancelled || !access.authenticated) return

        const hasAccess = mode === 'coach' ? Boolean(access.hasCoachAccess) : Boolean(access.hasStudentAccess)

        if (hasAccess) {
          router.replace(mode === 'coach' ? '/coach' : '/student')
          router.refresh()
          return
        }

        await supabase.auth.signOut({ scope: 'local' })
        if (isCancelled) return
        setError(
          mode === 'coach'
            ? '此 Google 帳號尚未被授權為教練，請聯繫管理員。'
            : '此 Google 帳號尚未被授權為學員，請聯繫教練。',
        )
      } catch (requestError) {
        if (isCancelled) return
        setError(requestError instanceof Error ? requestError.message : 'Google 登入失敗。')
      } finally {
        if (!isCancelled) {
          setIsGoogleLoading(false)
        }
      }
    }

    void verifyPortalAccess()

    return () => {
      isCancelled = true
    }
  }, [mode, router, supabase.auth])

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

    router.replace(mode === 'coach' ? '/coach' : '/student')
    router.refresh()
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
        redirectTo: `${window.location.origin}/auth/callback?next=${mode === 'coach' ? '/coach/login' : '/student/login'}`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lab-card space-y-5 p-6 sm:p-7">
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
      <button type="submit" disabled={isSubmitting || isGoogleLoading} className="lab-btn-primary w-full disabled:opacity-60">
        {isSubmitting ? '登入中...' : '登入'}
      </button>
      <button type="button" onClick={() => void handleGoogleLogin()} disabled={isSubmitting || isGoogleLoading} className="lab-btn-secondary w-full disabled:opacity-60">
        {isGoogleLoading ? 'Google 驗證中...' : '使用 Google 登入'}
      </button>
      {mode === 'coach' ? (
        <button type="button" onClick={() => void handleSendRecovery()} disabled={isSendingRecovery || isGoogleLoading} className="lab-btn-secondary w-full disabled:opacity-60">
          {isSendingRecovery ? '寄送中...' : '忘記密碼？寄送重設連結'}
        </button>
      ) : (
        <div className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm leading-7 text-slate-600">
          如果忘記密碼，請聯絡教練幫你重設臨時密碼。教練重設後，你可以用臨時密碼登入，系統會要求你立刻設定新密碼。
        </div>
      )}
      <Link href="/reset-password" className="block text-center text-sm font-semibold text-slate-500 underline-offset-4 hover:underline">
        已有 recovery link？到這裡設定新密碼
      </Link>
    </form>
  )
}
