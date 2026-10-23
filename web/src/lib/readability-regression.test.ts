import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveSafeCallbackNext } from './auth/callback-redirect'
import { resolveIdentityBoundProfile } from './auth/identity-binding'
import { getPasswordUpdateErrorMessage, validateNewPassword } from './auth/password-rules'
import { normalizeExternalUrl } from './external-url'

test('網址整理保留協定補齊、格式拒絕與 URL 正規化行為', () => {
  const examples: Array<[string | null | undefined, string | null]> = [
    [undefined, null],
    [null, null],
    ['', null],
    ['   ', null],
    ['example.com', 'https://example.com/'],
    [' //example.com/video ', 'https://example.com/video'],
    ['HTTP://Example.com', 'http://example.com/'],
    ['https://example.com/a b', 'https://example.com/a%20b'],
    ['example.com/a b', null],
    ['localhost', null],
    ['http://localhost', 'http://localhost/'],
    ['javascript:alert(1)', null],
    ['mailto:coach@example.com', null],
    ['https://', null],
  ]

  for (const [input, expected] of examples) {
    assert.equal(normalizeExternalUrl(input), expected, `輸入：${String(input)}`)
  }
})

test('登入跳轉只接受原本的完整路徑，不放寬白名單', () => {
  for (const path of ['/', '/coach', '/student', '/coach/login', '/student/login']) {
    assert.equal(resolveSafeCallbackNext(path), path)
  }

  for (const path of [null, '', 'https://example.com', '//example.com', '/coach/', '/student?tab=1']) {
    assert.equal(resolveSafeCallbackNext(path), '/coach/login')
  }
})

test('身分綁定遇到缺少 ID 或重複資料時維持拒絕配對', () => {
  const profile = { user_id: 'user-a', id: 1 }
  assert.deepEqual(resolveIdentityBoundProfile([profile], null), { status: 'missing', profile: null })
  assert.deepEqual(resolveIdentityBoundProfile([profile], ''), { status: 'missing', profile: null })
  assert.deepEqual(resolveIdentityBoundProfile([profile, { ...profile, id: 2 }], 'user-a'), {
    status: 'conflict',
    profile: null,
  })
  // 配對成功時回傳的仍是原本那個物件，沒有複製或修改。
  assert.equal(resolveIdentityBoundProfile([profile], 'user-a').profile, profile)
})

test('密碼檢查保留原本訊息與優先順序', () => {
  assert.equal(validateNewPassword('', 'different'), '請輸入新 Password。')
  assert.equal(validateNewPassword('short', 'different'), 'Password 至少需要 8 碼。')
  assert.equal(validateNewPassword('long-enough', 'different'), '兩次輸入的 Password 不一致。')
  assert.equal(validateNewPassword('long-enough', 'long-enough'), null)
  // 原本不會 trim 密碼；這個測試避免整理時意外增加新規則。
  assert.equal(validateNewPassword('        ', '        '), null)

  assert.equal(getPasswordUpdateErrorMessage({ status: 401, message: 'weak same rate limit' }), '登入狀態已失效，請重新登入。')
  assert.equal(getPasswordUpdateErrorMessage({ message: 'same weak rate limit' }), '新密碼不可與目前密碼相同。')
  assert.equal(getPasswordUpdateErrorMessage({ message: 'WEAK rate limit' }), '新密碼至少 8 個字元。')
  assert.equal(getPasswordUpdateErrorMessage({ message: 'rate limit' }), '操作太頻繁，請稍後再試。')
  assert.equal(getPasswordUpdateErrorMessage(null), '更新密碼失敗，請稍後再試。')
  assert.equal(getPasswordUpdateErrorMessage({}), '更新密碼失敗，請稍後再試。')
})
