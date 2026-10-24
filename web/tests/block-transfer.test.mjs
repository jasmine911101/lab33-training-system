import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function load(file, dependencies) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText
  const loadedModule = { exports: {} }
  new Function('require', 'module', 'exports', source)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

function scenario({ failExercises = false, failCleanup = false, inactiveParent = false, missingSource = false, noAdmin = false } = {}) {
  const exercise = { id: 90, block_id: 7, section_id: 10, exercise_name: '深蹲', sets: '3', reps_or_time: '8', equipment: '槓鈴', intensity: '80%', weight: '50', rest: '90s', video_url: 'https://example.test/video', notes: '慢慢下蹲', order_num: 2 }
  const source = { id: 7, training_category_id: 1, block_code: 'SRC', block_name: '原板塊', goal: '力量', training_element: '肌力', description: '描述', sections: [{ id: 10, block_id: 7, section_name: '主要運動', order_num: 3, exercises: [exercise] }, { id: 11, block_id: 7, section_name: '空區段', order_num: 4, exercises: [] }] }
  const tables = { blocks: [{ ...source, sections: undefined }], block_sections: source.sections.map(section => ({ id: section.id, block_id: section.block_id, section_name: section.section_name, order_num: section.order_num })), block_exercises: [{ ...exercise }] }
  const original = structuredClone(tables)
  const writes = []
  let nextId = 100
  const admin = { from(table) {
    assert.ok(table in tables, `不得更動課表資料表：${table}`)
    let action = 'read', payload, column, value, cached
    const run = () => {
      if (cached) return cached
      const rows = tables[table].filter(row => !column || row[column] === value)
      if (action === 'insert') {
        if (table === 'block_exercises' && failExercises) return { data: null, error: { message: 'injected insert failure' } }
        const inserted = (Array.isArray(payload) ? payload : [payload]).map(row => ({ ...row, id: nextId++ }))
        tables[table].push(...inserted)
        writes.push({ table, action, payload: structuredClone(payload) })
        cached = { data: inserted[0], error: null }
      } else if (action === 'update') {
        rows.forEach(row => Object.assign(row, payload))
        writes.push({ table, action, payload: structuredClone(payload) })
        cached = { data: rows[0] ?? null, error: null }
      } else if (action === 'delete') {
        if (failCleanup) return { error: { message: 'injected cleanup failure' } }
        tables[table] = tables[table].filter(row => !rows.includes(row))
        cached = { error: null }
      } else cached = { data: table === 'block_exercises' ? rows : (rows[0] ?? null), error: null }
      return cached
    }
    const query = {
      insert(data) { action = 'insert'; payload = data; return query },
      update(data) { action = 'update'; payload = data; return query },
      delete() { action = 'delete'; return query },
      eq(key, input) { column = key; value = input; return query },
      select() { return query },
      single: async () => run(), maybeSingle: async () => run(),
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject) },
    }
    return query
  } }
  const taxonomy = { sports: inactiveParent ? [] : [{ id: 2, name: '足球' }], ageGroups: [{ id: 3, sport_id: 2, name: '高中' }], trainingCategories: [{ id: 1, age_group_id: 3, name: '原分類' }, { id: 4, age_group_id: 3, name: '力量' }] }
  const service = load('src/services/block-transfer.ts', {
    'server-only': {},
    '@/lib/supabase/admin': { createAdminClient: () => noAdmin ? null : admin },
    '@/services/block-management': {
      fetchBlockIdentityRows: async () => tables.blocks,
      getBlockManagementSnapshot: async () => ({ blocks: missingSource ? [] : [source] }),
    },
    '@/services/block-taxonomy': { getTaxonomySelectionSnapshot: async () => taxonomy },
  })
  return { ...service, source, tables, original, writes }
}
const copyInput = { mode: 'copy', trainingCategoryId: 4, blockCode: 'COPY', blockName: '獨立副本' }

test('移動只更動分類，保留板塊 ID、動作與區段', async () => {
  const s = scenario()
  const result = await s.transferBlock(7, { mode: 'move', trainingCategoryId: 4 })
  assert.equal(result.blockId, 7)
  assert.equal(result.targetPath, '/coach/blocks/sport/2/age/3/category/4')
  assert.deepEqual(s.writes, [{ table: 'blocks', action: 'update', payload: { training_category_id: 4 } }])
  assert.deepEqual(s.tables.block_sections, s.original.block_sections)
  assert.deepEqual(s.tables.block_exercises, s.original.block_exercises)
})

test('複製所有內容與順序，建立新 ID 並保留來源', async () => {
  const s = scenario()
  const result = await s.transferBlock(7, copyInput)
  assert.notEqual(result.blockId, 7)
  assert.deepEqual(s.tables.blocks[0], s.original.blocks[0])
  assert.deepEqual(s.tables.block_exercises[0], s.original.block_exercises[0])
  const copy = s.tables.blocks.find(row => row.id === result.blockId)
  assert.equal(copy.training_category_id, 4)
  assert.equal(copy.goal, s.source.goal)
  assert.equal(copy.training_element, s.source.training_element)
  assert.equal(copy.description, s.source.description)
  const sections = s.tables.block_sections.filter(row => row.block_id === result.blockId)
  assert.equal(sections.length, 2)
  assert.deepEqual(sections.map(row => [row.section_name, row.order_num]), [['主要運動', 3], ['空區段', 4]])
  const exercise = s.tables.block_exercises.find(row => row.block_id === result.blockId)
  assert.equal(exercise.section_id, sections[0].id)
  const expected = { ...s.original.block_exercises[0] }
  const actual = { ...exercise }
  for (const key of ['id', 'block_id', 'section_id']) { delete expected[key]; delete actual[key] }
  assert.deepEqual(actual, expected)
  // 修改副本不會改到來源資料。
  exercise.notes = '只改副本'
  assert.equal(s.tables.block_exercises[0].notes, '慢慢下蹲')
})

for (const [label, input, options, message] of [
  ['同一分類', { mode: 'move', trainingCategoryId: 1 }, {}, /不同的分類/],
  ['不存在的分類', { mode: 'move', trainingCategoryId: 99 }, {}, /不存在或已停用/],
  ['停用的上層', copyInput, { inactiveParent: true }, /不存在或已停用/],
  ['不存在的來源', copyInput, { missingSource: true }, /找不到原板塊/],
  ['缺少管理連線', copyInput, { noAdmin: true }, /尚未完成設定/],
  ['重複代碼', { ...copyInput, blockCode: ' src ' }, {}, /代碼已存在/],
  ['重複名稱', { ...copyInput, blockName: ' 原板塊 ' }, {}, /名稱已存在/],
  ['空白名稱', { ...copyInput, blockName: ' ' }, {}, /請填寫/],
  ['無效分類 ID', { ...copyInput, trainingCategoryId: 0 }, {}, /有效的目標分類/],
]) {
  test(`拒絕${label}且不寫入資料`, async () => {
    const s = scenario(options)
    await assert.rejects(s.transferBlock(7, input), message)
    assert.deepEqual(s.tables, s.original)
    assert.equal(s.writes.length, 0)
  })
}

test('複製動作失敗時清理新副本，來源完全不變', async () => {
  const s = scenario({ failExercises: true })
  await assert.rejects(s.transferBlock(7, copyInput), /已移除這次建立的副本/)
  assert.deepEqual(s.tables, s.original)
})

test('清理失敗時明確回報副本 ID，不回報成功', async () => {
  const s = scenario({ failExercises: true, failCleanup: true })
  await assert.rejects(s.transferBlock(7, copyInput), /副本 ID 100.*不完整資料/)
  assert.deepEqual(s.tables.blocks[0], s.original.blocks[0])
})

for (const status of [401, 403]) {
  test(`API 保留 ${status} 權限拒絕，不呼叫轉移服務`, async () => {
    let calls = 0
    const route = load('src/app/api/coach/blocks/[blockId]/transfer/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/auth/api': { requireCoachApiContext: async () => ({ response: Response.json({}, { status }) }) },
      '@/services/block-transfer': { transferBlock: async () => { calls++ } },
    })
    const response = await route.POST(new Request('https://example.test', { method: 'POST' }), { params: Promise.resolve({ blockId: '7' }) })
    assert.equal(response.status, status)
    assert.equal(calls, 0)
  })
}

test('API 驗證輸入，並只傳送允許的欄位', async () => {
  const calls = []
  const route = load('src/app/api/coach/blocks/[blockId]/transfer/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/auth/api': { requireCoachApiContext: async () => ({ context: { coachProfile: { id: 1 } } }) },
    '@/services/block-transfer': { transferBlock: async (...args) => { calls.push(args); return { blockId: 100 } } },
  })
  for (const body of [{}, { ...copyInput, mode: 'delete' }, { ...copyInput, trainingCategoryId: '4' }, { ...copyInput, blockCode: null }]) {
    const response = await route.POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ blockId: '7' }) })
    assert.equal(response.status, 400)
  }
  assert.equal(calls.length, 0)
  const response = await route.POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ ...copyInput, coachId: 999, role: 'admin', sections: [] }) }), { params: Promise.resolve({ blockId: '7' }) })
  assert.equal(response.status, 200)
  assert.deepEqual(calls, [[7, copyInput]])
})


test('複製保留尚未指定區段的舊動作，不遺漏資料', async () => {
  const s = scenario()
  s.tables.block_exercises.push({ ...s.tables.block_exercises[0], id: 91, section_id: null, notes: '舊版動作' })
  const result = await s.transferBlock(7, copyInput)
  const copied = s.tables.block_exercises.filter(row => row.block_id === result.blockId)
  assert.equal(copied.length, 2)
  assert.equal(copied[1].section_id, null)
  assert.equal(copied[1].notes, '舊版動作')
})
