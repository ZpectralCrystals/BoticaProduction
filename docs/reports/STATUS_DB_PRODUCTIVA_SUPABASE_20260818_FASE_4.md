# Status DB productiva Supabase - Fase 4

Proyecto: BoticaElPueblo-RebrandLab  
DB staging: botica_db_staging_20260817_231749  
Fecha operativa: 2026-08-18 00:17 America/Lima  
Objetivo: normalizar catalogos producto y precios canonicos.

## Resultado

Fase 4: completada en staging.

No se modifico `botica_db`.

## Migracion aplicada

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/ops/migrations/027_supabase_catalogos_precios_staging.sql`

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/migration_027_apply.log`

Guard activo:

`current_database() LIKE 'botica_db_staging_%'`

## Cambios ejecutados

### Catalogos producto

Se poblaron:

- `bot_familias_producto`: 3 filas.
- `bot_categorias_producto`: 11 filas.

Familias creadas:

- Cotización 01855
- Medicamentos
- Pruebas QA

Categorias creadas:

- Analgesicos
- Antialergicos
- Antibioticos
- Antidiabeticos
- Antimicoticos
- Cardiometabolicos
- Controlados
- Corticoides
- Gastrointestinal
- Material medico
- Medicamentos

### Productos mapeados

Antes:

- 62 productos sin `nfamilia_id`.
- 62 productos sin `ncategoria_id`.

Despues:

- 0 productos sin `nfamilia_id`.
- 0 productos sin `ncategoria_id`.

### Precios canonicos

Se poblo `bot_producto_precios` desde columnas legacy:

- `npreventa` -> `PRECIO_1`
- `npreventa_2` -> `PRECIO_2`
- `npreventa_3` -> `PRECIO_3`

Resultado:

| Slot | Filas | Min | Max | Promedio |
|---|---:|---:|---:|---:|
| PRECIO_1 | 62 | 0.50 | 72.50 | 4.58 |
| PRECIO_2 | 54 | 1.00 | 11.00 | 2.71 |
| PRECIO_3 | 4 | 10.00 | 10.00 | 10.00 |

Total precios:

- 120 filas.

### Historial precios

Triggers existentes generaron historial:

- `bot_producto_precios_hist`: 120 filas.

### Sync legacy

Validacion:

- Diferencias entre `bot_producto_precios` y columnas legacy: 0.

## Auditoria post-fix

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_staging_post_fix_fase4.txt`

Resultado:

| Check | Resultado |
|---|---:|
| Familias | 3 |
| Categorias | 11 |
| Precios canonicos | 120 |
| Historial precios | 120 |
| Productos sin familia ID | 0 |
| Productos sin categoria ID | 0 |
| Productos sin PRECIO_1 | 0 |
| Diferencias precio legacy/canonico | 0 |
| Lotes vencidos activos con stock | 0 |
| Stock vs lotes mismatch | 0 |

## Validacion backend

Typecheck:

`npx tsc --noEmit`

Resultado: OK.

Suite completa:

`npm test -- --run`

Resultado:

- 15 archivos OK.
- 133 tests OK.

## Estado actual

Fase 0: OK.  
Fase 1: OK.  
Fase 2: OK.  
Fase 3: OK.  
Fase 4: OK.

Pendiente:

1. Fase 5: migraciones versionadas/base Supabase.
2. Fase 6: RLS/seguridad Supabase.
3. Fase 7: Supabase staging.
4. Fase 8: hardening operativo.
5. Fase 9: corte productivo.

## Siguiente fase

Fase 5: migraciones versionadas.

Acciones:

1. Crear estructura `supabase/migrations`.
2. Crear baseline del schema staging limpio.
3. Copiar/aplanar migraciones 025, 026, 027 como migraciones de preparacion.
4. Crear script auditoria DB.
5. Crear script restore-test local.
6. Documentar runbook.

Confirmacion requerida antes de aplicar Fase 5.
