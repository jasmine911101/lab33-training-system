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
