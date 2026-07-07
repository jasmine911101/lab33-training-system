type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

function stringifyError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function describeBlockTaxonomyError(error: unknown) {
  const maybeError = error as SupabaseLikeError | null | undefined
  const code = maybeError?.code
  const message = maybeError?.message ?? stringifyError(error)

  if (code === '42501') {
    return {
      title: '板塊分類資料目前沒有讀取權限',
      description:
        '目前 taxonomy 新表已存在，但執行中的 Next.js 環境沒有成功使用 server-side service role 讀取，或這三張新表尚未開放目前角色讀取。\n\n請先確認：\n1. 部署環境已設定 SUPABASE_SERVICE_ROLE_KEY\n2. server 端已重新部署\n3. 若刻意不使用 service role，則需另外設定這三張表的讀取權限',
    }
  }

  if (code === '42P01') {
    return {
      title: '找不到板塊分類資料表',
      description:
        '目前執行環境查詢不到新的 taxonomy table。通常代表 migration 還沒套用到目前這個 Supabase 專案，或部署使用的是另一個專案。',
    }
  }

  if (code === '42703') {
    return {
      title: '板塊分類欄位尚未建立',
      description:
        '目前資料庫缺少 taxonomy 需要的欄位，通常代表 migration 沒有完整套用到目前執行中的資料庫。',
    }
  }

  return {
    title: '板塊分類頁面載入失敗',
    description: `Supabase 回傳錯誤：${message}${code ? `\n\n錯誤代碼：${code}` : ''}`,
  }
}
