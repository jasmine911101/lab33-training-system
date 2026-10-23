export const MIN_PASSWORD_LENGTH = 8

export function validateNewPassword(newPassword: string, confirmPassword: string) {
  // 依序檢查：有沒有填 → 長度 → 兩次是否一致。
  // 同時有多個問題時，仍然只回傳原本順序中的第一個錯誤。
  if (!newPassword) {
    return '請輸入新 Password。'
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Password 至少需要 ${MIN_PASSWORD_LENGTH} 碼。`
  }
  if (newPassword !== confirmPassword) {
    return '兩次輸入的 Password 不一致。'
  }
  // null 代表這些檢查都通過，沒有錯誤訊息。
  return null
}

export function getPasswordUpdateErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '更新密碼失敗，請稍後再試。'
  }

  // as 只告訴 TypeScript 預期的欄位，不會改變 error 的實際內容。
  // ?. 表示欄位有值才呼叫方法；?? 表示沒值時使用右邊的預設值。
  const passwordError = error as { status?: number; code?: string; message?: string }
  const code = passwordError.code?.toLowerCase() ?? ''
  const message = passwordError.message?.toLowerCase() ?? ''

  // 保留每個條件的先後順序，以及符合條件後就立即回傳的行為。
  if (
    passwordError.status === 401
    || message.includes('jwt')
    || message.includes('session')
    || message.includes('not authenticated')
  ) {
    return '登入狀態已失效，請重新登入。'
  }

  if (message.includes('same') || message.includes('different') || message.includes('new password should be different')) {
    return '新密碼不可與目前密碼相同。'
  }

  if (message.includes('weak') || message.includes('short') || code.includes('weak_password')) {
    return `新密碼至少 ${MIN_PASSWORD_LENGTH} 個字元。`
  }

  if (message.includes('rate limit')) {
    return '操作太頻繁，請稍後再試。'
  }

  return '更新密碼失敗，請稍後再試。'
}
