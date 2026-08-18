# Status DB productiva Supabase - Fase 3

Proyecto: BoticaElPueblo-RebrandLab  
DB staging: botica_db_staging_20260817_231749  
Fecha operativa: 2026-08-17 23:27 America/Lima  
Objetivo: corregir modelo DB, indices y defensas de inventario.

## Resultado

Fase 3: completada en staging y codigo local.

No se modifico `botica_db`.

## Archivos modificados

- `ops/migrations/026_supabase_modelo_inventario_indices_staging.sql`
- `backend-fastify/src/routes/kardex.routes.ts`
- `backend-fastify/src/__tests__/kardex.test.ts`

## Migracion aplicada

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/ops/migrations/026_supabase_modelo_inventario_indices_staging.sql`

Log:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/migration_026_apply.log`

Guard activo:

`current_database() LIKE 'botica_db_staging_%'`

## Cambios DB aplicados

### FK duplicada corregida

Antes:

- `bot_compras_nusuario_id_fkey`
- `fk_bot_compras_usuario`

Despues:

- Solo queda `fk_bot_compras_usuario`
- Politica: `ON DELETE SET NULL`

Motivo:

Historico de compras no debe romperse si usuario se desactiva/elimina logicamente.

### Indices FK creados/verificados

Indices presentes:

- `idx_bot_caja_cerrado_por`
- `idx_bot_caja_mov_usuario`
- `idx_bot_caja_usuario`
- `idx_bot_compras_det_compra`
- `idx_bot_compras_det_producto`
- `idx_bot_compras_proveedor`
- `idx_bot_compras_usuario`
- `idx_bot_kardex_lote`
- `idx_bot_kardex_producto_fecha`
- `idx_bot_productos_proveedor`
- `idx_bot_ventas_det_producto`
- `idx_bot_ventas_det_servicio`
- `idx_bot_ventas_det_venta`
- `idx_bot_ventas_usuario`

### Defensa contra lote vencido activo

Nuevo trigger:

- `trg_bot_lotes_block_expired_active`

Regla:

Un lote no puede quedar `ACTIVO` con `ncantidad > 0` si `dfechavencimiento < CURRENT_DATE`.

Prueba:

Intento insertar lote vencido activo fallo correctamente:

`Lote TEST-EXPIRADO-BLOCK vencido (...) no puede estar ACTIVO con stock 1`

### Defensa contra stock fantasma

Nuevas funciones/triggers:

- `fn_bot_productos_stock_activo_lotes`
- `fn_bot_sync_producto_stock_from_lotes`
- `fn_bot_lotes_sync_producto_stock`
- `fn_bot_productos_validate_stock_lotes`
- `trg_bot_lotes_sync_producto_stock`
- `trg_bot_productos_validate_stock_lotes`

Reglas:

- Stock real viene de lotes `ACTIVO`.
- `bot_productos.nstock` se sincroniza cuando cambian lotes.
- Producto con `lrequiere_lote = TRUE` no puede tener `nstock` distinto a suma de lotes activos.

Pruebas:

- Update directo `bot_productos.nstock = nstock + 1` fallo correctamente.
- Update de lote resincronizo producto en transaccion.
- Mismatch stock/lotes quedo en 0.

## Cambio backend

Endpoint protegido:

`POST /api/v1/kardex/ajuste`

Antes:

- Permitía ajustar `bot_productos.nstock` directo.
- Podia crear stock fantasma en productos con lote.

Despues:

- Si producto tiene `lrequiere_lote = TRUE`, responde 400:

`AJUSTE REQUIERE LOTE. Use /api/v1/ajustes con loteId y almacenId.`

Ruta correcta para productos con lote:

`POST /api/v1/ajustes`

Esa ruta exige:

- `productoId`
- `almacenId`
- `loteId`
- `cantidad`
- `motivo`

## Auditoria post-fix

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/audit_staging_post_fix_fase3.txt`

Resultado:

| Check | Resultado |
|---|---:|
| Lotes activos vencidos con stock | 0 |
| Productos stock vs lotes mismatch | 0 |
| FK compras usuario activas | 1 |
| Indices Fase 3 presentes | 14 |
| Triggers Fase 3 presentes | 7 eventos |

## Validacion backend

Typecheck:

`npx tsc --noEmit`

Resultado: OK.

Tests clave:

`npm test -- --run src/__tests__/kardex.test.ts src/__tests__/ajustes.test.ts src/__tests__/sales.test.ts`

Resultado:

- 3 archivos OK.
- 44 tests OK.

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

Pendiente:

1. Fase 4: catalogos y precios canonicos.
2. Fase 5: migraciones versionadas/base Supabase.
3. Fase 6: RLS/seguridad Supabase.
4. Fase 7: Supabase staging.

## Siguiente fase

Fase 4: catalogos y precios.

Acciones:

1. Poblar `bot_familias_producto`.
2. Poblar `bot_categorias_producto`.
3. Backfill `bot_productos.nfamilia_id`.
4. Backfill `bot_productos.ncategoria_id`.
5. Verificar `bot_producto_precios`.
6. Si vacio, backfill desde `npreventa`, `npreventa_2`, `npreventa_3`.
7. Probar historial de precios.

Confirmacion requerida antes de aplicar Fase 4.
