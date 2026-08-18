# Runbook migracion DB a Supabase

Proyecto: BoticaElPueblo-RebrandLab  
DB limpia actual: botica_db_staging_20260817_231749  
Fecha: 2026-08-18  

## Principio

Produccion no se toca sin restore-test verde.

## Archivos fuente

Baseline schema:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/supabase/migrations/20260818000100_baseline_schema.sql`

Dump limpio post-fase6/RLS:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase6_rls_20260818_0032.dump`

Schema limpio:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/schema_staging_clean_after_fase6_rls_20260818_0032.sql`

Data-only limpio:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/data_only_staging_clean_after_fase6_rls_20260818_0032.sql`

Checksums:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/SHA256SUMS.txt`

## Scripts

Auditoria:

```bash
scripts/db-audit-supabase-ready.sh botica_db_staging_20260817_231749
```

Restore-test:

```bash
scripts/db-restore-test.sh \
  backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase6_rls_20260818_0032.dump \
  supabase/migrations/20260818000600_rls_backend_only.sql
```

Mantener DB de prueba:

```bash
KEEP_RESTORE_DB=1 scripts/db-restore-test.sh \
  backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase6_rls_20260818_0032.dump \
  supabase/migrations/20260818000600_rls_backend_only.sql
```

Cliente PostgreSQL:

Supabase usa PostgreSQL 17. Para dumps remotos usar cliente 17:

```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump --version
```

No usar `pg_dump` 15 contra Supabase 17: aborta por version mismatch.

## Flujo Supabase staging

1. Crear proyecto Supabase staging.
2. Guardar connection string en variable local, no en repo.
3. Configurar search_path para Supabase pooler:

```bash
export PGOPTIONS='--search_path=public,extensions'
```

Alternativa en `DATABASE_URL`:

```txt
?sslmode=require&options=--search_path%3Dpublic%2Cextensions
```

Sin esto, el pooler puede devolver `search_path` vacio y queries legacy sin `public.` fallan.
4. Restaurar dump:

```bash
pg_restore --no-owner --no-privileges -d "$SUPABASE_STAGING_DB_URL" \
  backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase6_rls_20260818_0032.dump
```

5. Aplicar migracion seguridad post-restore:

```bash
psql "$SUPABASE_STAGING_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260818000600_rls_backend_only.sql
```

Nota:

`pg_dump --no-privileges` no conserva todos los `REVOKE`. Por eso esta migracion post-restore es obligatoria.

6. Ejecutar auditoria:

```bash
scripts/db-audit-supabase-ready.sh "$SUPABASE_STAGING_DB_URL"
```

7. Ejecutar smoke test app completa.
8. Hacer backup Supabase staging.

## Backend local contra Supabase staging

Variables minimas:

```bash
BOTICA_DB_HOST=aws-0-ca-central-1.pooler.supabase.com
BOTICA_DB_PORT=6543
BOTICA_DB_NAME=postgres
BOTICA_DB_USER=postgres.<project_id>
BOTICA_DB_PASS=<password>
BOTICA_DB_SSL=require
BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false
PGOPTIONS='--search_path=public,extensions'
JWT_SECRET=<secret-local-o-produccion>
CORS_ORIGIN=http://localhost:5174
```

Notas:

- No guardar password en repo.
- `BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false` fue necesario en Mac local por cadena de certificado del pooler.
- En servidor final, preferir CA valida y `BOTICA_DB_SSL_REJECT_UNAUTHORIZED=true` si el entorno lo soporta.

## Smoke test minimo

- Login.
- Inventario lista.
- Compra crea lote.
- Kardex registra compra.
- Venta consume lote FEFO.
- Venta no permite vencidos.
- Caja abierta obligatoria.
- Anulacion revierte stock.
- Reportes cargan.
- Consistencia stock/lotes verde.

## Criterio verde pre-produccion

- Restore-test local OK.
- Auditoria blockers 0.
- RLS/policies OK.
- Backend tests OK.
- Smoke test staging OK.
- Backup Supabase staging OK.
- Rollback documentado.

## Rollback

Antes de corte:

1. Backup final local.
2. Backup Supabase pre-cut.
3. Guardar env anterior.

Si falla corte:

1. Revertir `DATABASE_URL` backend al origen anterior.
2. Reiniciar backend.
3. Verificar login/inventario/venta.
4. Mantener Supabase fallido congelado para diagnostico.

## Seguridad actual

Fase 6 aplicada en staging.

Auditoria esperada:

- RLS enabled tables: 38.
- RLS policies: 0.
- Views security_invoker: 4.
- Client grants anon/authenticated: 0.
- Function public execute grants: 0 despues de post-migration.
