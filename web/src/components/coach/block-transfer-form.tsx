'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { BlockTemplateRecord } from '@/lib/types/block-management'
import type { BlockTransferOptions, BlockTransferResult } from '@/lib/types/block-transfer'

type Props = {
  block: BlockTemplateRecord
  mode: 'move' | 'copy'
  onCancel: () => void
  onSuccess: (result: BlockTransferResult) => void
}

export function BlockTransferForm({ block, mode, onCancel, onSuccess }: Props) {
  const [options, setOptions] = useState<BlockTransferOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [sportId, setSportId] = useState('')
  const [ageGroupId, setAgeGroupId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [blockCode, setBlockCode] = useState(`${block.block_code || 'BLOCK'}-COPY`)
  const [blockName, setBlockName] = useState(`${block.block_name || '板塊'}（副本）`)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const action = mode === 'move' ? '移動' : '複製'

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadOptions() {
      setLoading(true)
      setLoadError('')
      try {
        const response = await fetch('/api/coach/blocks/transfer-options', { signal: controller.signal, cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || '無法載入分類。')
        }
        if (!controller.signal.aborted) {
          setOptions(payload)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          let message = '無法載入分類。'
          if (error instanceof Error) {
            message = error.message
          }
          setLoadError(message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }
    void loadOptions()
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (error) {
      errorRef.current?.focus()
    }
  }, [error])

  // 只顯示上層仍啟用的分類；後端會再次確認，不能只靠下拉選單驗證。
  const ageGroups = options?.ageGroups.filter((entry) => entry.sport_id === Number(sportId)) ?? []
  const categories = options?.trainingCategories.filter((entry) =>
    entry.age_group_id === Number(ageGroupId) && entry.id !== block.training_category_id) ?? []
  // 依序確認分類、年齡層及運動項目，找到第一個有效目的地就停止。
  let hasDestination = false
  if (options) {
    hasDestination = options.trainingCategories.some((category) => {
      if (category.id === block.training_category_id) {
        return false
      }
      return options.ageGroups.some((ageGroup) => {
        if (ageGroup.id !== category.age_group_id) {
          return false
        }
        return options.sports.some((sport) => sport.id === ageGroup.sport_id)
      })
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) {
      return
    }
    setError('')
    if (!categoryId) {
      setError('請先選擇目標訓練分類。')
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const response = await fetch(`/api/coach/blocks/${block.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, trainingCategoryId: Number(categoryId), blockCode, blockName }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || `${action}失敗，請稍後再試。`)
      }
      onSuccess(result)
    } catch (error) {
      setError(error instanceof Error ? error.message : `${action}失敗，請稍後再試。`)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} aria-label={`${action}板塊`} aria-busy={pending}
      className="space-y-5 border-t border-orange-100 bg-orange-50/50 p-4 sm:p-5">
      <div>
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold text-slate-900">{action}板塊到其他分類</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {mode === 'move' ? '原分類將不再顯示這個板塊，內容與既有課表保持不變。' : '複製所有區段、動作與備註，建立可獨立編輯的副本。原板塊及既有課表保持不變。'}
        </p>
      </div>
      {loading ? <p role="status" className="text-sm text-slate-600">載入分類中…</p> : loadError ? (
        <div role="alert" className="space-y-3 text-sm text-rose-700">
          <p>{loadError}</p>
          <button type="button" className="lab-btn-secondary" onClick={() => setAttempt((value) => value + 1)}>重新載入分類</button>
        </div>
      ) : !hasDestination ? <p role="status" className="text-sm text-slate-600">目前沒有其他可用分類，請先到板塊分類管理建立目標分類。</p> : (
        <>
          <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-3">
            <legend className="sr-only">目標分類</legend>
            <label className="min-w-0 space-y-2 text-sm font-semibold text-slate-700">運動項目
              <select name="sport" className="lab-input bg-white text-slate-900" required value={sportId}
                onChange={(event) => {
                  setSportId(event.target.value)
                  // 上層選項改變後，重新選擇下層分類，避免沿用舊值。
                  setAgeGroupId('')
                  setCategoryId('')
                }}>
                <option value="">選擇運動項目</option>
                {options?.sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-2 text-sm font-semibold text-slate-700">年齡層
              <select name="ageGroup" className="lab-input bg-white text-slate-900" required disabled={!sportId} value={ageGroupId}
                onChange={(event) => {
                  setAgeGroupId(event.target.value)
                  setCategoryId('')
                }}>
                <option value="">{sportId && ageGroups.length === 0 ? '此項目尚無年齡層' : '選擇年齡層'}</option>
                {ageGroups.map((age) => <option key={age.id} value={age.id}>{age.name}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-2 text-sm font-semibold text-slate-700">訓練分類
              <select name="trainingCategory" className="lab-input bg-white text-slate-900" required disabled={!ageGroupId} value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{ageGroupId && categories.length === 0 ? '此年齡層尚無其他分類' : '選擇目標分類'}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          </fieldset>
          {mode === 'copy' ? (
            <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <legend className="sr-only">副本資料</legend>
              <label className="space-y-2 text-sm font-semibold text-slate-700">副本代碼
                <input name="blockCode" autoComplete="off" spellCheck={false} className="lab-input" required value={blockCode} onChange={(event) => setBlockCode(event.target.value)} />
              </label>
              <label className="space-y-2 text-sm font-semibold text-slate-700">副本名稱
                <input name="blockName" autoComplete="off" className="lab-input" required value={blockName} onChange={(event) => setBlockName(event.target.value)} />
              </label>
              <p className="text-xs leading-6 text-slate-500 sm:col-span-2">代碼與名稱都必須與既有板塊不同。</p>
            </fieldset>
          ) : null}
          {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 focus-visible:outline-2">{error}</p> : null}
          <button type="submit" className="lab-btn-primary" disabled={pending}>{pending ? `${action}中…` : `確認${action}`}</button>
        </>
      )}
      <button type="button" className="lab-btn-secondary ml-2" disabled={pending} onClick={onCancel}>取消</button>
    </form>
  )
}
