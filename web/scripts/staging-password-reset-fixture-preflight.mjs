#!/usr/bin/env node

/**
 * Read-only preflight for the disposable staging password-reset integration test.
 *
 * Required process-only environment variables:
 *   STAGING_SUPABASE_PROJECT_REF
 *   STAGING_SUPABASE_URL
 *   STAGING_SUPABASE_SERVICE_ROLE_KEY
 *
 * The fixture mapping is intentionally Git-external and must be populated only
 * after human approval. This script never updates Auth or public profiles.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const EXPECTED_REF = 'umsmunecsqfaxwdhyrvc';
const DEFAULT_MAPPING = resolve(process.cwd(), '..', '.local', 'staging-password-reset-fixtures.json');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS = [
  'head_coach_user_id', 'head_coach_profile_id',
  'coach_a_user_id', 'coach_a_profile_id',
  'coach_b_user_id', 'coach_b_profile_id',
  'assigned_athlete_user_id', 'assigned_athlete_profile_id',
  'unassigned_athlete_user_id', 'unassigned_athlete_profile_id',
];

function fail(code) {
  console.error(`FIXTURE_PREFLIGHT_STOP:${code}`);
  process.exit(1);
}

function requireEnvironment() {
  const { STAGING_SUPABASE_PROJECT_REF: ref, STAGING_SUPABASE_URL: url, STAGING_SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (ref !== EXPECTED_REF) fail('PROJECT_REF_MISMATCH');
  if (!key) fail('MISSING_SERVER_CREDENTIAL');
  let parsed;
  try { parsed = new URL(url); } catch { fail('INVALID_PROJECT_URL'); }
  if (parsed.hostname !== `${EXPECTED_REF}.supabase.co`) fail('PROJECT_URL_MISMATCH');
  return { url: parsed.origin, key };
}

function validateMapping(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_MAPPING');
  const actual = Object.keys(value).sort();
  const expected = [...KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail('MAPPING_KEYS_MISMATCH');
  for (const key of KEYS) {
    const valueAtKey = value[key];
    if (typeof valueAtKey !== 'string' || valueAtKey.trim() === '') fail('MAPPING_INCOMPLETE');
    if (key.endsWith('_user_id') && !UUID.test(valueAtKey)) fail('INVALID_USER_ID');
    if (key.endsWith('_profile_id') && !/^\d+$/.test(valueAtKey)) fail('INVALID_PROFILE_ID');
  }
  const userIds = KEYS.filter((key) => key.endsWith('_user_id')).map((key) => value[key]);
  const profileIds = KEYS.filter((key) => key.endsWith('_profile_id')).map((key) => value[key]);
  if (new Set(userIds).size !== userIds.length || new Set(profileIds).size !== profileIds.length) fail('DUPLICATE_FIXTURE_ID');
  return value;
}

async function request(url, key, path) {
  const response = await fetch(`${url}${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!response.ok) fail('READ_VALIDATION_FAILED');
  return response.json();
}

function oneRow(rows) {
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

async function ensureAuthUser(url, key, userId) {
  await request(url, key, `/auth/v1/admin/users/${encodeURIComponent(userId)}`);
}

async function ensureProfile(url, key, table, profileId, userId, needsHeadCoach = false) {
  const select = needsHeadCoach ? 'id,user_id,is_head_coach' : 'id,user_id';
  const row = oneRow(await request(url, key, `/rest/v1/${table}?select=${select}&id=eq.${encodeURIComponent(profileId)}`));
  if (!row || row.user_id !== userId || (needsHeadCoach && row.is_head_coach !== true)) fail('PROFILE_AUTH_MISMATCH');
}

async function ensureAssignment(url, key, coachId, athleteId, expected) {
  const rows = await request(url, key, `/rest/v1/coach_athletes?select=coach_id,athlete_id&coach_id=eq.${encodeURIComponent(coachId)}&athlete_id=eq.${encodeURIComponent(athleteId)}`);
  if ((Array.isArray(rows) && rows.length > 0) !== expected) fail('ASSIGNMENT_RELATIONSHIP_MISMATCH');
}

async function main() {
  if (process.argv[2] !== '--preflight' || process.argv.length !== 3) fail('READ_ONLY_MODE_REQUIRED');
  const { url, key } = requireEnvironment();
  const mappingPath = process.env.STAGING_PASSWORD_RESET_FIXTURE_MAPPING || DEFAULT_MAPPING;
  let mapping;
  try { mapping = validateMapping(JSON.parse(await readFile(mappingPath, 'utf8'))); } catch { fail('MAPPING_UNAVAILABLE'); }

  await Promise.all([
    ensureAuthUser(url, key, mapping.head_coach_user_id),
    ensureAuthUser(url, key, mapping.coach_a_user_id),
    ensureAuthUser(url, key, mapping.coach_b_user_id),
    ensureAuthUser(url, key, mapping.assigned_athlete_user_id),
    ensureAuthUser(url, key, mapping.unassigned_athlete_user_id),
  ]);
  await Promise.all([
    ensureProfile(url, key, 'coaches', mapping.head_coach_profile_id, mapping.head_coach_user_id, true),
    ensureProfile(url, key, 'coaches', mapping.coach_a_profile_id, mapping.coach_a_user_id),
    ensureProfile(url, key, 'coaches', mapping.coach_b_profile_id, mapping.coach_b_user_id),
    ensureProfile(url, key, 'athletes', mapping.assigned_athlete_profile_id, mapping.assigned_athlete_user_id),
    ensureProfile(url, key, 'athletes', mapping.unassigned_athlete_profile_id, mapping.unassigned_athlete_user_id),
  ]);
  await Promise.all([
    ensureAssignment(url, key, mapping.coach_a_profile_id, mapping.assigned_athlete_profile_id, true),
    ensureAssignment(url, key, mapping.coach_a_profile_id, mapping.unassigned_athlete_profile_id, false),
    ensureAssignment(url, key, mapping.coach_b_profile_id, mapping.unassigned_athlete_profile_id, true),
  ]);
  console.log('FIXTURE_PREFLIGHT_PASS: five approved role bindings and assignment boundaries verified');
}

main().catch(() => fail('UNEXPECTED_FAILURE'));
