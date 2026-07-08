export function normalizeExternalUrl(value: string | null | undefined) {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const withProtocol = raw.startsWith('//')
    ? `https:${raw}`
    : /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw)
      ? raw
      : raw.includes('.') && !raw.includes(' ')
        ? `https://${raw}`
        : ''

  if (!withProtocol) return null

  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
