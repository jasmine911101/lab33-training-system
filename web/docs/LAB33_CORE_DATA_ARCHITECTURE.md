# LAB33 Core Data Architecture

## Purpose
This document defines the LAB33 training, team delivery, and future commerce boundary. It is intentionally architecture-level documentation: payment, public store, revenue sharing, and subscriptions are not implemented here.

## Source of Truth Summary
- `public.coaches`: coach identity, `is_head_coach`, and product/block author identity.
- `public.athletes`: athlete identity.
- `public.coach_athletes`: one-to-one responsible coach assignment for individual athlete management.
- `public.teams`: team container and audit metadata. `created_by` is creator metadata, not the only permission source.
- `public.team_coaches`: Team management permissions source of truth.
- `public.team_memberships`: athlete roster history for Teams.
- `public.training_products`: sellable product master.
- `public.training_product_versions`: immutable publish snapshot of a Product.
- `public.training_product_blocks`: ordered Block references in a Product Version.
- `public.team_product_enrollments`: Team entitlement/access to one Product Version.
- `public.team_program_instances`: operational training program generated from a Team enrollment.
- `public.team_program_sessions`: shared Team sessions generated from Product Version Blocks.
- `public.athlete_team_session_results`: athlete-specific result state for Team sessions.
- `public.blocks`, `public.block_sections`, `public.block_exercises`: reusable training content templates.
- `public.athlete_blocks`, `public.athlete_block_exercises`, `public.athlete_events`: existing individual athlete scheduling and reporting model.

## Text ER Diagram

```text
Coach
  -> coach_athletes
  -> Athlete

Coach
  -> Team Coaches
  -> Team
  -> Team Memberships
  -> Athlete

Coach
  -> Training Product
  -> Product Version
  -> Product Blocks
  -> Blocks

Team + Product Version
  -> Team Product Enrollment
  -> Team Program Instance
  -> Team Program Sessions
  -> Athlete Team Session Results

Future Team Sale / Payment
  -> team_product_enrollments.id

Future Individual Sale / Payment
  -> future individual entitlement/enrollment table
```

## Table Responsibilities

### Coaches
`coaches` is the public role/profile source of truth for coach access. `is_head_coach = true` grants global management permissions in LAB33 V1. Product authors and Team actors are stored as `coach_id` references, not auth metadata.

### Athletes
`athletes` is the public role/profile source of truth for student access. Student access to Team Programs is derived from active `team_memberships` plus active/current `team_product_enrollments`.

### Coach Athletes
`coach_athletes` controls individual athlete management. It does not grant Team management rights by itself. A regular Coach still needs an active `team_coaches` row to manage a Team.

### Teams
`teams` stores the Team identity: name, description, sport type, creator, and active flag. `created_by` is audit metadata and default owner seed only.

### Team Coaches
`team_coaches` is the Team permission source of truth.

Roles:
- `owner`: can manage Team coaches, roster, programs, and results.
- `manager`: default can manage roster, programs, and results.
- `coach`: default can view results; extra booleans may grant roster/program management.
- `viewer`: read-oriented role.

Safety rules:
- Only one active row per `team_id + coach_id`.
- Each Team must retain at least one active owner.
- Removing a Team Coach sets `status = removed`; it does not hard delete the historical assignment.

### Team Memberships
`team_memberships` stores roster history. Active members can access active/current Team Programs. Inactive/removed members keep historical result records but cannot create new Team results.

### Training Products
`training_products` is the sellable Product master. It stores commerce-facing metadata such as product name, description, price, currency, author, and status. It does not store training sessions directly.

### Product Versions
`training_product_versions` freezes a Product at publish time. Existing Team Programs stay pinned to the assigned version even if a product is edited or a new version is published later.

### Product Blocks
`training_product_blocks` is the ordered Block list inside a Product Version. It may store week/day metadata for generating Team sessions.

### Team Product Enrollments
`team_product_enrollments` is the Team entitlement boundary. It answers: which Team has access to which Product Version, from what start date, until what end date, and with what seat limit.

Future payment systems should link Team purchases to `team_product_enrollments.id`. Payment should not directly create, delete, or mutate `team_program_sessions`.

### Team Program Instances
`team_program_instances` is the generated operational program for the Team. V1 creates one program per enrollment.

Lifecycle:
- Future start date -> `scheduled`.
- Current start date -> `active`.
- End enrollment -> `completed`.
- Cancel enrollment -> `cancelled`.

### Team Program Sessions
`team_program_sessions` are shared Team schedule rows generated from Product Version Blocks. They keep block references and generated dates. They are not copied per athlete.

### Athlete Team Session Results
`athlete_team_session_results` stores athlete-specific state for a Team Program Session.

Normalized V1 fields:
- `status`
- `started_at`
- `completed_at`
- `notes`

`result_json` should only hold additional ad-hoc metrics that the current schema cannot represent safely yet, such as experimental velocity data, device payloads, wellness check-ins, or custom result objects. Common stable fields should be promoted to normal columns in a future migration instead of being duplicated forever in JSON.

### Existing Individual Schedule Model
`athlete_blocks` and `athlete_block_exercises` remain the source of truth for coach-assigned individual schedules and athlete exercise-level reports. Team delivery does not replace or mutate this model.

## Permission Model
Head Coach:
- Global access to all Teams, roster, programs, results, and Team Coach management.

Team Owner:
- Can manage Team coaches, roster, programs, and results.

Manager / Coach / Viewer:
- Governed by `can_manage_roster`, `can_manage_programs`, and `can_view_results`.

Athlete:
- Can access only active/current programs for Teams where they have active membership.
- Cannot access or modify `team_coaches`.

## Seat Limit Rules
Effective enrollment:
- `status = active`
- `start_date <= current_date`
- `end_date is null or end_date >= current_date`

If multiple effective enrollments have `seat_limit`, LAB33 uses the strictest value: `min(seat_limit)`. If all effective enrollments have `seat_limit = null`, roster size is unlimited.

Membership add/reactivation must use the `add_or_reactivate_team_member` RPC. The RPC locks the Team row and effective enrollment rows, calculates active roster count inside the same transaction, and fails if the operation would exceed the strictest seat limit.

## Enrollment / Program Lifecycle
Assignment uses `assign_product_version_to_team` RPC:
- Creates enrollment.
- Creates program instance.
- Generates sessions.
- Validates product version is published.
- Validates product is active/non-archived.
- Validates new `seat_limit >= active roster count`.
- Uses Team Coach program permission or Head Coach override.

End/Cancel uses `transition_team_enrollment` RPC:
- End: enrollment -> `ended`, program -> `completed`.
- Cancel: enrollment -> `cancelled`, program -> `cancelled`, non-completed sessions -> `cancelled`.
- Sessions and results are preserved.

## Delete Rules
Commerce Team Delivery prioritizes preserving historical training records.

Recommended defaults:
- Coach deletion should not cascade-delete Teams.
- Team deletion should be soft-state in future; V1 uses `is_active` on Teams and restrict FKs.
- Product archive should not affect existing Team Programs.
- Product Version retirement should not affect existing Team Programs.
- Athlete leaving a Team should not delete historical results.
- Enrollments, Programs, Sessions, and Results should not be hard-deleted by normal UI.

## Sales / Payment Boundary
Future Team Sales / Payment should point to `team_product_enrollments.id`.

Future Individual Sales / Payment should point to a separate individual entitlement/enrollment table, not `athlete_blocks` directly.

Payment state should control entitlement/enrollment validity. Training delivery tables should remain the auditable history of what was delivered and completed.
