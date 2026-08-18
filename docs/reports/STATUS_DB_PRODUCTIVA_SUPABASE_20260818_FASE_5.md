# Status DB productiva Supabase - Fase 5

Proyecto: BoticaElPueblo-RebrandLab  
DB staging: botica_db_staging_20260817_231749  
Fecha operativa: 2026-08-18 00:24 America/Lima  
Objetivo: crear migraciones versionadas, baseline y prueba de restore.

## Resultado

Fase 5: completada.

No se modifico `botica_db`.

## Baseline Supabase

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/supabase/migrations/20260818000100_baseline_schema.sql`

Origen:

`botica_db_staging_20260817_231749`

Tamano:

- 3880 lineas.

Uso:

- Baseline schema para nueva DB Supabase/staging.
- No incluye owners ni privileges.

## Dumps limpios post-fase4

Carpeta:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749`

Archivos nuevos:

- `botica_db_staging_clean_after_fase4_20260818_0020.dump`
- `schema_staging_clean_after_fase4_20260818_0020.sql`
- `data_only_staging_clean_after_fase4_20260818_0020.sql`
- `restore_list_staging_clean_after_fase4_20260818_0020.txt`

Dump limpio:

- 202K.

Checksums:

- Actualizados en `SHA256SUMS.txt`.

## Scripts creados

Auditoria DB:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/scripts/db-audit-supabase-ready.sh`

Restore-test:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/scripts/db-restore-test.sh`

Ambos ejecutables.

## Auditoria Fase 5

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_fase5_staging_ready.txt`

Resultado:

| Check | Resultado |
|---|---:|
| Tables | 38 |
| Views | 4 |
| RLS enabled tables | 0 |
| RLS policies | 0 |
| Lotes vencidos activos con stock | 0 |
| Stock vs lotes mismatch | 0 |
| Productos sin familia ID | 0 |
| Productos sin categoria ID | 0 |
| Productos sin PRECIO_1 | 0 |
| Compras sin detalle | 0 |
| Ventas sin detalle | 0 |
| FK compras usuario | 1 |

Nota:

RLS 0 es esperado. Se corrige en Fase 6.

## Restore-test

Script ejecutado:

```bash
scripts/db-restore-test.sh backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase4_20260818_0020.dump
```

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/restore_test_fase5.log`

Resultado:

- DB temporal creada.
- Dump restaurado.
- Auditoria ejecutada.
- Blockers 0.
- DB temporal eliminada.

## Runbook

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/docs/reports/MIGRACION_DB_RUNBOOK_SUPABASE.md`

Incluye:

- Archivos fuente.
- Comandos restore.
- Auditoria.
- Smoke test.
- Criterio verde.
- Rollback.

## README Supabase

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/supabase/README.md`

## Estado actual

Fase 0: OK.  
Fase 1: OK.  
Fase 2: OK.  
Fase 3: OK.  
Fase 4: OK.  
Fase 5: OK.

Pendiente:

1. Fase 6: RLS/seguridad Supabase.
2. Fase 7: Supabase staging.
3. Fase 8: hardening operativo.
4. Fase 9: corte productivo.

## Siguiente fase

Fase 6: RLS/seguridad.

Acciones:

1. Decidir modelo: backend-only primero.
2. Crear migracion RLS base.
3. Bloquear anon/authenticated directo por defecto.
4. Mantener access via backend/service connection.
5. Documentar matriz roles.
6. Auditar que frontend no usa service key.

Confirmacion requerida antes de aplicar Fase 6.
