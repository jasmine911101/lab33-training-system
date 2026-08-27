-- Backfill the provenance of older accounts created by the team's batch-account flow.
-- The flow uses the reserved @team.lab33.local address and assigns the account to one active team.
begin;

update public.athletes as athlete
set created_for_team_id = membership.team_id
from public.shared_training_memberships as membership
where membership.athlete_id = athlete.id
  and membership.is_active
  and athlete.created_for_team_id is null
  and athlete.email ilike '%@team.lab33.local'
  and not exists (
    select 1
    from public.shared_training_memberships as other_membership
    where other_membership.athlete_id = athlete.id
      and other_membership.is_active
      and other_membership.team_id <> membership.team_id
  );

commit;
