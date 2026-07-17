'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { getPasswordUpdateErrorMessage, validateNewPassword } from '@/lib/auth/password-rules'
import { createClient } from '@/lib/supabase/client'

type PasswordUpdateFormProps = {
  athleteId?: number
  coachId?: number
  forceReset?: boolean
  onSuccess?: () => void
  successMessage: string
  title?: string
  description?: string
  redirectTo?: string
  collapsible?: boolean
  defaultOpen?: boolean
  surface?: 'card' | 'plain'
}

export function PasswordUpdateForm({
  athleteId,
  coachId,
  forceReset = false,
  onSuccess,
  successMessage,
  title = '修改密碼',
  description = '需要時再打開修改。',
  redirectTo,
  collapsible = false,
  defaultOpen = true,
  surface = 'card',
}: PasswordUpdateFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(defaultOpen)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationMessage = validateNewPassword(newPassword, confirmPassword)
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    setIsSubmitting(true)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError('登入狀態已失效，請重新登入。')
      setIsSubmitting(false)
      return
    }

    try {
      const { error: updateUserError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateUserError) {
        setError(getPasswordUpdateErrorMessage(updateUserError))
        setIsSubmitting(false)
        return
      }

      if (forceReset && athleteId) {
        const { error: athleteUpdateError } = await supabase
          .from('athletes')
          .update({ must_change_password: false })
          .eq('id', athleteId)

        if (athleteUpdateError) {
          setError('密碼已更新，但清除臨時密碼狀態失敗。請重新整理或聯絡教練。')
          setIsSubmitting(false)
          return
        }
      }

      if (forceReset && coachId) {
        const { error: coachUpdateError } = await supabase
          .from('coaches')
          .update({ must_change_password: false })
          .eq('id', coachId)

        if (coachUpdateError) {
          setError('密碼已更新，但清除臨時密碼狀態失敗。請重新整理或聯絡總教練。')
          setIsSubmitting(false)
          return
        }
      }

      setSuccess(successMessage)
      setNewPassword('')
      setConfirmPassword('')
      onSuccess?.()

      if (redirectTo) {
        window.setTimeout(() => {
          router.replace(redirectTo)
          router.refresh()
        }, 800)
      }
    } catch (requestError) {
      setError(getPasswordUpdateErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          {surface === 'card' ? <p className="lab-eyebrow">Password</p> : null}
          <h3 className={`${surface === 'card' ? 'mt-3 text-2xl' : 'text-xl'} font-bold text-slate-900`}>{title}</h3>
          <p className={`${surface === 'card' ? 'lab-copy mt-3' : 'mt-2 text-sm leading-7 text-slate-600'}`}>{description}</p>
        </div>
        {collapsible ? (
          <button
            type="button"
            className="lab-btn-secondary !min-h-10 shrink-0 px-4 py-2 text-sm"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
          >
            {isOpen ? '收起' : '展開'}
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="password-new">
              新 Password
            </label>
            <input
              id="password-new"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="lab-input"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="password-confirm">
              確認新 Password
            </label>
            <input
              id="password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="lab-input"
              autoComplete="new-password"
              required
            />
          </div>

          {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

          <button type="submit" disabled={isSubmitting} className="lab-btn-primary w-full disabled:opacity-60">
            {isSubmitting ? '更新中...' : '更新密碼'}
          </button>
        </form>
      ) : null}
    </>
  )

  if (surface === 'plain') {
    return <div>{content}</div>
  }

  return (
    <div className="lab-card p-6 sm:p-7">
      {content}
    </div>
  )
}
