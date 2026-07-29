const ALLOWED_CALLBACK_PATHS = new Set([
  '/',
  '/coach',
  '/student',
  '/coach/login',
  '/student/login',
])

export function resolveSafeCallbackNext(requestedNext: string | null) {
  return requestedNext && ALLOWED_CALLBACK_PATHS.has(requestedNext)
    ? requestedNext
    : '/coach/login'
}
