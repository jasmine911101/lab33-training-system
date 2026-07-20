import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'supabase/migrations/20260717_commerce_product_management_hardening.sql',
  'src/services/commerce-products.ts',
  'src/lib/types/commerce.ts',
  'docs/COMMERCE_PRODUCT_MODEL.md',
]

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing required Commerce hardening file: ${file}`)
  }
}

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260717_commerce_product_management_hardening.sql'), 'utf8')
const service = fs.readFileSync(path.join(root, 'src/services/commerce-products.ts'), 'utf8')

const checks = [
  ['training_product_versions table', /create table if not exists public\.training_product_versions/i.test(migration)],
  ['one published partial unique index', /where status = 'published'/i.test(migration)],
  ['replace blocks RPC', /function public\.replace_product_version_blocks/i.test(migration)],
  ['publish transaction RPC', /function public\.publish_product_version/i.test(migration)],
  ['archive preserves records', /function public\.archive_product/i.test(migration)],
  ['service uses replace RPC', /rpc\('replace_product_version_blocks'/.test(service)],
  ['service uses publish RPC', /rpc\('publish_product_version'/.test(service)],
  ['published version read-only guard', /Published version is read-only/.test(service)],
]

const failed = checks.filter(([, pass]) => !pass)
if (failed.length > 0) {
  for (const [name] of failed) console.error(`FAIL ${name}`)
  process.exit(1)
}

for (const [name] of checks) console.log(`PASS ${name}`)
