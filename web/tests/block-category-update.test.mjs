import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

// 載入實際的 TypeScript 程式，只替換外部服務；不連線到任何資料庫。
function loadSource(relativePath, dependencies) {
  const filename = path.resolve(testDirectory, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText
  const sourceModule = { exports: {} }
  const mockRequire = (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`測試不允許未替換的依賴：${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(mockRequire, sourceModule, sourceModule.exports)
  return sourceModule.exports
}

function createScenario({ authorized = true } = {}) {
  let savedFields
  const updateStop = '測試：已捕捉更新欄位，不繼續寫入動作'
  const admin = {
    from(table) {
      assert.equal(table, 'blocks')
      return {
        select() {
          return {
            eq(column, id) {
              assert.equal(column, 'id')
              assert.equal(id, 7)
              return { maybeSingle: async () => ({ data: { id: 7 }, error: null }) }
            },
          }
        },
        update(fields) {
          savedFields = fields
          return {
            eq: async () => ({ error: { message: updateStop } }),
          }
        },
      }
    },
  }
  const service = loadSource('src/services/block-management.ts', {
    'server-only': {},
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/supabase/server': {
      createClient: async () => ({
        from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
      }),
    },
    '@/services/block-import': {},
  })
  const route = loadSource('src/app/api/coach/blocks/[blockId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/auth/api': {
      requireCoachApiContext: async () => authorized
        ? { context: { coachProfile: { id: 1 } } }
        : { response: Response.json({ error: '請先登入' }, { status: 401 }) },
    },
    '@/services/block-management': service,
  })
  return { route, service, fields: () => savedFields, updateStop }
}

const validBody = {
  blockCode: 'B-7',
  blockName: '測試板塊',
  goal: '更新訓練目標',
  sections: [],
}

async function patch(scenario, body) {
  const response = await scenario.route.PATCH(new Request('https://example.test/api/coach/blocks/7', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ blockId: '7' }) })
  // 刻意在第一個資料庫更新後停止，不模擬整份課表內容的寫入。
  assert.equal(response.status, 400)
  assert.equal((await response.json()).error, scenario.updateStop)
}

test('實際編輯請求沒有分類時，API 到 service 都不清空原分類', async () => {
  const scenario = createScenario()
  await patch(scenario, validBody)
  assert.equal(Object.hasOwn(scenario.fields(), 'training_category_id'), false)
  assert.equal(scenario.fields().goal, '更新訓練目標')
  // 模擬資料庫只套用 update 指定的欄位，原分類必須還在。
  const savedBlock = { training_category_id: 18, ...scenario.fields() }
  assert.equal(savedBlock.training_category_id, 18)
})

test('未分類板塊編輯時仍維持未分類', async () => {
  const scenario = createScenario()
  await patch(scenario, validBody)
  assert.equal(({ training_category_id: null, ...scenario.fields() }).training_category_id, null)
})

test('明確傳送 null 時，仍可清空分類', async () => {
  const scenario = createScenario()
  await patch(scenario, { ...validBody, trainingCategoryId: null })
  assert.equal(scenario.fields().training_category_id, null)
})

test('明確指定分類時，仍可更新分類', async () => {
  for (const category of [23, '23']) {
    const scenario = createScenario()
    await patch(scenario, { ...validBody, trainingCategoryId: category })
    assert.equal(scenario.fields().training_category_id, 23)
  }
})

test('無法轉成數字的分類仍沿用原本清空行為', async () => {
  const scenario = createScenario()
  await patch(scenario, { ...validBody, trainingCategoryId: 'invalid' })
  assert.equal(scenario.fields().training_category_id, null)
})

test('其他程式直接呼叫 service，省略分類也不清空', async () => {
  const scenario = createScenario()
  await scenario.service.updateBlockTemplateForCoach({ id: 1 }, 7, {
    ...validBody, trainingElement: '', description: '', trainingCategoryId: undefined,
  })
  assert.equal(Object.hasOwn(scenario.fields(), 'training_category_id'), false)
})

test('未登入的請求仍被拒絕，不執行資料更新', async () => {
  const scenario = createScenario({ authorized: false })
  const response = await scenario.route.PATCH(new Request('https://example.test', { method: 'PATCH' }), {
    params: Promise.resolve({ blockId: '7' }),
  })
  assert.equal(response.status, 401)
  assert.equal(scenario.fields(), undefined)
})
