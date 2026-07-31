-- Align development's runtime security surface with the live Pilot project.
-- This is intentionally forward-only: it does not remove development-only tables.
BEGIN;

CREATE SCHEMA IF NOT EXISTS pilot_security;
REVOKE ALL ON SCHEMA pilot_security FROM PUBLIC;
GRANT USAGE ON SCHEMA pilot_security TO authenticated;

CREATE OR REPLACE FUNCTION pilot_security.current_coach_id() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT c.id FROM public.coaches c WHERE (SELECT auth.uid()) IS NOT NULL AND c.user_id = (SELECT auth.uid()) LIMIT 1; $$;
CREATE OR REPLACE FUNCTION pilot_security.current_athlete_id() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT a.id FROM public.athletes a WHERE (SELECT auth.uid()) IS NOT NULL AND a.user_id = (SELECT auth.uid()) LIMIT 1; $$;
CREATE OR REPLACE FUNCTION pilot_security.is_head_coach() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = (SELECT pilot_security.current_coach_id()) AND c.is_head_coach IS TRUE); $$;
CREATE OR REPLACE FUNCTION pilot_security.is_app_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT (SELECT pilot_security.current_coach_id()) IS NOT NULL OR (SELECT pilot_security.current_athlete_id()) IS NOT NULL; $$;
CREATE OR REPLACE FUNCTION pilot_security.can_manage_athlete(target_athlete_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT target_athlete_id IS NOT NULL AND ((SELECT pilot_security.is_head_coach()) OR EXISTS (SELECT 1 FROM public.coach_athletes ca WHERE ca.coach_id = (SELECT pilot_security.current_coach_id()) AND ca.athlete_id = target_athlete_id)); $$;
CREATE OR REPLACE FUNCTION pilot_security.owns_athlete(target_athlete_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT target_athlete_id IS NOT NULL AND target_athlete_id = (SELECT pilot_security.current_athlete_id()); $$;
CREATE OR REPLACE FUNCTION pilot_security.password_change_required() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT (SELECT auth.uid()) IS NOT NULL AND (EXISTS (SELECT 1 FROM public.coaches c WHERE c.user_id = (SELECT auth.uid()) AND c.must_change_password IS TRUE) OR EXISTS (SELECT 1 FROM public.athletes a WHERE a.user_id = (SELECT auth.uid()) AND a.must_change_password IS TRUE)); $$;

REVOKE ALL ON FUNCTION pilot_security.current_coach_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION pilot_security.current_athlete_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION pilot_security.is_head_coach() FROM PUBLIC;
REVOKE ALL ON FUNCTION pilot_security.is_app_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION pilot_security.can_manage_athlete(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION pilot_security.owns_athlete(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION pilot_security.password_change_required() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pilot_security.current_coach_id() TO authenticated;
GRANT EXECUTE ON FUNCTION pilot_security.current_athlete_id() TO authenticated;
GRANT EXECUTE ON FUNCTION pilot_security.is_head_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION pilot_security.is_app_member() TO authenticated;
GRANT EXECUTE ON FUNCTION pilot_security.can_manage_athlete(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION pilot_security.owns_athlete(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION pilot_security.password_change_required() TO authenticated;

ALTER TABLE public.athlete_block_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_taxonomy_age_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_taxonomy_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_taxonomy_training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

DO $policies$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('athlete_block_exercises', 'athlete_blocks', 'athlete_events', 'athletes', 'block_exercises', 'block_sections', 'block_taxonomy_age_groups', 'block_taxonomy_sports', 'block_taxonomy_training_categories', 'blocks', 'coach_athletes', 'coaches')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$policies$;

REVOKE ALL PRIVILEGES ON TABLE public.athlete_block_exercises, public.athlete_blocks, public.athlete_events, public.athletes, public.block_exercises, public.block_sections, public.block_taxonomy_age_groups, public.block_taxonomy_sports, public.block_taxonomy_training_categories, public.blocks, public.coach_athletes, public.coaches FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.athlete_block_exercises_id_seq, public.athlete_blocks_id_seq, public.athlete_events_id_seq, public.athletes_id_seq, public.block_exercises_id_seq, public.block_sections_id_seq, public.block_taxonomy_age_groups_id_seq, public.block_taxonomy_sports_id_seq, public.block_taxonomy_training_categories_id_seq, public.blocks_id_seq, public.coach_athletes_id_seq, public.coaches_id_seq FROM anon, authenticated;

GRANT SELECT ON TABLE public.athlete_block_exercises, public.athlete_blocks, public.athletes, public.block_exercises, public.block_sections, public.block_taxonomy_age_groups, public.block_taxonomy_sports, public.block_taxonomy_training_categories, public.blocks, public.coach_athletes, public.coaches TO authenticated;
GRANT UPDATE (actual_sets, actual_weight) ON public.athlete_block_exercises TO authenticated;
GRANT SELECT, INSERT ON public.athlete_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.athlete_events_id_seq TO authenticated;

CREATE POLICY coaches_select_allowed ON public.coaches FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL AND (user_id = (SELECT auth.uid()) OR (SELECT pilot_security.current_coach_id()) IS NOT NULL));
CREATE POLICY athletes_select_allowed ON public.athletes FOR SELECT TO authenticated USING ((SELECT pilot_security.owns_athlete(id)) OR (SELECT pilot_security.can_manage_athlete(id)));
CREATE POLICY coach_athletes_select_allowed ON public.coach_athletes FOR SELECT TO authenticated USING (coach_id = (SELECT pilot_security.current_coach_id()) OR (SELECT pilot_security.is_head_coach()));
CREATE POLICY blocks_select_app_members ON public.blocks FOR SELECT TO authenticated USING ((SELECT pilot_security.is_app_member()));
CREATE POLICY block_sections_select_app_members ON public.block_sections FOR SELECT TO authenticated USING ((SELECT pilot_security.is_app_member()));
CREATE POLICY block_exercises_select_app_members ON public.block_exercises FOR SELECT TO authenticated USING ((SELECT pilot_security.is_app_member()));
CREATE POLICY taxonomy_sports_select_app_members ON public.block_taxonomy_sports FOR SELECT TO authenticated USING ((SELECT pilot_security.is_app_member()));
CREATE POLICY taxonomy_age_groups_select_app_members ON public.block_taxonomy_age_groups FOR SELECT TO authenticated USING ((SELECT pilot_security.is_app_member()));
CREATE POLICY taxonomy_categories_select_app_members ON public.block_taxonomy_training_categories FOR SELECT TO authenticated USING ((SELECT pilot_security.is_app_member()));
CREATE POLICY athlete_blocks_select_allowed ON public.athlete_blocks FOR SELECT TO authenticated USING ((SELECT pilot_security.owns_athlete(athlete_id)) OR (SELECT pilot_security.can_manage_athlete(athlete_id)));
CREATE POLICY athlete_block_exercises_select_allowed ON public.athlete_block_exercises FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.athlete_blocks ab WHERE ab.id = athlete_block_id AND ((SELECT pilot_security.owns_athlete(ab.athlete_id)) OR (SELECT pilot_security.can_manage_athlete(ab.athlete_id)))));
CREATE POLICY athlete_block_exercises_update_own_report ON public.athlete_block_exercises FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.athlete_blocks ab WHERE ab.id = athlete_block_id AND (SELECT pilot_security.owns_athlete(ab.athlete_id)))) WITH CHECK (EXISTS (SELECT 1 FROM public.athlete_blocks ab WHERE ab.id = athlete_block_id AND (SELECT pilot_security.owns_athlete(ab.athlete_id))));
CREATE POLICY athlete_events_select_allowed ON public.athlete_events FOR SELECT TO authenticated USING ((SELECT pilot_security.owns_athlete(athlete_id)) OR (SELECT pilot_security.can_manage_athlete(athlete_id)));
CREATE POLICY athlete_events_insert_own ON public.athlete_events FOR INSERT TO authenticated WITH CHECK ((SELECT pilot_security.owns_athlete(athlete_id)));

CREATE TABLE IF NOT EXISTS public.security_password_reset_audit (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('athlete', 'coach')),
  action text NOT NULL CHECK (action IN ('temporary_password_reset_attempt', 'temporary_password_reset')),
  reason text NOT NULL CHECK (char_length(reason) <= 500),
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_password_reset_audit_target_created_at_idx ON public.security_password_reset_audit (target_user_id, created_at DESC);
ALTER TABLE public.security_password_reset_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_password_reset_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.security_password_reset_audit FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.security_password_reset_audit_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.revoke_auth_sessions(target_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN IF target_user_id IS NULL THEN RAISE EXCEPTION 'target_user_id is required'; END IF; DELETE FROM auth.sessions WHERE user_id = target_user_id; END; $$;
REVOKE ALL ON FUNCTION public.revoke_auth_sessions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_auth_sessions(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_auth_sessions(uuid) TO service_role;

-- Development-only commerce/team objects are retained for possible later work, but
-- the Pilot application does not use them. Lock them to server-only access.
DO $lockdown$
DECLARE object_row record;
BEGIN
  FOR object_row IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('exercises', 'athlete_team_session_results', 'team_coaches', 'team_memberships', 'team_product_enrollments', 'team_program_instances', 'team_program_sessions', 'teams', 'training_product_blocks', 'training_product_versions', 'training_products')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', object_row.schemaname, object_row.tablename);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon, authenticated', object_row.schemaname, object_row.tablename);
  END LOOP;

  FOR object_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('exercises', 'athlete_team_session_results', 'team_coaches', 'team_memberships', 'team_product_enrollments', 'team_program_instances', 'team_program_sessions', 'teams', 'training_product_blocks', 'training_product_versions', 'training_products')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', object_row.policyname, object_row.schemaname, object_row.tablename);
  END LOOP;
END;
$lockdown$;

REVOKE ALL ON FUNCTION public.archive_block_taxonomy_node(text, bigint, bigint, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_block_taxonomy_node(text, bigint, bigint, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.add_or_reactivate_team_member(bigint, bigint, bigint, boolean), public.add_team_creator_as_owner(), public.archive_product(bigint, bigint, boolean), public.assign_product_version_to_team(bigint, bigint, bigint, boolean, date, date, integer, text), public.athlete_has_active_team_access(bigint), public.coach_can_manage_team(bigint), public.coach_can_manage_team_coaches(bigint), public.coach_can_manage_team_programs(bigint), public.coach_can_manage_team_roster(bigint), public.coach_can_view_team_results(bigint), public.coach_has_team_permission(bigint, text), public.current_coach_id(), public.current_coach_is_head(), public.delete_block_taxonomy_node(text, bigint, text, bigint, boolean), public.ensure_team_has_active_owner(), public.publish_product_version(bigint, bigint, bigint, boolean), public.replace_product_version_blocks(bigint, jsonb, bigint, boolean), public.rls_auto_enable(), public.transition_team_enrollment(bigint, text, bigint, boolean), public.unpublish_product(bigint, bigint, boolean) FROM PUBLIC, anon, authenticated;

COMMIT;
