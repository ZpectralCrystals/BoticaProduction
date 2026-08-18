-- =============================================================
-- Migracion 028: RLS backend-only pre-Supabase (staging)
-- Fecha: Agosto 2026
-- Alcance: solo DB staging local.
--
-- Objetivos:
--   1) Activar RLS en todas las tablas publicas.
--   2) Bloquear acceso directo anon/authenticated por defecto.
--   3) Evitar bypass por views con security_invoker=true.
--   4) Revocar execute publico de funciones RPC.
--
-- Modelo elegido:
--   Backend-only. Frontend no consulta Supabase directo.
--   Fastify usa conexion server-side. service_role/postgres nunca en frontend.
-- =============================================================

BEGIN;

DO $$
BEGIN
  IF current_database() NOT LIKE 'botica_db_staging_%' THEN
    RAISE EXCEPTION 'Migration 028 blocked: current database % is not staging', current_database();
  END IF;
END $$;

-- 1) RLS en todas las tablas publicas.
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

-- 2) Grants: cliente directo bloqueado por defecto.
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

-- 3) Views invoker: respetan RLS de tablas base en Postgres 15+.
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

-- 4) Functions: no RPC publico por defecto.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

-- 5) Default privileges: prevenir grants futuros a client roles si existen.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', role_name);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

INSERT INTO bot_auditoria (
  nusuario_id,
  cusuario,
  caccion,
  ctabla,
  nregistro_id,
  cdetalle,
  cip,
  tcreado
)
VALUES (
  NULL,
  'system',
  'SUPABASE_RLS_FASE6',
  'schema_security',
  NULL,
  'RLS habilitado en tablas publicas; anon/authenticated bloqueados; views security_invoker; execute publico revocado.',
  '127.0.0.1',
  CURRENT_TIMESTAMP
);

COMMIT;
