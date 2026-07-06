# LAB33 Training System React Migration - Phase 1

## 1. Current Streamlit feature map

### Authentication and account management
- Student login uses Supabase email/password auth.
- Coach login uses the same Supabase auth system, but coach access is additionally checked against `coaches` and optional secrets-based allowlists.
- Coach self-registration exists behind `COACH_INVITE_CODE`.
- Coach-created student accounts use `SUPABASE_SERVICE_ROLE_KEY` server-side to create/reset auth users and temporary passwords.
- Students can be forced to change password on first login with `athletes.must_change_password`.
- Password recovery exists in Streamlit through the recovery token flow.

### Coach-side features
- View only authorized athletes.
- Head coach can view all athletes.
- Head coach can assign one or more coaches to each athlete.
- Create athlete records and linked Supabase Auth users.
- Reset athlete temporary password.
- Delete athlete.
- Search and filter athletes.
- Create blocks manually.
- Import blocks from Excel workbook sheets.
- View block details.
- Delete blocks.
- Assign blocks to athletes via calendar date/range selection.
- Edit assigned athlete block details inline.
- View student-reported exercise changes.
- Add coach-managed general events on athlete calendars.

### Student-side features
- Login with existing Supabase auth account.
- See assigned schedule calendar.
- Open calendar card details.
- Report actual sets/weight and directly edit assignment exercise fields inside the custom component.
- View coach-added general calendar events.
- Change password.

## 2. Effective data model used by the running app

Note: the live Streamlit app uses `online_exercise.py` as the practical source of truth. `schema.sql` contains older `period*` program tables that do not match the current Streamlit feature set and should not be treated as the primary migration source.

### Core auth / people tables
- `coaches`
  - `id`, `user_id`, `name`, `email`, `is_head_coach`, `created_at`
- `coach_athletes`
  - many-to-many join between coaches and athletes
- `athletes`
  - `id`, `user_id`, `name`, `email`, `sport`, `level`, `must_change_password`, `created_at`

### Training template tables
- `blocks`
  - block master record
- `block_sections`
  - child sections of a block
- `block_exercises`
  - exercises under each block / section

### Athlete schedule tables
- `athlete_blocks`
  - one assigned block on an athlete calendar
  - includes `event_name`, `cycle_goal`, date range, week/day, category, notes
- `athlete_block_exercises`
  - snapshot of exercises copied from block template into athlete-specific assignment rows
  - also stores student-reported `actual_sets`, `actual_weight`
- `athlete_events`
  - general non-block calendar events such as match/test/travel/leave

### Legacy / older schema tables present in SQL file
- `users`
- `periods`
- `period_blocks`
- `athlete_programs`
- `athlete_program_blocks`

These appear to come from an older schema iteration and are not the main data path for the current Streamlit app.

## 3. Data relationships
- One `coach` can manage many `athletes` through `coach_athletes`.
- One `athlete` can belong to many `coaches` through `coach_athletes`.
- One `block` has many `block_sections`.
- One `block` has many `block_exercises`.
- One `athlete` has many `athlete_blocks` assignments.
- One `athlete_block` has many `athlete_block_exercises` rows.
- One `athlete` has many `athlete_events`.
- One `auth.users` account may map to one `coaches.user_id` and/or one `athletes.user_id` depending on account type and migration history.

## 4. Current user flows

### Coach flow
1. Open coach mode.
2. Log in or register with invite code.
3. If user is not a recognized coach, access is denied.
4. View athlete list filtered by permissions.
5. Head coach can filter by assigned coach and edit athlete-to-coach assignment.
6. Coach can create athlete auth + athlete record.
7. Coach opens athlete detail.
8. Coach schedules a block on calendar range.
9. Coach can also create non-block general events.
10. Coach edits athlete assignment content and sees student-reported changes.
11. Coach manages block templates from manual form or Excel import.

### Student flow
1. Open student mode.
2. Log in with existing Supabase account.
3. If `must_change_password` is true, password reset is forced first.
4. Student sees own calendar.
5. Student opens assignment cards and submits actual performance values.
6. Student can also view coach-added general events.
7. Student can change password later from sidebar.

## 5. React migration principles
- Keep Streamlit app untouched during migration.
- Build the new app in `web/` and deploy independently.
- Reuse existing Supabase project and auth accounts.
- Never expose service role to the browser.
- Move read/write paths incrementally, beginning with auth and shell pages.
- Treat current DB contents as production-like data that must remain intact.

## 6. Proposed Next.js structure

```text
web/
  src/
    app/
      (auth)/
        coach/login/
        student/login/
      (app)/
        coach/
        student/
      page.tsx
    components/
      auth/
      layout/
      coach/
      student/
      blocks/
      calendar/
      shared/
    lib/
      auth/
      supabase/
      utils/
      constants/
      types/
    services/
      coach/
      student/
      blocks/
      assignments/
      calendar/
    hooks/
    styles/
  proxy.ts
```

### Intended responsibilities
- `app/`: route entry points and server-rendered orchestration.
- `components/`: reusable UI pieces.
- `lib/supabase/`: browser/server/proxy clients.
- `lib/auth/`: session helpers, role detection, route protection.
- `services/`: feature-oriented Supabase queries and mutations.
- `lib/types/`: shared TypeScript types inferred from current tables.

## 7. Phase plan

### Phase 1
- Analysis and documentation.
- Separate Next.js app scaffold.
- Supabase SSR auth foundation.
- Placeholder coach/student protected pages.

### Phase 2
- Shared app shell, role-aware navigation, and profile bootstrap.
- Coach/student route guards using current tables.
- Basic dashboard summaries.

### Phase 3
- Coach athlete list and athlete detail migration.
- Head coach assignment controls.

### Phase 4
- Block template listing and detail migration.
- Manual block creation forms.

### Phase 5
- Calendar schedule read-only migration.
- General events read-only migration.

### Phase 6
- Assignment editing and student reporting migration.

### Phase 7
- Excel import migration.
- Hardening, QA, and Vercel deployment prep.

## 8. Security notes for the web app foundation
- Frontend uses only `NEXT_PUBLIC_SUPABASE_URL` and publishable key.
- No service role key is added to the Next.js client.
- SSR auth is cookie-based using `@supabase/ssr` and Proxy session refresh.
- Future privileged mutations that require service-level behavior should move to secure server-only routes or keep running in Streamlit until replaced safely.
