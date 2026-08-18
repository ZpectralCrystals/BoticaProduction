# Status DB productiva Supabase - Fase 8

Proyecto local: BoticaElPueblo-RebrandLab  
Supabase project ID: hzekajqbtzzigvlmrdaa  
Fecha operativa: 2026-08-18 America/Lima  
Objetivo: hardening ops, smoke con escritura y correccion de drift detectado.

## Resultado

Fase 8: OK.

Supabase staging quedo operativo con escritura real controlada y auditoria final verde.

## Cambios de codigo

- `backend-fastify/src/plugins/db.ts`: SSL configurable para Supabase pooler.
- `frontend/vite.config.ts`: proxy API configurable con `BOTICA_API_PROXY_TARGET`.
- `backend-fastify/src/routes/inventory.routes.ts`: producto nuevo resuelve catalogos por nombre y sincroniza precios canonicos en create/update.

## Hallazgo corregido

Smoke con escritura creo producto por API y auditoria detecto:

- `productos_sin_familia_id = 1`
- `productos_sin_categoria_id = 1`
- `productos_sin_precio_1 = 1`

Causa:

Creacion aceptaba nombres `family/category`, pero no resolvia IDs si no llegaban `familyId/categoryId`. Tambien no escribia `bot_producto_precios` canonico en create/update.

Fix:

- Resolver categoria activa por nombre.
- Heredar familia desde categoria.
- Resolver familia por nombre cuando aplique.
- Sincronizar `bot_producto_precios` en create/update.
- Validaciones basicas antes de consultas catalogo.

## Smoke read-only

| Check | Resultado |
|---|---|
| `GET /health/live` | PASS |
| `GET /health/ready` | PASS |
| `POST /api/v1/auth/login` | PASS |
| `GET /api/v1/auth/session` | PASS |
| `GET /api/v1/dashboard` | PASS |
| `GET /api/v1/inventario?limit=5` | PASS |
| `GET /api/v1/lotes?limit=5` | PASS |
| `GET /api/v1/compras?limit=5` | PASS |
| `GET /api/v1/ventas?limit=5` | PASS |
| `GET /api/v1/caja` | PASS |
| `GET /api/v1/consistencia/resumen` | PASS |
| `GET /api/v1/proveedores?limit=5` | PASS |
| `GET /api/v1/usuarios` | PASS |

## Smoke frontend proxy

| Check | Resultado |
|---|---|
| `GET /` desde Vite 5176 | PASS |
| `POST /api/v1/auth/login` via Vite proxy | PASS |
| `GET /api/v1/inventario?limit=3` via Vite proxy | PASS |

## Smoke escritura

Run:

`SUPA-WRITE-20260818055537`

Datos creados:

| Entidad | ID |
|---|---:|
| Proveedor QA | 16 |
| Producto QA compra/venta | 63 |
| Compra QA | 60 |
| Venta QA | 27 |
| Producto QA create-fix | 64 |

Resultado:

- Compra con lote: PASS.
- Stock post compra: 5.
- Venta FEFO: PASS.
- Stock post venta: 4.
- Lote saldo: 4.
- Consistencia responde: PASS.

## Auditoria final Supabase

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/supabase_audit_fase8_final_post_create_fix.txt`

Resultado:

| Check | Valor |
|---|---:|
| Public tables | 38 |
| Public views | 4 |
| RLS enabled tables | 38 |
| RLS policies | 0 |
| Productos | 64 |
| Lotes | 75 |
| Kardex | 115 |
| Compras | 60 |
| Ventas | 23 |
| Precios canonicos | 126 |
| Historial precios | 126 |
| Lotes vencidos activos con stock | 0 |
| Stock vs lotes mismatch | 0 |
| Productos sin familia ID | 0 |
| Productos sin categoria ID | 0 |
| Productos sin PRECIO_1 | 0 |
| Compras sin detalle | 0 |
| Ventas sin detalle | 0 |
| Grants anon/authenticated | 0 |
| Function public execute grants | 0 |

## Backups Supabase

Backup pre-write smoke:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/supabase_staging_post_fase7_smoke_20260818.dump`

SHA256:

`04a1adcb164440ad8ad4df93d93ff8207312105345ee66c39c75c10b2d84f6b0`

Backup final post-fix/write:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/supabase-migration/20260817_231749/supabase_staging_post_fase8_fix_write_20260818.dump`

SHA256:

`4d8dfdffa7d4d358fe278391a9da5cb8f255684b9c7b2622bb937a6e756e64af`

Nota:

Se instalo `postgresql@17` por Homebrew para usar `pg_dump` compatible con Supabase PostgreSQL 17.6. No se cambio el `pg_dump` global.

## Validacion local

Backend:

- `npm run build`: PASS.
- `npx vitest run src/__tests__/inventory-prices.test.ts`: PASS, 5 tests.

Frontend:

- `npm run build`: PASS.

## Riesgos pendientes

1. Password DB fue compartida en chat y debe rotarse antes de produccion.
2. El pooler requirio `BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false` en Mac local; en servidor final se debe intentar CA valida.
3. Falta definir deploy/corte de backend real hacia Supabase.
4. Falta decidir si datos QA de staging se quedan o se limpian antes de corte.

## Siguiente paso

F9 corte controlado:

1. Rotar password en Supabase.
2. Preparar env productivo fuera de repo.
3. Apuntar backend local/nube a Supabase.
4. Smoke final UI con usuario real.
5. Si todo OK, dejar Supabase como DB oficial.
