'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null
  if (!response.ok) {
    throw new Error(payload?.error ?? '操作失敗，請稍後再試。')
  }

  return payload as T
}

type CoachRegistrationFormProps = {
  headCoachRegistrationCodeConfigured: boolean
  serviceRoleConfigured: boolean
}

export function CoachRegistrationForm({ headCoachRegistrationCodeConfigured, serviceRoleConfigured }: CoachRegistrationFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!headCoachRegistrationCodeConfigured) {
    return <p className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm text-slate-700">目前未開放總教練註冊。請先設定 `HEAD_COACH_REGISTRATION_CODE`。</p>
  }

  if (!serviceRoleConfigured) {
    return <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">尚未設定 `SUPABASE_SERVICE_ROLE_KEY`，目前無法建立教練帳號。</p>
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await requestJson<{ email: string }>('/api/auth/coach/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
          registrationCode,
        }),
      })

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        throw new Error(signInError.message)
      }

      router.replace('/coach')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '註冊失敗。')
      setIsSubmitting(false)
      return
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lab-card space-y-5 p-6 sm:p-7">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="coach-register-name">姓名</label>
        <input id="coach-register-name" value={name} onChange={(event) => setName(event.target.value)} className="lab-input" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="coach-register-email">Email</label>
        <input id="coach-register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="lab-input" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="coach-register-password">Password</label>
        <input id="coach-register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="lab-input" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="coach-register-confirm-password">確認 Password</label>
        <input id="coach-register-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="lab-input" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="coach-register-code">總教練註冊碼</label>
        <input id="coach-register-code" type="password" value={registrationCode} onChange={(event) => setRegistrationCode(event.target.value)} className="lab-input" required />
      </div>
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <button type="submit" disabled={isSubmitting} className="lab-btn-primary w-full disabled:opacity-60">
        {isSubmitting ? '建立中...' : '註冊總教練帳號'}
      </button>
    </form>
  )
}
