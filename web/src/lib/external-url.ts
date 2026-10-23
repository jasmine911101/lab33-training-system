export function normalizeExternalUrl(value: string | null | undefined) {
  // 先把沒填的值當成空字串，再移除頭尾空白。
  const trimmedUrl = String(value ?? '').trim()
  if (!trimmedUrl) {
    return null
  }

  // 依照原本的順序判斷網址；只替省略協定的網址補上 https。
  let urlWithProtocol = ''
  if (trimmedUrl.startsWith('//')) {
    urlWithProtocol = `https:${trimmedUrl}`
  } else if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmedUrl)) {
    urlWithProtocol = trimmedUrl
  } else if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
    urlWithProtocol = `https://${trimmedUrl}`
  }

  if (!urlWithProtocol) {
    return null
  }

  try {
    // URL 會檢查格式；即使能解析，仍然只接受 http 與 https。
    const url = new URL(urlWithProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
