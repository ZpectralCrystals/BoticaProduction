# Status DB productiva Supabase - Fase 2

Proyecto: BoticaElPueblo-RebrandLab  
DB staging: botica_db_staging_20260817_231749  
Fecha operativa: 2026-08-17 23:22 America/Lima  
Objetivo: limpiar bloqueantes de datos antes de Supabase.

## Resultado

Fase 2: completada en staging.

No se modifico `botica_db`.

## Migracion aplicada

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/ops/migrations/025_supabase_cleanup_bloqueantes_staging.sql`

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/migration_025_apply.log`

La migracion tiene guard:

`current_database() LIKE 'botica_db_staging_%'`

Esto evita aplicarla por error en la DB principal.

## Cambios ejecutados en staging

### Lote vencido bloqueado

| Campo | Valor |
|---|---|
| Producto | Simvastatina 20 mg (Merck) |
| Codigo | CAR-057 |
| Lote | MK-7741 |
| Vencimiento | 2026-06-28 |
| Cantidad | 150 |
| Estado anterior | ACTIVO |
| Estado nuevo | VENCIDO |

### Stock recalculado

Stock producto recalculado desde lotes `ACTIVO`.

| Producto | Antes | Despues | Lotes activos | Diff final |
|---|---:|---:|---:|---:|
| CAR-057 | 150 | 0 | 0 | 0 |
| MED-059 | 7 | 6 | 6 | 0 |
| MED-060 | 7 | 6 | 6 | 0 |
| MED-061 | 7 | 6 | 6 | 0 |
| MED-062 | 7 | 6 | 6 | 0 |

## Auditoria post-fix

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_staging_post_fix_fase2.txt`

Resultado:

| Check | Antes | Despues |
|---|---:|---:|
| Lotes activos vencidos con stock | 1 | 0 |
| Productos stock vs lotes mismatch | 4 | 0 |
| Compras credito sin CXP | 0 | 0 |
| Ventas sin detalle | 0 | 0 |
| Compras sin detalle | 0 | 0 |

## Auditoria registrada en DB

Se insertaron 6 filas en `bot_auditoria`:

- 1 registro para lote vencido.
- 5 registros para productos recalculados.

IDs auditoria:

- 133 a 138.

## Estado actual

Bloqueantes de datos: 0.

Pendientes fuertes:

1. Corregir modelo DB e indices.
2. Crear baseline/migraciones reproducibles.
3. Resolver catalogos y precios canonicos.
4. Diseñar RLS/seguridad Supabase.
5. Ensayo Supabase staging.

## Siguiente fase

Fase 3: modelo DB.

Acciones:

1. Corregir FK duplicada `bot_compras.nusuario_id`.
2. Crear indices FK de alto trafico.
3. Agregar checks/consultas para impedir stock fantasma.
4. Revisar bloqueo de venta de vencidos en backend/DB.

Confirmacion requerida antes de aplicar Fase 3.
