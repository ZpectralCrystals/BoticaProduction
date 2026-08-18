# Status DB productiva Supabase - Fase 7

Proyecto local: BoticaElPueblo-RebrandLab  
Supabase project ID: hzekajqbtzzigvlmrdaa  
Region: ca-central-1  
Fecha operativa: 2026-08-18 00:45 America/Lima  
Objetivo: restaurar staging limpio en Supabase y auditar nube.

## Resultado

Fase 7: completada a nivel DB Supabase staging.

No se modifico `botica_db`.

## Conexion usada

Pooler Supabase:

`aws-0-ca-central-1.pooler.supabase.com:6543`

Usuario:

`postgres.<project_id>`

Nota:

No se guardo password en repo.

## Restore

Dump restaurado:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/botica_db_staging_clean_after_fase6_rls_20260818_0032.dump`

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/supabase_restore_fase7.log`

Pre-restore:

- `public`: 0 tablas.

Post-restore:

- `public`: 38 tablas.

## RLS post-restore

Migracion aplicada:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/supabase/migrations/20260818000600_rls_backend_only.sql`

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/supabase_rls_post_restore_fase7.log`

## Search path

Hallazgo:

Pooler Supabase devolvio `search_path` vacio.

Impacto:

Backend actual usa queries sin prefijo `public.`. Sin fix, fallan con:

`relation "bot_productos" does not exist`

Fix validado:

```bash
PGOPTIONS='--search_path=public,extensions'
```

Alternativa en `DATABASE_URL`:

```txt
?sslmode=require&options=--search_path%3Dpublic%2Cextensions
```

El audit script ya exporta este `PGOPTIONS` por defecto.

## Auditoria Supabase

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/supabase_audit_fase7_ready.txt`

Resultado:

| Check | Resultado |
|---|---:|
| Public tables | 38 |
| Public views | 4 |
| RLS enabled tables | 38 |
| RLS policies | 0 |
| Familias | 3 |
| Categorias | 11 |
| Productos | 62 |
| Lotes | 74 |
| Kardex | 113 |
| Compras | 59 |
| Ventas | 22 |
| Precios canonicos | 120 |
| Historial precios | 120 |
| Lotes vencidos activos con stock | 0 |
| Stock vs lotes mismatch | 0 |
| Productos sin familia ID | 0 |
| Productos sin categoria ID | 0 |
| Productos sin PRECIO_1 | 0 |
| Compras sin detalle | 0 |
| Ventas sin detalle | 0 |
| FK compras usuario | 1 |
| Views security_invoker | 4 |
| Grants anon/authenticated | 0 |
| Public execute grants | 0 |

## Seguridad

Modelo:

Backend-only.

Estado:

- `anon`: sin grants.
- `authenticated`: sin grants.
- RLS ON.
- Sin policies cliente.

Esto bloquea Data API directo para tablas privadas. Fastify debe ser unico camino operativo.

## F7 app smoke

Estado:

OK.

Backend local conectado contra Supabase staging via pooler.

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/docs/reports/STATUS_DB_PRODUCTIVA_SUPABASE_20260818_FASE_7_SMOKE_APP.md`

Env requerido:

- `BOTICA_DB_HOST=aws-0-ca-central-1.pooler.supabase.com`
- `BOTICA_DB_PORT=6543`
- `BOTICA_DB_NAME=postgres`
- `BOTICA_DB_USER=postgres.<project_id>`
- `BOTICA_DB_SSL=require`
- `BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false`
- `PGOPTIONS=--search_path=public,extensions`

No guardar password en repo.

## Estado global

| Fase | Estado |
|---|---|
| F0 Backup | OK |
| F1 Staging local | OK |
| F2 Limpieza datos | OK |
| F3 Modelo/indices/guards | OK |
| F4 Catalogos/precios | OK |
| F5 Baseline/restore-test | OK |
| F6 Seguridad/RLS | OK |
| F7 Supabase DB staging | OK |
| F7 App smoke contra nube | OK |
| F8 Hardening ops | Pendiente |
| F9 Corte produccion | Pendiente |

## Siguiente paso

F8 hardening ops:

1. Crear plantilla env segura fuera de git para local/nube.
2. Preparar backup Supabase staging post-restore.
3. Definir corte backend: origen DB local -> Supabase.
4. Rotar password DB antes de produccion.
5. Ejecutar smoke funcional con escritura controlada.
