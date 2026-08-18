# Supabase migration workspace

Source DB for current baseline:

`botica_db_staging_20260817_231749`

Baseline:

`supabase/migrations/20260818000100_baseline_schema.sql`

Rules:

1. Do not edit production DB manually.
2. Add every future schema change as new SQL migration.
3. Use `--no-owner --no-privileges` for Supabase-ready dumps.
4. Test restore before touching cloud.
5. RLS/security comes after baseline, before production.

Current status:

- Fase 0 backup: OK.
- Fase 1 staging: OK.
- Fase 2 data cleanup: OK.
- Fase 3 model/index/guards: OK.
- Fase 4 catalogs/prices: OK.
- Fase 5 migration baseline: OK.
- Fase 6 RLS/security: OK.
- Fase 7 Supabase staging: pending.
