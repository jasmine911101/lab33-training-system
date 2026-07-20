import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const files = [
  'supabase/migrations/20260718_block_taxonomy_management_hardening.sql',
  'src/services/block-taxonomy.ts',
  'src/components/coach/block-taxonomy-browser.tsx',
  'src/app/api/coach/block-taxonomy/[nodeType]/[nodeId]/route.ts',
  'src/app/api/coach/block-taxonomy/[nodeType]/[nodeId]/delete-preview/route.ts',
  'src/app/api/coach/block-taxonomy/[nodeType]/[nodeId]/archive/route.ts',
]

for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing ${file}`)
}

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260718_block_taxonomy_management_hardening.sql'), 'utf8')
const service = fs.readFileSync(path.join(root, 'src/services/block-taxonomy.ts'), 'utf8')
const browser = fs.readFileSync(path.join(root, 'src/components/coach/block-taxonomy-browser.tsx'), 'utf8')

const checks = [
  ['delete transaction RPC exists', /function public\.delete_block_taxonomy_node/.test(migration)],
  ['archive RPC exists', /function public\.archive_block_taxonomy_node/.test(migration)],
  ['RPC not granted to authenticated', /revoke execute on function public\.delete_block_taxonomy_node/.test(migration)],
  ['product usage audit checks training_product_blocks', /training_product_blocks/.test(service)],
  ['schedule usage audit checks athlete_blocks', /athlete_blocks/.test(service)],
  ['program usage audit checks athlete_program_blocks', /athlete_program_blocks/.test(service)],
  ['results usage audit checks athlete_block_exercises', /athlete_block_exercises/.test(service)],
  ['browser has explicit back href', /backHref/.test(browser)],
  ['action menu stops propagation', /stopPropagation/.test(browser)],
]

for (const [name, pass] of checks) {
  if (!pass) throw new Error(`FAIL ${name}`)
  console.log(`PASS ${name}`)
}

const envPath = path.join(root, '.env.local')
if (!fs.existsSync(envPath)) {
  console.log('SKIP live read-only audit: .env.local not found')
  process.exit(0)
}
const envText = fs.readFileSync(envPath, 'utf8')
const url = envText.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim()
const serviceKey = envText.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/m)?.[1]?.trim()
if (!url || !serviceKey) {
  console.log('SKIP live read-only audit: Supabase URL or service role missing')
  process.exit(0)
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: categories, error: categoryError } = await supabase
  .from('block_taxonomy_training_categories')
  .select('id, name')
  .eq('is_active', true)
  .limit(1)
if (categoryError) throw categoryError
if (!categories?.length) {
  console.log('SKIP live read-only audit: no active training categories')
  process.exit(0)
}

const category = categories[0]
const { data: blocks, error: blockError } = await supabase
  .from('blocks')
  .select('id, block_code, block_name')
  .eq('training_category_id', category.id)
if (blockError) throw blockError
const blockIds = (blocks ?? []).map((block) => block.id)
console.log(`PASS live read-only audit loaded category "${category.name}" with ${blockIds.length} blocks`)

if (blockIds.length > 0) {
  const { error: scheduleError } = await supabase.from('athlete_blocks').select('id, block_id').in('block_id', blockIds).limit(5)
  if (scheduleError) throw scheduleError
  console.log('PASS live read-only audit queried schedule references')
}
