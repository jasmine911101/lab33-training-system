-- Development-only permissions while login/auth is disabled in Streamlit.
-- Run this in Supabase SQL Editor if inserts fail with:
-- "new row violates row-level security policy" or "permission denied".

alter table public.athletes disable row level security;
alter table public.periods disable row level security;
alter table public.period_blocks disable row level security;
alter table public.athlete_programs disable row level security;
alter table public.athlete_program_blocks disable row level security;

grant usage on schema public to anon;

grant select, insert, update, delete on table public.athletes to anon;
grant select, insert, update, delete on table public.periods to anon;
grant select, insert, update, delete on table public.period_blocks to anon;
grant select, insert, update, delete on table public.athlete_programs to anon;
grant select, insert, update, delete on table public.athlete_program_blocks to anon;

grant usage, select on all sequences in schema public to anon;
