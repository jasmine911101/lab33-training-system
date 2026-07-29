export const PASSWORD_CHANGE_REQUIRED_CODE = 'password-change-required'

type PasswordGateContext = {
  coachProfile: { must_change_password: boolean | null } | null
  isGoogleSession: boolean
  studentProfile: { must_change_password: boolean | null } | null
}

export function requiresPasswordChange(context: PasswordGateContext) {
  return Boolean(
    context.coachProfile?.must_change_password || context.studentProfile?.must_change_password,
  ) && !context.isGoogleSession
}

export function passwordChangeRequiredError() {
  return {
    code: PASSWORD_CHANGE_REQUIRED_CODE,
    error: '請先設定新密碼，才能繼續使用系統。',
  }
}
