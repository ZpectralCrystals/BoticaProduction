# BOTICA EL PUEBLO — Auditoría e implementación de lotes, vencimientos, precios, ventas FEFO y caja

**Fecha:** 2026-05-10
**Alcance:** lotes con costo, precios canónicos con historial, compras con tipo de pago, caja con movimientos detallados, cuentas por pagar, FEFO en ventas.

---

## 1. Resumen ejecutivo

El sistema ya operaba con FEFO en ventas, lotes por almacén, y un control básico de caja (apertura/cierre). Esta intervención completa los huecos críticos de la operación de una botica peruana:

- **Producto** ahora tiene flags `lrequiere_lote` y `lrequiere_vencimiento`. Los precios se gestionan en una tabla canónica `bot_producto_precios` (PRECIO_1/2/3) con historial automático en `bot_producto_precios_hist` y sincronización legacy mediante trigger.
- **Lote** captura el costo de compra real (`nprecio_compra`), lo que habilita FIFO/costo histórico.
- **Compra** distingue `CONTADO` vs `CREDITO`; si es CREDITO se genera una cuenta por pagar; si es CONTADO se registra un egreso en la caja abierta del usuario. El kardex de COMPRA ahora referencia el lote (`nlote_id`).
- **Caja** soporta `bot_caja_movimientos` con tipos `INGRESO|EGRESO|GASTO|PAGO_FACTURA`. Hay endpoint de resumen con saldo teórico (apertura + ventas + ingresos − egresos).
- **Cuentas por Pagar** (CXP) cuentan con CRUD, resumen por proveedor, función SQL atómica `fn_aplicar_pago_cxp` que orquesta `bot_pagos_compras` + `bot_caja_movimientos`.
- **Frontend** suma página `cuentas-por-pagar` y rediseña `caja` con movimientos detallados; `compras` solicita tipo de pago y vencimiento de factura.

Tests: **87/87 backend** y **49/49 frontend**, ambos builds limpios.

---

## 2. Estado actual encontrado en el proyecto

**Ya funcionaba bien:**

- `bot_lotes` con `dfechavencimiento`, `nalmacen_id`, índice FEFO (`004_bot_lotes.sql:106`).
- FEFO en ventas (`sales.routes.ts:329-346`): `ORDER BY dfechavencimiento ASC, tcreado ASC` + `FOR UPDATE`.
- Compras crean/actualizan lotes obligatoriamente (`purchases.routes.ts:394-421`).
- Kardex con `nlote_id` para VENTA (`sales.routes.ts:417-432`).
- POS muestra producto único con elección de PRECIO_1/2/3 (`usePOS.ts:172-186`).
- Ajustes por lote con motivos (`ajustes.routes.ts`).
- Apertura/cierre de caja (`caja.routes.ts`).

**Gaps detectados (ver §3):**

| # | Capa | Problema |
|---|------|----------|
| 1 | DB | `bot_lotes` sin `nprecio_compra` — sin trazabilidad de costo histórico |
| 2 | DB | `bot_productos` sin flags `lrequiere_lote` / `lrequiere_vencimiento` |
| 3 | DB | No existía `bot_producto_precios` canónica ni historial |
| 4 | DB | `bot_compras` sin `ctipo_pago` ni `tfecha_vencimiento` |
| 5 | DB | No existían `bot_caja_movimientos`, `bot_cuentas_por_pagar`, `bot_pagos_compras` |
| 6 | API | Kardex de COMPRA no escribía `nlote_id` |
| 7 | API | `ajustes.routes.ts` usaba `cmotivo` (col inexistente) — *bug bloqueante* |
| 8 | API | No había endpoints para egresos/gastos/pago de facturas |
| 9 | UI | Sin captura de tipo de pago en compras |
| 10 | UI | Sin pantalla de cuentas por pagar / pagos a proveedores |

---

## 3. Problemas detectados

1. **`bot_lotes` sin costo.** El costo se guardaba en `bot_compras_det.npreunit` y se replicaba a `bot_productos.nprecompra` (último valor). Imposible costear FIFO por lote.
2. **Producto sin flags de comportamiento.** Cualquier ítem requería lote y vencimiento por convención, no por regla.
3. **Precios sin historial.** Las columnas `npreventa`, `npreventa_2`, `npreventa_3` se sobreescribían sin auditar.
4. **Compras siempre asumidas como CONTADO.** No había manera de registrar compra al crédito, ni se descontaba caja.
5. **Caja inexpresiva.** Solo apertura/cierre. No se reflejaban egresos, gastos, ni pagos a facturas.
6. **Kardex COMPRA sin `nlote_id`.** Trazabilidad rota: no se sabía a qué lote ingresó el stock.
7. **Bug en ajustes.** El INSERT en `bot_kardex` usaba `cmotivo` (col inexistente; la real es `ctipo`/`cdetalle`) y omitía `nstock_anterior`/`nstock_nuevo`. Cualquier ajuste real fallaba en producción.
8. **`bot_movimientos_almacen` en ajustes** mal cableado: no usaba `nalmacen_origen_id`/`nalmacen_destino_id` correctos.
9. **Ajustes sin transacción atómica.** Riesgo de inconsistencia si fallaba un INSERT intermedio.

---

## 4. Cambios aplicados en base de datos

Tres migraciones SQL idempotentes nuevas:

### Migración 018 — `018_lotes_costo_y_producto_flags.sql`
- `bot_lotes.nprecio_compra NUMERIC(10,2) NOT NULL DEFAULT 0` + check `>= 0`.
- Backfill desde `bot_compras_det` por `(ncompra_id, nproducto_id)` (promedio).
- `bot_productos.lrequiere_lote BOOLEAN NOT NULL DEFAULT TRUE`.
- `bot_productos.lrequiere_vencimiento BOOLEAN NOT NULL DEFAULT TRUE`.
- `bot_compras.ctipo_pago VARCHAR(10) NOT NULL DEFAULT 'CONTADO'` + check `IN ('CONTADO','CREDITO')`.
- `bot_compras.tfecha_vencimiento DATE`.
- `bot_compras.nusuario_id INTEGER` con FK opcional a `bot_usuarios`.
- Rebuilds `idx_bot_lotes_fefo` para incluir `tcreado` ASC como tiebreaker.

### Migración 019 — `019_producto_precios_y_historial.sql`
- Tabla **canónica** `bot_producto_precios`:
  - `nid, nproducto_id, cnombre (PRECIO_1|PRECIO_2|PRECIO_3), nprecio, lactivo, nusuario_id, cusuario, tcreado, tmodifi`
  - `UNIQUE (nproducto_id, cnombre)` + checks de validez.
- Tabla de auditoría `bot_producto_precios_hist`:
  - `nproducto_id, cnombre, nprecio_anterior, nprecio_nuevo, caccion, nusuario_id, cusuario, tcreado`.
- Backfill desde `npreventa/npreventa_2/npreventa_3`.
- **Trigger `fn_sync_producto_precios_legacy`** mantiene `bot_productos.npreventa*` en sync (sin reescritura del backend legacy de lectura).
- **Trigger `fn_bot_producto_precios_hist`** registra en histórico INSERT/UPDATE/TOGGLE_ACTIVO.

### Migración 020 — `020_caja_movimientos_y_cxp.sql`
- `bot_caja_movimientos` (ncaja_id, ctipo, nmonto, cmetodo_pago, cref_tabla, nref_id, cdescripcion, nusuario_id, cusuario, cestado, tcreado) con checks de tipo, monto, método.
- `bot_cuentas_por_pagar` con `nsaldo` como columna **GENERATED** (`nmonto_total - nmonto_pagado`), estado enumerado, FK a compra/proveedor, vencimiento.
- `bot_pagos_compras` (ncxp_id, ncaja_movimiento_id, nmonto, cmetodo_pago, cdocumento, ...).
- **Función SQL `fn_aplicar_pago_cxp`** ejecuta el cierre atómico: valida saldo, inserta pago, actualiza `nmonto_pagado` y `cestado` (PARCIAL/PAGADA).

---

## 5. Cambios aplicados en backend

| Archivo | Cambio |
|---------|--------|
| `backend-fastify/src/db/schema.ts` | Drizzle: agregadas tablas `productoPrecios`, `productoPreciosHist`, `caja`, `cajaMovimientos`, `cuentasPorPagar`, `pagosCompras`. Columnas nuevas en `productos`, `lotes`, `compras`. Lote ahora con `dfechavencimiento`, `nprecioCompra`, `ncompraId`, `ncantidadInicial`. |
| `backend-fastify/src/routes/purchases.routes.ts` | Acepta `tipoPago` y `fechaVencimientoFactura`. Valida `lrequiere_lote/lrequiere_vencimiento` por producto. Escribe `nprecio_compra` y captura `loteId` en UPSERT. Kardex COMPRA ahora con `nlote_id`. Si CREDITO → INSERT en `bot_cuentas_por_pagar`. Si CONTADO + caja abierta → INSERT en `bot_caja_movimientos` (EGRESO). GET expone `ctipo_pago` y `tfecha_vencimiento`. |
| `backend-fastify/src/routes/caja.routes.ts` | Endpoints nuevos: `GET /movimientos`, `POST /movimientos`, `GET /resumen` (saldo teórico). Tipos permitidos: INGRESO/EGRESO/GASTO/PAGO_FACTURA. Métodos: EFECTIVO/TARJETA/TRANSFERENCIA/YAPE/PLIN/OTRO. |
| `backend-fastify/src/routes/cxp.routes.ts` (**nuevo**) | `GET /`, `GET /resumen`, `GET /:id`, `POST /:id/pagar`. Pago aplica `fn_aplicar_pago_cxp` dentro de transacción y genera `bot_caja_movimientos` tipo PAGO_FACTURA si caja abierta. |
| `backend-fastify/src/routes/inventory.routes.ts` | `updatePrices` ahora hace UPSERT en `bot_producto_precios` (slots PRECIO_1/2/3 o desactivación si null) y pasa `nusuario_id`/`cusuario`. La sincronización a columnas legacy ocurre por trigger. Nuevo `GET /precios/historial/:productoId`. |
| `backend-fastify/src/routes/ajustes.routes.ts` | Reescrito como transacción atómica. Validaciones explícitas (`productoId` coincide con lote, stock no queda negativo). Kardex insertado con `ctipo='AJUSTE'` + `cref_tabla='bot_lotes'` + `nstock_anterior`/`nstock_nuevo`. `bot_movimientos_almacen` usa `nalmacen_destino_id` o `nalmacen_origen_id` según signo. |
| `backend-fastify/src/server.ts` | Registra `cxpRoutes` bajo `/api/v1/cuentas-por-pagar`. |
| `backend-fastify/src/__tests__/purchases.test.ts` | Adaptado al nuevo orden de queries y nuevos parámetros del kardex (`nlote_id` en índice 1). |
| `backend-fastify/src/__tests__/ajustes.test.ts` | Mock seed ajustado al nuevo flujo (7 queries dentro de transacción). |
| `backend-fastify/src/__tests__/inventory-prices.test.ts` | Verifica UPSERT en `bot_producto_precios` (PRECIO_1, PRECIO_2) y UPDATE de desactivación (PRECIO_3). |

### Endpoints expuestos

**Caja**
- `GET /api/v1/caja` (ya existía)
- `POST /api/v1/caja` (abrir/cerrar; ya existía)
- `GET /api/v1/caja/movimientos?tipo=&cajaId=`
- `POST /api/v1/caja/movimientos` `{ tipo, monto, metodoPago, descripcion, refTabla?, refId? }`
- `GET /api/v1/caja/resumen` → `{ abierta, apertura, ventas, ingresos, egresos, saldoTeorico, detalle }`

**Cuentas por pagar**
- `GET /api/v1/cuentas-por-pagar?estado=&proveedorId=&vencidas=true`
- `GET /api/v1/cuentas-por-pagar/resumen`
- `GET /api/v1/cuentas-por-pagar/:id`
- `POST /api/v1/cuentas-por-pagar/:id/pagar` `{ monto, metodoPago, documento?, notas? }`

**Inventario**
- `GET /api/v1/inventario/precios/historial/:productoId`
- `POST /api/v1/inventario` con `action=updatePrices` — ahora escribe canónico.

---

## 6. Cambios aplicados en frontend

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/compras-page.tsx` | Nuevos campos: `tipoPago` (select CONTADO/CRÉDITO) y `fechaVencimientoFactura` (mostrado solo si CRÉDITO). Validación bloquea CRÉDITO sin fecha. Tabla muestra columna **Pago** con badge color-coded. |
| `frontend/src/pages/caja-page.tsx` | Reescrita: 4 KPIs (estado, ventas, ingresos, egresos+pagos+gastos), tarjeta de saldo teórico, formulario de movimientos (tipo/monto/método/descripción), listado de movimientos con badges, historial de cajas. |
| `frontend/src/pages/cxp-page.tsx` (**nuevo**) | Resumen agregado, saldos por proveedor, tabla con filtros (estado, solo vencidas), botón Pagar por fila, formulario de pago (monto, método, documento, notas). Muestra atraso en días. |
| `frontend/src/app/router.tsx` | Registra ruta `/panel/cuentas-por-pagar` → `CxpPage` con sección `compras`. |
| `frontend/src/components/layout/app-shell.tsx` | Menú lateral: nueva entrada **Cuentas por pagar** (icono Banknote, sección compras). |
| `frontend/src/lib/api.ts` | Tipos y helpers nuevos: `ApiCajaMovimiento`, `ApiCajaResumen`, `ApiCxp`, `ApiCxpResumen`, `ApiPrecioHistorial`. Funciones `apiGetCajaMovimientos`, `apiAddCajaMovimiento`, `apiGetCajaResumen`, `apiGetCxp`, `apiGetCxpResumen`, `apiPagarCxp`, `apiGetPrecioHistorial`. `ApiCompra` gana `ctipo_pago` / `tfecha_vencimiento`. `apiAddCompra` payload acepta `tipoPago` / `fechaVencimientoFactura`. |
| `frontend/src/pages/compras-page.test.tsx` | Ajustado índice de selects (Tipo de pago insertado) y payload esperado. |

---

## 7. Flujo final de compras

1. Usuario abre `/panel/compras` → **Nueva compra**.
2. Selecciona Proveedor + Almacén destino + Tipo de pago (CONTADO|CRÉDITO).
3. Si CRÉDITO, captura **Vencimiento de factura** (obligatorio).
4. Por cada ítem: Producto + Cantidad + Precio unitario + Código de lote + Fecha de vencimiento.
5. POST `/api/v1/compras` → backend:
   - Validación: producto activo, proveedor activo, almacén activo, `lrequiere_lote/lrequiere_vencimiento`, fecha YYYY-MM-DD.
   - Transacción:
     - INSERT `bot_compras` con `ctipo_pago`, `tfecha_vencimiento`, `nusuario_id`.
     - Por cada ítem:
       - INSERT `bot_compras_det`.
       - `SELECT FOR UPDATE` de `bot_productos.nstock`.
       - UPDATE stock + `nprecompra` (último costo).
       - UPSERT `bot_lotes` con `nprecio_compra` capturado y `loteId` devuelto.
       - INSERT `bot_kardex` (tipo=COMPRA, `nlote_id`, stock_anterior/nuevo).
       - INSERT `bot_movimientos_almacen` con `nlote_id`.
     - Si CRÉDITO → INSERT `bot_cuentas_por_pagar` (PENDIENTE).
     - Si CONTADO + caja abierta → INSERT `bot_caja_movimientos` (EGRESO).
     - INSERT `bot_auditoria`.
   - COMMIT.

---

## 8. Flujo final de lotes y vencimientos

- Cada compra **crea o engrosa** un lote por `(nproducto_id, ccodigo_lote, nalmacen_id)`.
- El lote almacena costo, cantidad, cantidad inicial, vencimiento, estado (`ACTIVO/AGOTADO/VENCIDO`), notas, versión.
- Para FEFO se considera `dfechavencimiento >= CURRENT_DATE`, `ncantidad > 0`, `cestado = 'ACTIVO'`, ordenado por vencimiento + tcreado.
- Ajustes (`POST /api/v1/ajustes`) afectan solo un lote a la vez, dentro de transacción, validando que el lote pertenezca al producto declarado.
- Existe vista `vw_bot_lotes_fefo` que clasifica `OK | PROXIMO | CRITICO | VENCIDO`.
- Endpoints `/lotes`, `/lotes/disponibles/:productoId`, `/lotes/fefo/:productoId`, `/lotes/consistencia` operativos.

---

## 9. Flujo final de ventas con FEFO

1. POS muestra **producto** (no lote). El usuario elige PRECIO_1/2/3 disponibles.
2. POST `/api/v1/ventas` → backend:
   - Lock `bot_productos` FOR UPDATE.
   - Por cada ítem: query FEFO de lotes activos en el almacén del POS con `FOR UPDATE`.
   - Itera lotes restando cantidad; cierra lote (`cestado='AGOTADO'`) si llega a 0.
   - Por cada lote consumido inserta `bot_kardex` con `nlote_id` + stock_anterior/nuevo.
   - UPDATE de `bot_productos.nstock`.
   - INSERT `bot_movimientos_almacen` (`VENTA`).
3. Anulación (`PATCH /:id/anular`) reabre lotes consumidos y restaura `cestado='ACTIVO'`.

---

## 10. Flujo final de caja

1. **Abrir caja** (1 caja activa por usuario): `POST /api/v1/caja {action:'abrir', montoApertura}`.
2. Durante el turno:
   - Ventas se reflejan en `bot_ventas` (no se duplican en movimientos; el resumen las suma aparte).
   - Movimientos extra vía `POST /api/v1/caja/movimientos` o desde flujos automáticos (compras CONTADO, pago de facturas CXP).
3. `GET /api/v1/caja/resumen` calcula `saldoTeorico = apertura + ventas + ingresos − (egresos + gastos + pagos_factura)`.
4. **Cerrar caja** captura `montoCierre`.
5. Todos los movimientos quedan auditados en `bot_auditoria` con acción `CAJA_<tipo>`.

Reglas de validación:
- Monto > 0.
- Método de pago restringido al enum.
- Descripción obligatoria.
- Si tipo = PAGO_FACTURA y método = EFECTIVO → exige caja abierta.

---

## 11. Flujo final de cuentas por pagar

1. **Origen**: compra registrada como CRÉDITO crea automáticamente la fila en `bot_cuentas_por_pagar` con `cestado='PENDIENTE'`.
2. **Listado** (`/panel/cuentas-por-pagar`): filtros por estado/proveedor/vencidas; KPIs de saldo total y vencido; saldo por proveedor.
3. **Pago** (`POST /:id/pagar`):
   - `BEGIN`.
   - Lookup `bot_caja` abierta (FOR UPDATE) — requerido si método = EFECTIVO.
   - INSERT `bot_caja_movimientos` (`PAGO_FACTURA`).
   - Llama `fn_aplicar_pago_cxp(...)` que:
     - Bloquea CXP (FOR UPDATE).
     - Verifica que `nuevo_pagado <= nmonto_total`.
     - INSERT `bot_pagos_compras` con `ncaja_movimiento_id`.
     - UPDATE CXP `nmonto_pagado` + `cestado` (PARCIAL o PAGADA).
   - INSERT `bot_auditoria`.
   - `COMMIT`.
4. `nsaldo` es **GENERATED** (`nmonto_total - nmonto_pagado`), nunca se inserta a mano.
5. Vencimiento se calcula como `CURRENT_DATE - tfecha_vencimiento` y se muestra en el listado.

---

## 12. Validaciones implementadas

- **Producto**: `lrequiere_lote` / `lrequiere_vencimiento` (defaults TRUE para medicamentos).
- **Precios**: P1 obligatorio > 0; P2/P3 opcionales pero ≥ 0; auditados en hist.
- **Compras**: tipo de pago en `{CONTADO, CREDITO}`; si CREDITO, fecha de vencimiento válida YYYY-MM-DD; lote y vencimiento por ítem según flags del producto; precio unit ≥ 0; cantidad > 0.
- **Lotes**: `ncantidad >= 0`; `cestado IN ('ACTIVO','AGOTADO','VENCIDO')`; `nprecio_compra >= 0`.
- **CXP**: `nmonto_pagado <= nmonto_total`; estado en `{PENDIENTE,PARCIAL,PAGADA,ANULADA}`.
- **Caja movimientos**: `nmonto > 0`; tipos enum; métodos enum; descripción obligatoria; caja abierta requerida en PAGO_FACTURA efectivo.
- **Ajustes**: lote pertenece al producto declarado; stock no queda negativo (producto y lote); motivos enum; transacción atómica.

---

## 13. Archivos modificados

**Backend**
- `backend-fastify/src/db/schema.ts`
- `backend-fastify/src/routes/purchases.routes.ts`
- `backend-fastify/src/routes/caja.routes.ts`
- `backend-fastify/src/routes/inventory.routes.ts`
- `backend-fastify/src/routes/ajustes.routes.ts`
- `backend-fastify/src/routes/cxp.routes.ts` **(nuevo)**
- `backend-fastify/src/server.ts`
- `backend-fastify/src/__tests__/purchases.test.ts`
- `backend-fastify/src/__tests__/ajustes.test.ts`
- `backend-fastify/src/__tests__/inventory-prices.test.ts`

**Frontend**
- `frontend/src/lib/api.ts`
- `frontend/src/pages/compras-page.tsx`
- `frontend/src/pages/caja-page.tsx`
- `frontend/src/pages/cxp-page.tsx` **(nuevo)**
- `frontend/src/pages/compras-page.test.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/components/layout/app-shell.tsx`

**Migraciones**
- `ops/migrations/018_lotes_costo_y_producto_flags.sql` **(nuevo)**
- `ops/migrations/019_producto_precios_y_historial.sql` **(nuevo)**
- `ops/migrations/020_caja_movimientos_y_cxp.sql` **(nuevo)**

---

## 14. Migraciones creadas

```
ops/migrations/018_lotes_costo_y_producto_flags.sql
ops/migrations/019_producto_precios_y_historial.sql
ops/migrations/020_caja_movimientos_y_cxp.sql
```

Aplicación (idempotentes, seguras de re-ejecutar):
```bash
psql -U botica -d botica_db -f ops/migrations/018_lotes_costo_y_producto_flags.sql
psql -U botica -d botica_db -f ops/migrations/019_producto_precios_y_historial.sql
psql -U botica -d botica_db -f ops/migrations/020_caja_movimientos_y_cxp.sql
```

---

## 15. Tests / comandos ejecutados

```
cd backend-fastify && npx tsc --noEmit      # 0 errores
cd backend-fastify && npm test              # 11 archivos, 87/87 tests OK
cd backend-fastify && npm run build         # compilación TS limpia
cd frontend         && npx tsc --noEmit     # 0 errores
cd frontend         && npm test             # 4 archivos, 49/49 tests OK
cd frontend         && npx vite build       # build 282ms, 718 KB JS
```

Resumen tests:
- `purchases.test.ts`: 14/14 — incluye kardex con `nlote_id`, lote INSERT y UPDATE, validaciones.
- `sales.test.ts`: 14/14 — FEFO, anulación, stock, almacenes.
- `kardex.test.ts`: 18/18.
- `ajustes.test.ts`: 2/2 — transacción correcta, ambos endpoints.
- `inventory-prices.test.ts`: 2/2 — UPSERT canónica + rechazo de negativos.
- `compras-page.test.tsx`: 2/2 — tipo de pago + payload extendido.
- `usePOS.test.ts`, `Cart.test.tsx`, `posUtils.test.ts`: 47/47.

---

## 16. Errores encontrados y cómo se resolvieron

| # | Error | Causa | Solución |
|---|-------|-------|----------|
| 1 | `ajustes.test` fallaba con 400 | Mock sólo devolvía `{ncantidad}`; mi nuevo SELECT también lee `nproducto_id`; la nueva ruta entra en transacción y emite 7 queries | Actualizado mock seed con 7 respuestas y `{ ncantidad, nproducto_id }` |
| 2 | `inventory-prices.test` fallaba con 404 | Mi nueva ruta hace `SELECT nid FROM bot_productos ... FOR UPDATE` antes del upsert; el mock no lo devolvía | Seed actualizado con `{ nid: 7 }` + asserts contra `bot_producto_precios` |
| 3 | `purchases.test` esperaba stock en kp[3]/kp[4] | Agregar `nlote_id` al kardex desplazó parámetros un slot | Asserts movidos a kp[4]/kp[5] + verificación de `kp[1]` no nulo |
| 4 | `compras-page.test.tsx` no encontraba `option "1"` en el 4º select | Nuevo select `tipoPago` empujó al de Producto a índice 4 | Comentario + `selects[4]` |
| 5 | Test esperaba payload sin `tipoPago` | `buildCompraPayload` ahora siempre serializa `tipoPago` y `fechaVencimientoFactura` | Asserts actualizados |
| 6 | Bug pre-existente en `ajustes.routes.ts:54` (`cmotivo` no existe en `bot_kardex`) | Schema drift heredado de versión previa | Reescrito INSERT con cols correctas (`ctipo`, `cref_tabla`, `nstock_anterior/nuevo`) |

---

## 17. Pendientes, riesgos y recomendaciones

### Pendientes (no bloqueantes)
- **Re-costear stock previo**: el backfill de `bot_lotes.nprecio_compra` usa el costo de la compra correspondiente (cuando `ncompra_id` está poblado). Lotes históricos sin compra ligada quedan en 0 — convendría correr una rutina manual para asignarles `nprecompra` actual.
- **Filtro de FEFO por almacén en el endpoint `/lotes/fefo/:productoId`**: actualmente puede traer cualquier almacén. POS ya filtra implícitamente porque pasa `almacenId` en la query, pero conviene blindar.
- **Cancelación/anulación de CXP**: no implementada. Si una compra CREDITO se anula, hoy hay que revertir manualmente la CXP.
- **Reflejo de venta en `bot_caja_movimientos`**: las ventas no escriben en esa tabla (se siguen contando desde `bot_ventas`). El `resumen` las suma aparte. Si se quiere unificar, agregar trigger en `bot_ventas` AFTER INSERT.
- **Historial de precios por slot**: pantalla aún no expone `GET /inventario/precios/historial/:productoId`; el endpoint existe y se puede consumir.
- **Permisos**: la pantalla de cuentas por pagar usa la sección `compras` por simplicidad. Si se desea aislar (p.ej. solo contadores), crear sección `cuentas-por-pagar`.

### Riesgos
- **Schema drift heredado**: el Drizzle ORM tenía columnas inventadas (p. ej. `tvencimiento` cuando la DB usa `dfechavencimiento`, `nprecio_unit` cuando la real es `npreunit`). Esta entrega corrige sólo los huecos relacionados al feature; las rutas afectadas siguen usando raw SQL como antes. Vale planificar un sweep dedicado.
- **Trigger de sync `fn_sync_producto_precios_legacy`**: si en el futuro se eliminan las columnas legacy `npreventa*`, debe removerse este trigger. El código que aún lee de columnas legacy (`inventory.routes.ts:647`, etc.) debería migrar a `bot_producto_precios`.
- **`fn_aplicar_pago_cxp`** acepta `cmetodo_pago` sin validar el enum (la validación está en `bot_caja_movimientos`). Si se invoca directo en SQL evitando la ruta, podría aceptar métodos inválidos en `bot_pagos_compras`. Recomendable agregar un check ahí.

### Recomendaciones
- Programar tarea diaria que marque lotes con `dfechavencimiento < CURRENT_DATE` como `cestado='VENCIDO'` (script ya existe en `scripts/cron-vencimientos.sh`; validar que cubra esa lógica).
- Exponer un widget en dashboard de **saldo CXP** y **vencidas próximas a vencer**.
- Considerar precio de venta variable por lote en escenarios donde el costo cambie radicalmente (hoy el precio es por producto; valida si negocio lo necesita).
- Cuando se introduzca multi-caja simultánea, revisar el supuesto "una caja abierta por usuario" en `purchases.routes.ts`.

---

## Sumario final

- **Reporte:** `BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md`
- **Migraciones nuevas:** 3 (018, 019, 020) — idempotentes
- **Rutas backend nuevas:** 8 (caja movimientos x3, cxp x4, inventario hist x1)
- **Páginas frontend nuevas:** 1 (cuentas por pagar)
- **Reescritas:** caja-page, compras-page (extendida), ajustes.routes.ts
- **Tests:** 87/87 backend, 49/49 frontend
- **Builds:** ambos limpios
- **Comandos clave:**
  - `npx tsc --noEmit` (backend + frontend)
  - `npm test` (backend + frontend)
  - `npm run build` (backend)
  - `npx vite build` (frontend)
  - `psql -f ops/migrations/{018,019,020}*.sql`
