-- =============================================================
-- Supabase migration: RLS backend-only
-- Fecha: Agosto 2026
--
-- Modelo elegido:
--   Backend-only. Frontend no consulta Supabase directo.
--   Fastify usa conexion server-side. service_role/postgres nunca en frontend.
--
-- Importante:
--   Sin policies cliente por ahora. anon/authenticated quedan bloqueados.
-- =============================================================

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS fqtn
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.fqtn);
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOR r IN
        SELECT format('%I.%I', n.nspname, c.relname) AS fqtn
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'v', 'm')
        ORDER BY c.relname
      LOOP
        EXECUTE format('REVOKE ALL ON %s FROM %I', r.fqtn, role_name);
      END LOOP;

      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I', schemaname, viewname) AS fqvn
    FROM pg_views
    WHERE schemaname = 'public'
    ORDER BY viewname
  LOOP
    EXECUTE format('ALTER VIEW %s SET (security_invoker = true)', r.fqvn);
  END LOOP;
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
