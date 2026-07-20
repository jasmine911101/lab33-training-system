-- Block Taxonomy UX/Management hardening
-- Adds archive timestamps and safe transaction RPCs for taxonomy deletion/archive.

alter table public.block_taxonomy_sports
  add column if not exists archived_at timestamp with time zone;

alter table public.block_taxonomy_age_groups
  add column if not exists archived_at timestamp with time zone;

alter table public.block_taxonomy_training_categories
  add column if not exists archived_at timestamp with time zone;

create index if not exists idx_block_taxonomy_sports_active_name
  on public.block_taxonomy_sports (is_active, lower(btrim(name)));

create index if not exists idx_block_taxonomy_age_groups_active_parent_name
  on public.block_taxonomy_age_groups (sport_id, is_active, lower(btrim(name)));

create index if not exists idx_block_taxonomy_categories_active_parent_name
  on public.block_taxonomy_training_categories (age_group_id, is_active, lower(btrim(name)));

create or replace function public.delete_block_taxonomy_node(
  p_node_type text,
  p_node_id bigint,
  p_confirmation_name text,
  p_actor_coach_id bigint,
  p_actor_is_head_coach boolean
)
returns void
language plpgsql
as $$
declare
  target_name text;
  target_sport_ids bigint[] := array[]::bigint[];
  target_age_group_ids bigint[] := array[]::bigint[];
  target_category_ids bigint[] := array[]::bigint[];
  target_block_ids bigint[] := array[]::bigint[];
  usage_count integer := 0;
  product_ref_count integer := 0;
  schedule_ref_count integer := 0;
  program_ref_count integer := 0;
begin
  if p_actor_coach_id is null then
    raise exception '未登入教練，無法刪除分類。';
  end if;

  if p_node_type = 'sport' then
    select name into target_name
    from public.block_taxonomy_sports
    where id = p_node_id
    for update;

    if target_name is null then raise exception '找不到分類。'; end if;
    target_sport_ids := array[p_node_id];

    select coalesce(array_agg(id), array[]::bigint[]) into target_age_group_ids
    from public.block_taxonomy_age_groups
    where sport_id = any(target_sport_ids);

    select coalesce(array_agg(id), array[]::bigint[]) into target_category_ids
    from public.block_taxonomy_training_categories
    where age_group_id = any(target_age_group_ids);
  elsif p_node_type = 'age_group' then
    select name into target_name
    from public.block_taxonomy_age_groups
    where id = p_node_id
    for update;

    if target_name is null then raise exception '找不到分類。'; end if;
    target_age_group_ids := array[p_node_id];

    select coalesce(array_agg(id), array[]::bigint[]) into target_category_ids
    from public.block_taxonomy_training_categories
    where age_group_id = any(target_age_group_ids);
  elsif p_node_type = 'training_category' then
    select name into target_name
    from public.block_taxonomy_training_categories
    where id = p_node_id
    for update;

    if target_name is null then raise exception '找不到分類。'; end if;
    target_category_ids := array[p_node_id];
  else
    raise exception '分類類型不正確。';
  end if;

  if btrim(coalesce(p_confirmation_name, '')) <> btrim(target_name) then
    raise exception '確認名稱不符合分類名稱。';
  end if;

  select coalesce(array_agg(id), array[]::bigint[]) into target_block_ids
  from public.blocks
  where training_category_id = any(target_category_ids);

  if cardinality(target_block_ids) > 0 then
    if to_regclass('public.training_product_blocks') is not null then
      execute 'select count(*) from public.training_product_blocks where block_id = any($1)'
        into product_ref_count
        using target_block_ids;
    end if;

    if to_regclass('public.athlete_blocks') is not null then
      execute 'select count(*) from public.athlete_blocks where block_id = any($1)'
        into schedule_ref_count
        using target_block_ids;
    end if;

    if to_regclass('public.athlete_program_blocks') is not null then
      execute 'select count(*) from public.athlete_program_blocks where block_id = any($1)'
        into program_ref_count
        using target_block_ids;
    end if;
  end if;

  usage_count := coalesce(product_ref_count, 0) + coalesce(schedule_ref_count, 0) + coalesce(program_ref_count, 0);
  if usage_count > 0 then
    raise exception 'CATEGORY_IN_USE: 此分類內有板塊正在被商品、課表或方案使用，無法永久刪除。';
  end if;

  if cardinality(target_block_ids) > 0 then
    delete from public.block_exercises where block_id = any(target_block_ids);
    delete from public.block_sections where block_id = any(target_block_ids);
    delete from public.blocks where id = any(target_block_ids);
  end if;

  if cardinality(target_category_ids) > 0 then
    delete from public.block_taxonomy_training_categories where id = any(target_category_ids);
  end if;

  if cardinality(target_age_group_ids) > 0 then
    delete from public.block_taxonomy_age_groups where id = any(target_age_group_ids);
  end if;

  if cardinality(target_sport_ids) > 0 then
    delete from public.block_taxonomy_sports where id = any(target_sport_ids);
  end if;
end;
$$;

create or replace function public.archive_block_taxonomy_node(
  p_node_type text,
  p_node_id bigint,
  p_actor_coach_id bigint,
  p_actor_is_head_coach boolean
)
returns void
language plpgsql
as $$
declare
  target_sport_ids bigint[] := array[]::bigint[];
  target_age_group_ids bigint[] := array[]::bigint[];
  target_category_ids bigint[] := array[]::bigint[];
  archived_time timestamp with time zone := now();
begin
  if p_actor_coach_id is null then
    raise exception '未登入教練，無法封存分類。';
  end if;

  if p_node_type = 'sport' then
    if not exists (select 1 from public.block_taxonomy_sports where id = p_node_id) then raise exception '找不到分類。'; end if;
    target_sport_ids := array[p_node_id];
    select coalesce(array_agg(id), array[]::bigint[]) into target_age_group_ids from public.block_taxonomy_age_groups where sport_id = any(target_sport_ids);
    select coalesce(array_agg(id), array[]::bigint[]) into target_category_ids from public.block_taxonomy_training_categories where age_group_id = any(target_age_group_ids);
  elsif p_node_type = 'age_group' then
    if not exists (select 1 from public.block_taxonomy_age_groups where id = p_node_id) then raise exception '找不到分類。'; end if;
    target_age_group_ids := array[p_node_id];
    select coalesce(array_agg(id), array[]::bigint[]) into target_category_ids from public.block_taxonomy_training_categories where age_group_id = any(target_age_group_ids);
  elsif p_node_type = 'training_category' then
    if not exists (select 1 from public.block_taxonomy_training_categories where id = p_node_id) then raise exception '找不到分類。'; end if;
    target_category_ids := array[p_node_id];
  else
    raise exception '分類類型不正確。';
  end if;

  if cardinality(target_category_ids) > 0 then
    update public.block_taxonomy_training_categories set is_active = false, archived_at = archived_time, updated_at = archived_time where id = any(target_category_ids);
  end if;
  if cardinality(target_age_group_ids) > 0 then
    update public.block_taxonomy_age_groups set is_active = false, archived_at = archived_time, updated_at = archived_time where id = any(target_age_group_ids);
  end if;
  if cardinality(target_sport_ids) > 0 then
    update public.block_taxonomy_sports set is_active = false, archived_at = archived_time, updated_at = archived_time where id = any(target_sport_ids);
  end if;
end;
$$;

revoke execute on function public.delete_block_taxonomy_node(text, bigint, text, bigint, boolean) from public, anon, authenticated;
revoke execute on function public.archive_block_taxonomy_node(text, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.delete_block_taxonomy_node(text, bigint, text, bigint, boolean) to service_role;
grant execute on function public.archive_block_taxonomy_node(text, bigint, bigint, boolean) to service_role;
