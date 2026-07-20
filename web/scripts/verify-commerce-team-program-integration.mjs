import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
function loadEnvFile() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...parts] = trimmed.split('=')
    if (!process.env[key]) process.env[key] = parts.join('=').trim().replace(/^['"]|['"]$/g, '')
  }
}

let failed = false
function check(label, condition) {
  if (!condition) failed = true
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`)
}
function info(label) {
  console.log(`INFO ${label}`)
}

loadEnvFile()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  info('Skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const tables = ['teams', 'team_coaches', 'team_memberships', 'team_product_enrollments', 'team_program_instances', 'team_program_sessions', 'athlete_team_session_results']

for (const table of tables) {
  const { error } = await supabase.from(table).select('id', { head: true, count: 'exact' })
  check(`read-only table smoke: ${table}`, !error)
  if (error) info(`${table}: ${error.code ?? 'unknown'} ${error.message}`)
}

const runDestructive = process.env.LAB33_RUN_DESTRUCTIVE_TEAM_TESTS === '1'
if (!runDestructive) {
  info('Destructive/concurrency integration tests skipped. To run on a disposable staging database, set LAB33_RUN_DESTRUCTIVE_TEAM_TESTS=1 and provide seed ids in a future test harness.')
  process.exit(failed ? 1 : 0)
}

info('Destructive test harness intentionally not implemented against production data. Create isolated seed data before enabling full concurrency tests.')
process.exit(failed ? 1 : 0)
