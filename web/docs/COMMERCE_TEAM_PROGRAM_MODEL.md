# LAB33 Commerce Team Program Model

## Purpose
Commerce Sprint 2 delivers published Training Product Versions to Teams without implementing payment. Sprint 2.1 hardens the model with multi-coach Team permissions, transaction-safe roster seat limits, and atomic lifecycle transitions.

Published Product Version -> Team -> Team Program Instance -> Team Members -> Individual Results.

## Existing Tables Reused
- `public.coaches`: coach identity and `is_head_coach` source of truth.
- `public.athletes`: student identity.
- `public.coach_athletes`: existing coach-to-athlete management relationship. Regular coaches may only add athletes they manage to a Team.
- `public.training_products`: product master.
- `public.training_product_versions`: immutable published content snapshot.
- `public.training_product_blocks`: ordered blocks inside a product version.
- `public.blocks`: reusable content template.

## New Tables
- `teams`: Team container and audit metadata. `created_by` is not the sole permission source.
- `team_coaches`: Team coach permission history. One active assignment per Team/Coach; every Team must keep one active owner.
- `team_memberships`: roster history. One active membership per `team_id + athlete_id`.
- `team_product_enrollments`: a Team's access to one Product Version.
- `team_program_instances`: actual program instance created from an enrollment.
- `team_program_sessions`: shared sessions generated from Product Version Blocks.
- `athlete_team_session_results`: athlete-specific completion status and result notes.

## Team Product vs Individual Product Delivery
Team delivery stores shared content once at the Team Program level. It does not copy every Block or Exercise to every athlete.

Individual athlete data is saved only in `athlete_team_session_results`:
- completion status
- started/completed timestamps
- notes
- future structured result JSON

## Team Coach Permission Model
Head Coach can manage all Teams. Otherwise Team permissions come from active `team_coaches` rows:
- `owner`: can manage Team coaches, roster, programs, and results.
- `manager`: default roster/program/result management.
- `coach`: default result viewing, with optional roster/program permissions.
- `viewer`: view-only role.

`teams.created_by` remains creator metadata and seeds the first owner through migration backfill and insert trigger.

## Product Version Fixing
Every `team_product_enrollment` points to a specific `product_version_id`. When a product later publishes V2, existing Team Programs remain fixed to the assigned version. Archived products or retired versions do not delete existing enrollments, sessions, or results.

## Enrollment vs Program Instance
- Enrollment = access/business relationship between Team and Product Version.
- Program Instance = operational training plan generated for the Team from that enrollment.

V1 creates one main `team_program_instance` for every enrollment.

## Atomic Assignment
`assign_product_version_to_team(...)` creates enrollment, program instance, and sessions in a single PostgreSQL function. If validation or insertion fails, PostgreSQL rolls back the whole operation.

The function is revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`. Next.js server routes call it via the server-only admin client.

Assignment also verifies `seat_limit >= current active roster count` before creating the enrollment.

## Dynamic Roster
V1 uses `access_mode = dynamic_roster`:
- Active Team Members can access active enrollments for their team.
- New active members automatically see currently valid Team Programs.
- No course content is copied per athlete.
- Inactive/removed members cannot create new results.
- Existing historical results are preserved.

## Seat Limit
Seat limit is enforced by `add_or_reactivate_team_member(...)`, not only in TypeScript.

Effective enrollment:
- `status = active`
- `start_date <= current_date`
- `end_date is null or end_date >= current_date`

If a Team has multiple effective enrollments with seat limits, LAB33 uses the strictest active seat limit (`min(seat_limit)`). If all effective enrollments have no seat limit, there is no roster limit.

The RPC locks the Team row and effective enrollment rows before counting active members, preventing concurrent member requests from exceeding the limit.

## End vs Cancel
End/Cancel must use `transition_team_enrollment(...)`:
- End: enrollment becomes `ended`; Program becomes `completed`.
- Cancel: enrollment becomes `cancelled`; Program becomes `cancelled`; non-completed sessions become `cancelled`.

Neither action deletes enrollments, programs, sessions, memberships, or athlete results.

## Result JSON Boundary
`athlete_team_session_results` keeps stable session-level fields normalized:
- `status`
- `started_at`
- `completed_at`
- `notes`

`result_json` should hold only non-standard or future metrics that are not stable enough for dedicated columns yet.

## Future Sales / Payment Link
Future Sales, Stripe, ECPay, subscriptions, marketplace entitlements, or season licenses should link to `team_product_enrollments.id`. That row represents the Team's entitlement to a specific Product Version.

Payment should not directly control Team Program Sessions. Payment validates or changes entitlement/enrollment state; delivery tables preserve the training history.

## Future Pricing Compatibility
The model can support:
- team flat fee
- per-seat pricing
- season license
- subscription
- unlimited roster

Those billing concepts should be added through commerce/sales tables, not by changing Team Program content tables.
