'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  actionLabel: string
  endpoint: string
  placeholder: string
}

export function BlockTaxonomyCreateForm({ actionLabel, endpoint, placeholder }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? '建立分類失敗。')
      }

      setName('')
      setMessage(payload?.message ?? '已建立分類。')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '建立分類失敗。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4" onSubmit={(event) => void handleSubmit(event)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="lab-input flex-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={placeholder}
        />
        <button type="submit" className="lab-btn-primary whitespace-nowrap" disabled={isSubmitting}>
          {isSubmitting ? '建立中...' : actionLabel}
        </button>
      </div>
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
    </form>
  )
}
