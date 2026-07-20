import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const requiredFiles = [
  'supabase/migrations/20260718_commerce_team_program_delivery.sql',
  'supabase/migrations/20260718_commerce_team_delivery_hardening.sql',
  'src/services/team-programs.ts',
  'src/lib/types/team-programs.ts',
  'src/components/coach/team-management-panel.tsx',
  'src/components/coach/team-programs-panel.tsx',
  'src/components/student/team-programs-panel.tsx',
  'src/app/api/coach/teams/[teamId]/coaches/route.ts',
  'src/app/api/coach/teams/[teamId]/coaches/[teamCoachId]/route.ts',
  'src/app/api/coach/teams/[teamId]/coaches/[teamCoachId]/remove/route.ts',
  'docs/COMMERCE_TEAM_PROGRAM_MODEL.md',
  'docs/LAB33_CORE_DATA_ARCHITECTURE.md',
]
const sprint2Tables = ['teams', 'team_memberships', 'team_product_enrollments', 'team_program_instances', 'team_program_sessions', 'athlete_team_session_results']
const sprint21Tables = ['team_coaches']
const allTables = [...sprint2Tables, ...sprint21Tables]

let failed = false
function check(label, condition) {
  if (!condition) failed = true
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`)
}
function note(label) {
  console.log(`INFO ${label}`)
}

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

for (const file of requiredFiles) {
  check(`${file} exists`, fs.existsSync(path.join(root, file)))
}

const sprint2 = fs.readFileSync(path.join(root, 'supabase/migrations/20260718_commerce_team_program_delivery.sql'), 'utf8')
const hardening = fs.readFileSync(path.join(root, 'supabase/migrations/20260718_commerce_team_delivery_hardening.sql'), 'utf8')
const migration = `${sprint2}\n${hardening}`
const service = fs.readFileSync(path.join(root, 'src/services/team-programs.ts'), 'utf8')
const appShell = fs.readFileSync(path.join(root, 'src/components/layout/app-shell.tsx'), 'utf8')
const architecture = fs.existsSync(path.join(root, 'docs/LAB33_CORE_DATA_ARCHITECTURE.md')) ? fs.readFileSync(path.join(root, 'docs/LAB33_CORE_DATA_ARCHITECTURE.md'), 'utf8') : ''

check('teams table exists', /create table if not exists public\.teams/i.test(migration))
check('team_memberships table exists', /create table if not exists public\.team_memberships/i.test(migration))
check('team_coaches table exists', /create table if not exists public\.team_coaches/i.test(migration))
check('team_product_enrollments table exists', /create table if not exists public\.team_product_enrollments/i.test(migration))
check('team_program_instances table exists', /create table if not exists public\.team_program_instances/i.test(migration))
check('team_program_sessions table exists', /create table if not exists public\.team_program_sessions/i.test(migration))
check('athlete_team_session_results table exists', /create table if not exists public\.athlete_team_session_results/i.test(migration))
check('atomic assignment RPC exists', /function public\.assign_product_version_to_team/i.test(migration))
check('transaction-safe roster RPC exists', /function public\.add_or_reactivate_team_member/i.test(migration))
check('atomic enrollment transition RPC exists', /function public\.transition_team_enrollment/i.test(migration))
check('owner guard trigger exists', /trg_team_coaches_owner_guard/i.test(migration))
check('team creator owner trigger exists', /trg_add_team_creator_as_owner/i.test(migration))
check('existing teams owner backfill exists', /insert into public\.team_coaches[\s\S]+from public\.teams/i.test(hardening))
check('active team coach uniqueness exists', /idx_team_coaches_one_active_coach/i.test(hardening))
check('team coach RLS enabled', /alter table public\.team_coaches enable row level security/i.test(hardening))
check('assignment RPC revoked from authenticated', /revoke execute on function public\.assign_product_version_to_team[\s\S]+from authenticated/i.test(migration))
check('roster RPC revoked from authenticated', /revoke execute on function public\.add_or_reactivate_team_member[\s\S]+from authenticated/i.test(hardening))
check('transition RPC revoked from authenticated', /revoke execute on function public\.transition_team_enrollment[\s\S]+from authenticated/i.test(hardening))
check('all RPCs granted to service_role', ['assign_product_version_to_team', 'add_or_reactivate_team_member', 'transition_team_enrollment'].every((fn) => new RegExp(`grant execute on function public\\.${fn}[\\s\\S]+to service_role`, 'i').test(migration)))
check('RLS enabled for all Sprint 2 tables', sprint2Tables.every((table) => new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(migration)))
check('service calls atomic assignment RPC', /rpc\('assign_product_version_to_team'/.test(service))
check('service calls roster RPC', /rpc\('add_or_reactivate_team_member'/.test(service))
check('service calls transition RPC', /rpc\('transition_team_enrollment'/.test(service))
check('service no longer filters manageable teams only by created_by', !/query = query\.eq\('created_by'/.test(service))
check('service hydrates team coaches', /from\('team_coaches'\)/.test(service) && /TeamCoachRecord/.test(service))
check('team coach API routes wired', /addTeamCoachForCoach/.test(fs.readFileSync(path.join(root, 'src/app/api/coach/teams/[teamId]/coaches/route.ts'), 'utf8')))
check('student navigation added', /\/student\/team-programs/.test(appShell))
check('coach team navigation added', /\/coach\/teams/.test(appShell) && /\/coach\/team-programs/.test(appShell))
check('architecture doc covers payment boundary', /team_product_enrollments\.id/.test(architecture) && /Payment/.test(architecture))
check('architecture doc covers result_json boundary', /result_json/.test(architecture) && /status/.test(architecture))

loadEnvFile()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && serviceRoleKey) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  for (const table of allTables) {
    const { error } = await supabase.from(table).select('id', { count: 'exact', head: true })
    if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
      note(`live read-only smoke skipped for ${table}: table not found, apply migration first`)
      continue
    }
    check(`live read-only smoke can query ${table}`, !error)
  }
} else {
  note('live read-only smoke skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
}

process.exit(failed ? 1 : 0)
