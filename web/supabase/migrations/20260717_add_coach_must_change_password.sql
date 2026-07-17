-- Add coach-side temporary password gate to match athlete first-login flow.
-- Apply before deploying code that reads public.coaches.must_change_password.

alter table public.coaches
  add column if not exists must_change_password boolean not null default false;
