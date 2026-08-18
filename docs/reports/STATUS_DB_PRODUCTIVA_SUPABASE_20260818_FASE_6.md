# Status DB productiva Supabase - Fase 6

Proyecto: BoticaElPueblo-RebrandLab  
DB staging: botica_db_staging_20260817_231749  
Fecha operativa: 2026-08-18 00:32 America/Lima  
Objetivo: seguridad Supabase/RLS con modelo backend-only.

## Resultado

Fase 6: completada en staging.

No se modifico `botica_db`.

## Resumen de avance global

| Fase | Estado | Resultado |
|---|---|---|
| F0 Backup | OK | Dump/schema/data/checksum creados |
| F1 Staging | OK | DB staging restaurada |
| F2 Datos | OK | Vencidos/stock mismatch corregidos |
| F3 Modelo | OK | FK, indices, triggers, stock fantasma bloqueado |
| F4 Catalogos/precios | OK | Familias/categorias/precios canonicos poblados |
| F5 Migraciones | OK | Baseline, scripts, restore-test, runbook |
| F6 Seguridad/RLS | OK | RLS 38/38, backend-only, grants cliente bloqueados |
| F7 Supabase staging | Pendiente | Probar en nube |
| F8 Hardening | Pendiente | Backups/monitor/ops |
| F9 Corte | Pendiente | Produccion |

## Modelo elegido

Backend-only.

Frontend no debe consultar Supabase directo.

Todo pasa por Fastify:

- Auth app.
- Permisos app.
- Validaciones negocio.
- Auditoria.
- Conexion DB server-side.

## Migraciones creadas/aplicadas

Staging-only:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/ops/migrations/028_supabase_rls_backend_only_staging.sql`

Supabase real:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/supabase/migrations/20260818000600_rls_backend_only.sql`

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/migration_028_apply.log`

## Controles aplicados

| Control | Resultado |
|---|---:|
| Tablas publicas con RLS | 38/38 |
| Tablas publicas sin RLS | 0 |
| Policies cliente | 0 |
| Views security_invoker | 4/4 |
| Grants anon/authenticated | 0 en local |
| Function public execute grants | 0 tras post-migration |
| Probe rol sin permisos | Denied esperado |

## Auditorias

Auditoria post-fix:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_staging_post_fix_fase6.txt`

Auditoria script actualizado:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_fase6_staging_ready.txt`

Probe RLS:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/fase6_rls_probe_test.log`

Resultado probe:

`permission denied for table bot_productos`

Esto es correcto.

## Dump limpio post-RLS

Archivos:

- `botica_db_staging_clean_after_fase6_rls_20260818_0032.dump`
- `schema_staging_clean_after_fase6_rls_20260818_0032.sql`
- `data_only_staging_clean_after_fase6_rls_20260818_0032.sql`
- `restore_list_staging_clean_after_fase6_rls_20260818_0032.txt`

Checksums:

Actualizados en `SHA256SUMS.txt`.

## Restore-test final

Importante:

`pg_dump --no-privileges` no conserva todos los `REVOKE`. Por eso el restore real debe aplicar migracion RLS post-restore.

Comando validado:

```bash
scripts/db-restore-test.sh \
  backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase6_rls_20260818_0032.dump \
  supabase/migrations/20260818000600_rls_backend_only.sql
```

Resultado:

- Restore OK.
- RLS 38/38.
- Views invoker 4/4.
- Client grants 0.
- Public execute grants 0.
- Blockers 0.

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/restore_test_fase6_rls_with_post_migration.log`

## Validacion backend

Typecheck:

`npx tsc --noEmit`

Resultado: OK.

Suite completa:

`npm test -- --run`

Resultado:

- 15 archivos OK.
- 133 tests OK.

## Docs actualizados

- `docs/reports/MATRIZ_SEGURIDAD_SUPABASE_FASE6.md`
- `docs/reports/MIGRACION_DB_RUNBOOK_SUPABASE.md`
- `supabase/README.md`
- `scripts/db-audit-supabase-ready.sh`
- `scripts/db-restore-test.sh`

## Nota Supabase

Supabase recomienda RLS en tablas del schema expuesto, especialmente `public`. Sin policies, acceso via publishable key queda bloqueado. Este es el estado deseado para backend-only.

Fuentes:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/postgres/roles

## Siguiente fase

Fase 7: Supabase staging.

Acciones:

1. Crear proyecto Supabase staging.
2. Guardar `SUPABASE_STAGING_DB_URL` local.
3. Restaurar dump post-RLS.
4. Aplicar `20260818000600_rls_backend_only.sql`.
5. Ejecutar audit script.
6. Apuntar backend local a Supabase staging.
7. Smoke test completo.

Confirmacion requerida antes de Fase 7 porque necesita credencial/URL Supabase staging.
