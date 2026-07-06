'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

type LoginFormProps = {
  mode: 'coach' | 'student'
}

export function LoginForm({ mode }: LoginFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
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
      <button type="submit" disabled={isSubmitting} className="lab-btn-primary w-full disabled:opacity-60">
        {isSubmitting ? '登入中...' : '登入'}
      </button>
      {mode === 'student' ? (
        <div className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm leading-7 text-slate-600">
          如果忘記密碼，請聯絡教練幫你重設臨時密碼。教練重設後，你可以用臨時密碼登入，系統會要求你立刻設定新密碼。
        </div>
      ) : null}
      <Link href="/recover" className="block text-center text-sm font-semibold text-slate-500 underline-offset-4 hover:underline">
        已有 recovery link？到這裡設定新密碼
      </Link>
    </form>
  )
}
