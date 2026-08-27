-- Record the team that created a batch-generated athlete account so deletion can be precise.
-- SET NULL preserves an account when a coach chooses to delete only the team.
begin;

alter table public.athletes
  add column created_for_team_id bigint references public.shared_training_teams(id) on delete set null;

create index athletes_created_for_team_idx
  on public.athletes(created_for_team_id)
  where created_for_team_id is not null;

commit;
