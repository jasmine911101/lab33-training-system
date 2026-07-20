'use client'

import { useMemo, useState } from 'react'

import type { ProductBlockMutationPayload, ProductBlockOption, ProductMutationPayload, TrainingProductRecord, TrainingProductVersionRecord } from '@/lib/types/commerce'
import type { TeamEnrollmentRecord, TeamOption } from '@/lib/types/team-programs'
import { PRODUCT_CURRENCIES } from '@/lib/types/commerce'

type ProductManagementPanelProps = {
  initialProducts: TrainingProductRecord[]
  blockOptions: ProductBlockOption[]
  teamOptions: TeamOption[]
  isHeadCoach: boolean
}

type ProductDraft = {
  name: string
  description: string
  coverImageUrl: string
  price: string
  currency: string
  isActive: boolean
  blocks: ProductBlockDraft[]
}

type ProductBlockDraft = {
  blockId: number
  weekNumber: string
  dayNumber: string
}

type TeamAssignmentDraft = {
  productName: string
  versionId: number
  versionNumber: number
  teamId: string
  startDate: string
  endDate: string
  seatLimit: string
  timezone: string
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? '商品操作失敗。')
  }
  return payload as T
}

function centsToPrice(cents: number) {
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

function priceToCents(price: string) {
  const amount = Number(price)
  if (!Number.isFinite(amount) || amount < 0) return 0
  return Math.round(amount * 100)
}

function formatPrice(priceAmount: number, currency: string) {
  return `${currency} ${centsToPrice(priceAmount)}`
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function blockLabel(block: ProductBlockOption | { block_code: string | null; block_name: string | null }) {
  const code = block.block_code || '無代號'
  const name = block.block_name || '未命名板塊'
  return `${code} | ${name}`
}

function productStatusClass(status: TrainingProductRecord['status']) {
  if (status === 'published') return 'lab-badge-success'
  if (status === 'archived') return 'lab-badge bg-slate-100 text-slate-600'
  return 'lab-badge-warning'
}

function versionStatusClass(status: TrainingProductVersionRecord['status']) {
  if (status === 'published') return 'lab-badge-success'
  if (status === 'retired') return 'lab-badge bg-slate-100 text-slate-600'
  return 'lab-badge-warning'
}

function createEmptyDraft(): ProductDraft {
  return {
    name: '',
    description: '',
    coverImageUrl: '',
    price: '0',
    currency: 'TWD',
    isActive: true,
    blocks: [],
  }
}

function draftFromVersion(product: TrainingProductRecord, version: TrainingProductVersionRecord): ProductDraft {
  return {
    name: version.snapshot_name,
    description: version.snapshot_description ?? '',
    coverImageUrl: product.cover_image_url ?? '',
    price: centsToPrice(version.snapshot_price_amount),
    currency: version.snapshot_currency,
    isActive: product.is_active,
    blocks: version.blocks.map((block) => ({
      blockId: block.block_id,
      weekNumber: block.week_number == null ? '' : String(block.week_number),
      dayNumber: block.day_number == null ? '' : String(block.day_number),
    })),
  }
}

function blockDraftToPayload(blocks: ProductBlockDraft[]): ProductBlockMutationPayload[] {
  return blocks.map((block, index) => ({
    blockId: block.blockId,
    weekNumber: block.weekNumber ? Number(block.weekNumber) : null,
    dayNumber: block.dayNumber ? Number(block.dayNumber) : null,
    sortOrder: index,
  }))
}

function toPayload(draft: ProductDraft): ProductMutationPayload {
  return {
    name: draft.name,
    description: draft.description,
    coverImageUrl: draft.coverImageUrl || null,
    priceAmount: priceToCents(draft.price),
    currency: draft.currency.trim().toUpperCase() || 'TWD',
    isActive: draft.isActive,
    blocks: blockDraftToPayload(draft.blocks),
  }
}

function ProductEditor({
  draft,
  setDraft,
  blockOptions,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: ProductDraft
  setDraft: (draft: ProductDraft) => void
  blockOptions: ProductBlockOption[]
  saving: boolean
  submitLabel: string
  onSubmit: () => void
  onCancel?: () => void
}) {
  const selectedBlockIds = draft.blocks.map((block) => block.blockId)
  const selectedBlocks = draft.blocks
    .map((entry) => ({ entry, block: blockOptions.find((block) => block.id === entry.blockId) }))
    .filter((entry): entry is { entry: ProductBlockDraft; block: ProductBlockOption } => Boolean(entry.block))
  const availableBlocks = blockOptions.filter((block) => !selectedBlockIds.includes(block.id))
  const [selectedBlockId, setSelectedBlockId] = useState('')

  function updateField<Key extends keyof ProductDraft>(key: Key, value: ProductDraft[Key]) {
    setDraft({ ...draft, [key]: value })
  }

  function addBlock() {
    const blockId = Number(selectedBlockId)
    if (!Number.isFinite(blockId) || selectedBlockIds.includes(blockId)) return
    updateField('blocks', [...draft.blocks, { blockId, weekNumber: '', dayNumber: '' }])
    setSelectedBlockId('')
  }

  function removeBlock(blockId: number) {
    updateField('blocks', draft.blocks.filter((block) => block.blockId !== blockId))
  }

  function updateBlock(blockId: number, key: 'weekNumber' | 'dayNumber', value: string) {
    updateField('blocks', draft.blocks.map((block) => block.blockId === blockId ? { ...block, [key]: value } : block))
  }

  function moveBlock(blockId: number, direction: -1 | 1) {
    const index = draft.blocks.findIndex((block) => block.blockId === blockId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= draft.blocks.length) return
    const next = [...draft.blocks]
    const [item] = next.splice(index, 1)
    next.splice(nextIndex, 0, item)
    updateField('blocks', next)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">商品名稱</label>
          <input className="lab-input" value={draft.name} onChange={(event) => updateField('name', event.target.value)} placeholder="例如：八週爆發力訓練課程" />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">售價</label>
            <input className="lab-input" type="number" min="0" step="0.01" value={draft.price} onChange={(event) => updateField('price', event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">幣別</label>
            <select className="lab-input" value={draft.currency} onChange={(event) => updateField('currency', event.target.value)}>
              {PRODUCT_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_10rem]">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">封面圖片 URL（預留）</label>
          <input className="lab-input" value={draft.coverImageUrl} onChange={(event) => updateField('coverImageUrl', event.target.value)} placeholder="https://..." />
        </div>
        <label className="mt-8 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={draft.isActive} onChange={(event) => updateField('isActive', event.target.checked)} />
          啟用商品
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">描述</label>
        <textarea className="lab-input min-h-28" value={draft.description} onChange={(event) => updateField('description', event.target.value)} placeholder="介紹這個商品適合誰、週期目標、訓練重點。" />
      </div>

      <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold text-slate-700">加入 Block</label>
            <select className="lab-input" value={selectedBlockId} onChange={(event) => setSelectedBlockId(event.target.value)}>
              <option value="">選擇要加入商品版本的 Block</option>
              {availableBlocks.map((block) => <option key={block.id} value={block.id}>{blockLabel(block)}</option>)}
            </select>
          </div>
          <button type="button" className="lab-btn-secondary" onClick={addBlock} disabled={!selectedBlockId}>新增 Block</button>
        </div>

        <div className="mt-4 space-y-2">
          {selectedBlocks.length === 0 ? (
            <div className="rounded-[1rem] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">這個 draft version 尚未加入任何 Block。Publish 前至少需要 1 個 Block。</div>
          ) : selectedBlocks.map(({ entry, block }, index) => (
            <div key={block.id} className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">#{index + 1}</p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900">{blockLabel(block)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input className="lab-input !min-h-9 w-24 px-3 py-1 text-xs" type="number" min="1" placeholder="Week" value={entry.weekNumber} onChange={(event) => updateBlock(block.id, 'weekNumber', event.target.value)} />
                  <input className="lab-input !min-h-9 w-24 px-3 py-1 text-xs" type="number" min="1" placeholder="Day" value={entry.dayNumber} onChange={(event) => updateBlock(block.id, 'dayNumber', event.target.value)} />
                  <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => moveBlock(block.id, -1)} disabled={index === 0}>上移</button>
                  <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs" onClick={() => moveBlock(block.id, 1)} disabled={index === selectedBlocks.length - 1}>下移</button>
                  <button type="button" className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs !text-rose-600" onClick={() => removeBlock(block.id)}>移除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="lab-btn-primary" onClick={onSubmit} disabled={saving}>{saving ? '儲存中...' : submitLabel}</button>
        {onCancel ? <button type="button" className="lab-btn-secondary" onClick={onCancel} disabled={saving}>取消</button> : null}
      </div>
    </div>
  )
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function ProductManagementPanel({ initialProducts, blockOptions, teamOptions, isHeadCoach }: ProductManagementPanelProps) {
  const [products, setProducts] = useState(initialProducts)
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<ProductDraft>(createEmptyDraft())
  const [editingVersionId, setEditingVersionId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState<ProductDraft | null>(null)
  const [teamAssignment, setTeamAssignment] = useState<TeamAssignmentDraft | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stats = useMemo(() => ({
    total: products.length,
    published: products.filter((product) => product.status === 'published').length,
    draft: products.filter((product) => product.status === 'draft').length,
    archived: products.filter((product) => product.status === 'archived').length,
  }), [products])

  function replaceProduct(nextProduct: TrainingProductRecord) {
    setProducts((current) => current.map((product) => product.id === nextProduct.id ? nextProduct : product))
  }

  async function createProduct() {
    setMessage(null)
    setError(null)
    setSavingKey('create')
    try {
      const payload = await requestJson<{ product: TrainingProductRecord; message?: string }>('/api/coach/products', {
        method: 'POST',
        body: JSON.stringify(toPayload(createDraft)),
      })
      setProducts((current) => [payload.product, ...current])
      setCreateDraft(createEmptyDraft())
      setCreateOpen(false)
      setMessage(payload.message ?? '已建立商品。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '建立商品失敗。')
    } finally {
      setSavingKey(null)
    }
  }

  function startEdit(product: TrainingProductRecord, version: TrainingProductVersionRecord) {
    setEditingVersionId(version.id)
    setEditingDraft(draftFromVersion(product, version))
    setMessage(null)
    setError(null)
  }

  async function saveVersion(productId: number, versionId: number) {
    if (!editingDraft) return
    setMessage(null)
    setError(null)
    setSavingKey(`edit:${versionId}`)
    try {
      const payload = await requestJson<{ product: TrainingProductRecord; message?: string }>(`/api/coach/products/${productId}/versions/${versionId}`, {
        method: 'PATCH',
        body: JSON.stringify(toPayload(editingDraft)),
      })
      replaceProduct(payload.product)
      setEditingVersionId(null)
      setEditingDraft(null)
      setMessage(payload.message ?? '已更新 draft version。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新 draft version 失敗。')
    } finally {
      setSavingKey(null)
    }
  }

  async function productAction(productId: number, action: 'versions' | 'publish' | 'unpublish' | 'archive', versionId?: number) {
    setMessage(null)
    setError(null)
    setSavingKey(`${action}:${productId}`)
    try {
      const payload = await requestJson<{ product: TrainingProductRecord; message?: string }>(`/api/coach/products/${productId}/${action}`, {
        method: 'POST',
        body: action === 'publish' ? JSON.stringify({ versionId }) : JSON.stringify({}),
      })
      replaceProduct(payload.product)
      setMessage(payload.message ?? '商品操作完成。')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '商品操作失敗。')
    } finally {
      setSavingKey(null)
    }
  }

  async function assignToTeam() {
    if (!teamAssignment) return
    setMessage(null)
    setError(null)
    setSavingKey(`assign:${teamAssignment.versionId}`)
    try {
      const payload = await requestJson<{ enrollment: TeamEnrollmentRecord; message?: string }>('/api/coach/team-product-enrollments', {
        method: 'POST',
        body: JSON.stringify({
          teamId: Number(teamAssignment.teamId),
          productVersionId: teamAssignment.versionId,
          startDate: teamAssignment.startDate,
          endDate: teamAssignment.endDate || null,
          seatLimit: teamAssignment.seatLimit ? Number(teamAssignment.seatLimit) : null,
          timezone: teamAssignment.timezone,
        }),
      })
      setTeamAssignment(null)
      setMessage(payload.message ?? `已指派給 ${payload.enrollment.team_name}。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '指派給球隊失敗。')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <section className="space-y-6">
      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="lab-eyebrow">Commerce V1.1</p>
            <h2 className="lab-section-title mt-3">Product Management</h2>
            <p className="lab-copy mt-3">
              Product 是商品，Version 是可發布的內容快照。Published version 只讀；要修改已發布商品時，請先建立新的 draft version。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="lab-badge-primary">{stats.total} 個商品</span>
            <span className="lab-badge-success">{stats.published} Published</span>
            <span className="lab-badge-warning">{stats.draft} Draft</span>
            <span className="lab-badge bg-slate-100 text-slate-600">{stats.archived} Archived</span>
          </div>
        </div>
      </article>

      <article className="lab-card p-6 sm:p-7">
        <button type="button" className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setCreateOpen((current) => !current)} aria-expanded={createOpen}>
          <div>
            <p className="lab-eyebrow">New Product</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">建立商品</h3>
          </div>
          <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{createOpen ? '收起' : '展開'}</span>
        </button>
        {createOpen ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ProductEditor draft={createDraft} setDraft={setCreateDraft} blockOptions={blockOptions} saving={savingKey === 'create'} submitLabel="建立商品與 Draft V1" onSubmit={() => void createProduct()} />
          </div>
        ) : null}
      </article>

      {message ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <article className="lab-card p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="lab-eyebrow">Product List</p>
            <h3 className="lab-section-title mt-3">商品列表</h3>
          </div>
          <span className="lab-badge-primary">{products.length} items</span>
        </div>

        {products.length === 0 ? (
          <div className="lab-card-muted mt-6 px-5 py-6 text-sm text-slate-600">目前還沒有商品。先建立 Draft，再加入 Block。</div>
        ) : (
          <div className="mt-6 space-y-4">
            {products.map((product) => {
              const draftVersion = product.currentDraftVersion
              const publishedVersion = product.currentPublishedVersion
              const isArchived = product.status === 'archived'
              const isEditing = draftVersion ? editingVersionId === draftVersion.id : false
              return (
                <div key={product.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={productStatusClass(product.status)}>{product.status.toUpperCase()}</span>
                        {publishedVersion ? <span className="lab-badge-success">Published V{publishedVersion.version_number}</span> : <span className="lab-badge bg-slate-100 text-slate-600">No published version</span>}
                        {draftVersion ? <span className="lab-badge-warning">Draft V{draftVersion.version_number}</span> : null}
                        {draftVersion && publishedVersion ? <span className="lab-badge-warning">Unpublished changes</span> : null}
                        {isHeadCoach ? <span className="lab-badge bg-slate-100 text-slate-600">作者：{product.author_name ?? product.author_email ?? '-'}</span> : null}
                      </div>
                      <h4 className="mt-3 text-2xl font-bold text-slate-900">{product.name}</h4>
                      <p className="lab-copy mt-2 whitespace-pre-wrap">{product.description || '尚未填寫商品描述。'}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                        <span className="lab-badge-primary">{formatPrice(product.price_amount, product.currency)}</span>
                        <span className="lab-badge bg-slate-100 text-slate-600">Published：{formatDate(product.published_at)}</span>
                        <span className="lab-badge bg-slate-100 text-slate-600">更新：{formatDate(product.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {draftVersion ? (
                        <button
                          type="button"
                          className="lab-btn-secondary"
                          onClick={() => {
                            if (isEditing) {
                              setEditingVersionId(null)
                              setEditingDraft(null)
                              return
                            }
                            startEdit(product, draftVersion)
                          }}
                        >
                          {isEditing ? '取消編輯' : '編輯 Draft'}
                        </button>
                      ) : null}
                      {!draftVersion && publishedVersion && !isArchived ? <button type="button" className="lab-btn-secondary" onClick={() => void productAction(product.id, 'versions')} disabled={savingKey === `versions:${product.id}`}>建立新 Draft</button> : null}
                      {draftVersion && !isArchived ? <button type="button" className="lab-btn-primary" onClick={() => void productAction(product.id, 'publish', draftVersion.id)} disabled={savingKey === `publish:${product.id}`}>Publish Draft</button> : null}
                      {product.status === 'published' ? <button type="button" className="lab-btn-secondary" onClick={() => void productAction(product.id, 'unpublish')} disabled={savingKey === `unpublish:${product.id}`}>Unpublish</button> : null}
                      {!isArchived ? <button type="button" className="lab-btn-secondary !text-rose-600" onClick={() => { if (window.confirm('確定要封存此商品？封存後會保留歷史版本，但商品不可再編輯。')) void productAction(product.id, 'archive') }} disabled={savingKey === `archive:${product.id}`}>Archive</button> : null}
                    </div>
                  </div>

                  {draftVersion ? (
                    <div className="mt-5 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Draft V{draftVersion.version_number} 可編輯。Published version is read-only。
                    </div>
                  ) : null}

                  {publishedVersion ? (
                    <div className="mt-5 rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <span className={versionStatusClass(publishedVersion.status)}>V{publishedVersion.version_number} {publishedVersion.status}</span>
                          <span className="ml-2">{publishedVersion.blocks.length} Blocks · {formatPrice(publishedVersion.snapshot_price_amount, publishedVersion.snapshot_currency)}</span>
                        </div>
                        <button
                          type="button"
                          className="lab-btn-secondary !min-h-9 px-3 py-1 text-xs"
                          onClick={() => setTeamAssignment({
                            productName: product.name,
                            versionId: publishedVersion.id,
                            versionNumber: publishedVersion.version_number,
                            teamId: teamOptions[0]?.id ? String(teamOptions[0].id) : '',
                            startDate: todayInputValue(),
                            endDate: '',
                            seatLimit: '',
                            timezone: 'Asia/Taipei',
                          })}
                          disabled={teamOptions.length === 0}
                        >
                          指派給球隊
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isEditing && draftVersion && editingDraft ? (
                    <div className="mt-6 border-t border-slate-200 pt-6">
                      <ProductEditor draft={editingDraft} setDraft={setEditingDraft} blockOptions={blockOptions} saving={savingKey === `edit:${draftVersion.id}`} submitLabel="儲存 Draft" onSubmit={() => void saveVersion(product.id, draftVersion.id)} onCancel={() => { setEditingVersionId(null); setEditingDraft(null) }} />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </article>

      {teamAssignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4" onClick={() => setTeamAssignment(null)}>
          <div className="w-full max-w-xl rounded-[1.5rem] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <p className="lab-eyebrow">Team Delivery</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">指派給球隊</h3>
            <p className="lab-copy mt-2">{teamAssignment.productName} · Published V{teamAssignment.versionNumber}</p>
            <div className="mt-5 grid gap-4">
              <label className="space-y-2 text-sm font-semibold text-slate-700">Team
                <select className="lab-input" value={teamAssignment.teamId} onChange={(event) => setTeamAssignment({ ...teamAssignment, teamId: event.target.value })}>
                  {teamOptions.length === 0 ? <option value="">目前沒有可管理 Team</option> : teamOptions.map((team) => <option key={team.id} value={team.id}>{team.name} · roster {team.activeRosterCount} · seat {team.activeSeatLimit ?? '不限'}</option>)}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-700">Start Date<input className="lab-input" type="date" value={teamAssignment.startDate} onChange={(event) => setTeamAssignment({ ...teamAssignment, startDate: event.target.value })} /></label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">End Date optional<input className="lab-input" type="date" value={teamAssignment.endDate} onChange={(event) => setTeamAssignment({ ...teamAssignment, endDate: event.target.value })} /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-700">Seat Limit optional<input className="lab-input" type="number" min="1" value={teamAssignment.seatLimit} onChange={(event) => setTeamAssignment({ ...teamAssignment, seatLimit: event.target.value })} /></label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">Timezone<input className="lab-input" value={teamAssignment.timezone} onChange={(event) => setTeamAssignment({ ...teamAssignment, timezone: event.target.value })} /></label>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="lab-btn-primary" onClick={() => void assignToTeam()} disabled={!teamAssignment.teamId || savingKey === `assign:${teamAssignment.versionId}`}>{savingKey === `assign:${teamAssignment.versionId}` ? '指派中...' : '確認指派'}</button>
              <button type="button" className="lab-btn-secondary" onClick={() => setTeamAssignment(null)}>取消</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
