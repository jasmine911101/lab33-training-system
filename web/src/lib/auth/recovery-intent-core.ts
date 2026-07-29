import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const RECOVERY_INTENT_MAX_AGE_SECONDS = 10 * 60

type RecoveryIntentPayload = {
  exp: number
  nonce: string
  sub: string
}

function sign(encodedPayload: string, secret: string) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

export function createRecoveryIntentValue(
  secret: string,
  userId: string,
  now = Date.now(),
  nonce: string = randomUUID(),
) {
  const payload: RecoveryIntentPayload = {
    sub: userId,
    exp: Math.floor(now / 1000) + RECOVERY_INTENT_MAX_AGE_SECONDS,
    nonce,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload, secret)}`
}

export function hasValidRecoveryIntentValue(
  value: string | undefined,
  secret: string,
  userId: string | undefined,
  now = Date.now(),
) {
  if (!value || !userId) return false

  const [encodedPayload, suppliedSignature, ...rest] = value.split('.')
  if (!encodedPayload || !suppliedSignature || rest.length > 0) return false

  const expectedSignature = sign(encodedPayload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as RecoveryIntentPayload
    return payload.sub === userId
      && typeof payload.exp === 'number'
      && payload.exp > Math.floor(now / 1000)
      && typeof payload.nonce === 'string'
      && payload.nonce.length > 0
  } catch {
    return false
  }
}
