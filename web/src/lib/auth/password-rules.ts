export const MIN_PASSWORD_LENGTH = 8

export function validateNewPassword(newPassword: string, confirmPassword: string) {
  if (!newPassword) {
    return '請輸入新 Password。'
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Password 至少需要 ${MIN_PASSWORD_LENGTH} 碼。`
  }
  if (newPassword !== confirmPassword) {
    return '兩次輸入的 Password 不一致。'
  }
  return null
}

export function getPasswordUpdateErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '更新密碼失敗，請稍後再試。'
  }

  const maybeError = error as { status?: number; code?: string; message?: string }
  const code = maybeError.code?.toLowerCase() ?? ''
  const message = maybeError.message?.toLowerCase() ?? ''

  if (maybeError.status === 401 || message.includes('jwt') || message.includes('session') || message.includes('not authenticated')) {
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
