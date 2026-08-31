-- ===========================================================================
-- Migration 0003: least-privilege grants + defense-in-depth RLS
--
-- Authorization for this application is enforced in Express (server-side
-- sessions, roles, ownership checks). Supabase is reached ONLY through the
-- backend using the service-role key, which bypasses RLS. RLS here is a
-- second wall: if a non-service key ever reached these tables it would see
-- and do nothing. There are deliberately NO permissive `anon` policies.
--
-- This file is written to run both on a Supabase project (where the roles
-- `anon`, `authenticated`, `service_role` already exist) and on a plain
-- PostgreSQL cluster used for verification (where they do not).
-- ===========================================================================

SET search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Revoke the broad default grants PostgREST client roles receive.
--    Skip silently any role that does not exist on this cluster.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r    RECORD;
  rle  TEXT;
BEGIN
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rle) THEN
      CONTINUE;
    END IF;
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('REVOKE ALL ON public.%I FROM %I', r.tablename, rle);
    END LOOP;
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rle);
  END LOOP;
END;
$$;

-- Transactional business RPCs: never executable by anonymous / logged-in
-- PostgREST clients. Only the backend (service role / dedicated role) runs them.
DO $$
DECLARE
  fn   RECORD;
  rle  TEXT;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'bd\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rle) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', fn.sig, rle);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on every table. With no policies, anon/authenticated are
--    fully denied. service_role has BYPASSRLS, so the backend is unaffected.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Optional dedicated backend role for a self-hosted / direct-Postgres
--    deployment. On Supabase the backend uses the service-role key and needs
--    no extra grant; this role is harmless there.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blood_donation_backend') THEN
    CREATE ROLE blood_donation_backend NOLOGIN;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO blood_donation_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO blood_donation_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO blood_donation_backend;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'bd\_%'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO blood_donation_backend', fn.sig);
  END LOOP;
END;
$$;

-- Note: audit_logs UPDATE/DELETE is blocked by the append-only trigger from
-- migration 0001 regardless of role or grant.
