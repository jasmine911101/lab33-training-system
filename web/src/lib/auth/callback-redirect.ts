// Set 是不重複的清單；has() 用來確認路徑是否在清單裡。
// 登入後只能前往這些站內路徑，不能任意跳到外部網站。
const ALLOWED_CALLBACK_PATHS = new Set([
  '/',
  '/coach',
  '/student',
  '/coach/login',
  '/student/login',
])

export function resolveSafeCallbackNext(requestedNext: string | null) {
  if (requestedNext && ALLOWED_CALLBACK_PATHS.has(requestedNext)) {
    return requestedNext
  }

  // 沒指定路徑，或路徑不在允許清單時，沿用原本的預設登入頁。
  return '/coach/login'
}
