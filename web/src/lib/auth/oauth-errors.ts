export type OAuthErrorCode =
  | 'missing-email'
  | 'email-not-verified'
  | 'not-registered'
  | 'role-conflict'
  | 'coach-user-conflict'
  | 'athlete-user-conflict'
  | 'binding-unavailable'
  | 'callback-failed'

export function getOAuthErrorMessage(code?: string | null) {
  switch (code) {
    case 'missing-email':
      return 'Google 沒有回傳可用的 Email，請改用其他帳號，或聯繫管理員協助確認。'
    case 'email-not-verified':
      return '這個 Google 帳號的 Email 尚未驗證，暫時無法登入 LAB33。'
    case 'not-registered':
      return '此 Google 帳號尚未加入 LAB33，請確認登入 Email，或聯絡教練／系統管理員。'
    case 'role-conflict':
      return '這個 Email 同時存在於教練與學員資料中，系統無法安全自動分流，請聯絡管理員處理資料衝突。'
    case 'coach-user-conflict':
      return '這個教練資料已經綁定到另一個登入帳號，系統已拒絕覆寫，請聯絡管理員。'
    case 'athlete-user-conflict':
      return '這個學員資料已經綁定到另一個登入帳號，系統已拒絕覆寫，請聯絡管理員。'
    case 'binding-unavailable':
      return '目前伺服器尚未完成 Google 綁定設定，暫時無法登入，請聯絡管理員。'
    case 'callback-failed':
      return 'Google 登入回呼失敗，請再試一次。'
    default:
      return null
  }
}
