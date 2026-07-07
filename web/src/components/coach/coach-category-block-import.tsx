'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type {
  BlockTemplateRecord,
  ImportedBlockTemplate,
  ImportSkippedBlock,
} from '@/lib/types/block-management'

type ImportPreviewState = {
  totalSheets: number
  importableBlocks: ImportedBlockTemplate[]
  skippedRows: ImportSkippedBlock[]
}

type Props = {
  trainingCategoryId: number
  categoryName: string
}

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

  return (payload ?? {}) as T & { message?: string }
}

export function CoachCategoryBlockImport({ trainingCategoryId, categoryName }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null)
  const [selectedImportBlockCodes, setSelectedImportBlockCodes] = useState<string[]>([])
  const [importDescription, setImportDescription] = useState('由 Excel 多工作表匯入')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  function toggleImportSelection(blockCode: string) {
    setSelectedImportBlockCodes((current) =>
      current.includes(blockCode) ? current.filter((entry) => entry !== blockCode) : [...current, blockCode],
    )
  }

  async function handlePreviewImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsPreviewLoading(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/coach/blocks/import/preview', {
        method: 'POST',
        body: formData,
      })
      const payload = (await response.json().catch(() => null)) as ({ error?: string } & ImportPreviewState) | null

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? 'Excel 預覽失敗。')
      }

      setImportPreview(payload)
      setSelectedImportBlockCodes(payload.importableBlocks.map((block) => block.sheetName))
    } catch (requestError) {
      setImportPreview(null)
      setSelectedImportBlockCodes([])
      setImportError(requestError instanceof Error ? requestError.message : 'Excel 預覽失敗。')
    } finally {
      setIsPreviewLoading(false)
      event.target.value = ''
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return

    const selectedBlocks = importPreview.importableBlocks.filter((block) => selectedImportBlockCodes.includes(block.sheetName))
    if (selectedBlocks.length === 0) {
      setImportError('目前沒有選取任何可匯入的新板塊。')
      return
    }

    setIsImporting(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const payload = await requestJson<{ importedBlocks: BlockTemplateRecord[]; importedCount: number }>(`/api/coach/blocks/import`, {
        method: 'POST',
        body: JSON.stringify({
          selectedBlocks,
          description: importDescription,
          trainingCategoryId,
        }),
      })

      setImportMessage(payload.message ?? `已從 Excel 匯入 ${payload.importedCount} 個板塊。`)
      setImportPreview(null)
      setSelectedImportBlockCodes([])
      router.refresh()
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : 'Excel 匯入失敗。')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <article className="lab-card p-6 sm:p-7">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 text-left"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <div>
          <p className="lab-eyebrow">Excel Import</p>
          <h2 className="lab-section-title mt-3">從 Excel 匯入板塊</h2>
          <p className="lab-copy mt-3">目前匯入的所有板塊會自動歸到「{categoryName}」這個訓練分類。</p>
        </div>
        <span className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm">{isOpen ? '收起' : '展開'}</span>
      </button>

      {isOpen ? (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="lab-copy">支援你目前的 LAB33 板塊模板格式。先上傳 `.xlsx` 讀取預覽，再勾選要匯入的工作表。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="lab-badge bg-orange-100 text-orange-700">自動分類</span>
              <span className="lab-badge-info">只支援 .xlsx</span>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-5">
            <label className="block text-sm font-semibold text-slate-700">上傳板塊 Excel 檔</label>
            <input
              type="file"
              accept=".xlsx"
              className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
              onChange={(event) => void handlePreviewImport(event)}
            />
            <p className="mt-3 text-xs text-slate-500">目前會比對 Block Code，避免把資料庫已存在的板塊重複匯入。</p>
          </div>

          {isPreviewLoading ? <p className="rounded-[1rem] bg-slate-100 px-4 py-3 text-sm text-slate-700">Excel 解析中...</p> : null}
          {importError ? <p className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{importError}</p> : null}
          {importMessage ? <p className="rounded-[1rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importMessage}</p> : null}

          {importPreview ? (
            <div className="space-y-5">
              <div className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">匯入預覽</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      已讀取 {importPreview.totalSheets} 個工作表，可匯入 {importPreview.importableBlocks.length} 個板塊。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                      onClick={() => setSelectedImportBlockCodes(importPreview.importableBlocks.map((block) => block.sheetName))}
                    >
                      全選
                    </button>
                    <button
                      type="button"
                      className="lab-btn-secondary !min-h-10 px-4 py-2 text-sm"
                      onClick={() => setSelectedImportBlockCodes([])}
                    >
                      全不選
                    </button>
                    <span className="lab-badge-primary">{selectedImportBlockCodes.length} 個已選取</span>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-[1.25rem] border border-slate-200">
                  <table className="min-w-[860px] w-full border-collapse text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        {['匯入', 'Block Code', '顯示名稱', '週期目標', '訓練元素', '區段數', '動作數'].map((label) => (
                          <th key={label} className="border-b border-slate-200 px-3 py-3 font-semibold">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.importableBlocks.map((block) => (
                        <tr key={block.sheetName}>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedImportBlockCodes.includes(block.sheetName)}
                              onChange={() => toggleImportSelection(block.sheetName)}
                            />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">{block.sheetName}</td>
                          <td className="border-b border-slate-100 px-3 py-3">{block.blockName}</td>
                          <td className="border-b border-slate-100 px-3 py-3">{block.goal || '-'}</td>
                          <td className="border-b border-slate-100 px-3 py-3">{block.trainingElement || '-'}</td>
                          <td className="border-b border-slate-100 px-3 py-3">{block.sections.length}</td>
                          <td className="border-b border-slate-100 px-3 py-3">{block.exerciseCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importPreview.skippedRows.length > 0 ? (
                  <div className="mt-5">
                    <h4 className="text-base font-bold text-slate-900">以下板塊會跳過</h4>
                    <div className="mt-3 overflow-x-auto rounded-[1.25rem] border border-amber-200">
                      <table className="min-w-[640px] w-full border-collapse text-sm">
                        <thead className="bg-amber-50 text-left text-amber-800">
                          <tr>
                            {['Block Code', '顯示名稱', '跳過原因'].map((label) => (
                              <th key={label} className="border-b border-amber-200 px-3 py-3 font-semibold">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.skippedRows.map((row) => (
                            <tr key={`${row.blockCode}-${row.reason}`}>
                              <td className="border-b border-amber-100 px-3 py-3 font-semibold text-slate-900">{row.blockCode}</td>
                              <td className="border-b border-amber-100 px-3 py-3">{row.blockName}</td>
                              <td className="border-b border-amber-100 px-3 py-3">{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">描述</label>
                  <textarea className="lab-input min-h-24" value={importDescription} onChange={(event) => setImportDescription(event.target.value)} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className="lab-btn-primary" disabled={isImporting} onClick={() => void handleConfirmImport()}>
                    {isImporting ? '匯入中...' : `確認匯入選取的 ${selectedImportBlockCodes.length} 個板塊`}
                  </button>
                  <button
                    type="button"
                    className="lab-btn-secondary"
                    onClick={() => {
                      setImportPreview(null)
                      setSelectedImportBlockCodes([])
                    }}
                  >
                    清除預覽
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
