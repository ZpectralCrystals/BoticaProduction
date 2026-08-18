# BOTICA FASE 8 - Validacion funcional local/manual

## 1. Resumen ejecutivo

Se valido localmente el ERP/POS Botica El Pueblo usando backend real en `http://127.0.0.1:3100`, PostgreSQL local `botica_db`, JWT de desarrollo firmado con el secreto local y flujos reales por API.

Resultado final:

- Validacion funcional API: 28/28 checks OK.
- Backend TypeScript: OK.
- Backend tests: OK, 14 archivos, 103 tests.
- Backend build: OK.
- Backend lint: OK.
- Frontend TypeScript: OK.
- Frontend tests: OK, 4 archivos, 50 tests.
- Frontend build: OK.
- Frontend lint: OK.

## 2. Graphify usado

Antes de leer codigo o buscar archivos se reviso:

```bash
sed -n '1,220p' graphify-out/GRAPH_REPORT.md
```

Consultas Graphify usadas:

```bash
graphify query "rutas productos inventario compras ventas POS caja cuentas por pagar reportes tests existentes" --budget 9000
graphify query "backend-fastify src routes inventory purchases sales caja cxp reports tests inventory purchases sales caja reports" --budget 12000
graphify query "sales.routes.ts purchases.routes.ts caja.routes.ts cxp.routes.ts reports.routes.ts inventory.routes.ts api.ts inventory-page compras-page caja-page reportes-page SalesPOS usePOS tests" --budget 16000
graphify query "fn_aplicar_pago_cxp pagar más saldo cuenta por pagar saldo pendiente" --budget 8000
```

## 3. Validacion funcional ejecutada

Se ejecuto un script local de validacion por API real con datos prefijo `F8`.

Ejecucion final:

- `stamp`: `81478555`
- checks totales: `28`
- checks OK: `28`
- checks fallidos: `0`

Datos creados para validacion local:

- producto medicamento: `F8 MED 81478555`, id `18`
- producto no medicamento: `F8 BOLSA 81478555`, id `19`
- caja admin: id `35`
- compra contado no medicamento: id `20`
- compra credito medicamento: id `21`
- compra contado medicamento lote temprano: id `22`
- cuenta por pagar: id `3`
- movimiento manual anulado: id `7`
- caja cajero: id `36`
- venta FEFO: id `26`, codigo `VTA-20260511-0002`
- producto con lote vencido: id `20`

## 4. Flujos validados

### 4.1 Producto medicamento

Validado:

- `MEDICAMENTO` sin composicion devuelve `400 COMPOSICION ES OBLIGATORIA`.
- `MEDICAMENTO` con composicion se crea correctamente.
- Backend fuerza `requiereLote=true`.
- Backend fuerza `requiereVencimiento=true`.
- Precio 1 obligatorio validado.

### 4.2 Producto no medicamento

Validado:

- `NO_MEDICAMENTO` se crea sin composicion.
- `composicion` queda vacia.
- Permite `requiereLote=false`.
- Permite `requiereVencimiento=false`.
- Compra posterior sin lote/vencimiento funciona.

### 4.3 Compra contado

Validado:

- Admin abre caja asignada a admin.
- Compra contado de producto sin lote/vencimiento funciona.
- Compra contado crea movimiento `EGRESO` en `bot_caja_movimientos`.
- Compra de medicamento crea lote y kardex.

### 4.4 Compra credito

Validado:

- Compra credito exige fecha de vencimiento de factura.
- Compra credito crea CXP.
- Compra credito no genera egreso de caja al registrarse.
- Pago parcial posterior genera movimiento de caja `PAGO_FACTURA`.

### 4.5 Caja admin/cajero

Validado:

- Admin abre caja.
- Admin asigna caja a cajero.
- Cajero asignado puede vender.
- Otro usuario sin caja asignada no puede vender.
- Cajero sin permiso `caja_cierre` no puede cerrar.
- Admin cierra caja asignada a cajero.

### 4.6 Venta POS FEFO

Validado:

- Busqueda POS retorna una sola fila por producto.
- Muestra stock total.
- Muestra Precio 1 actualizado.
- Venta consume lote FEFO primero:
  - `F8-EARLY-81478555`, vencimiento `2026-12-31`, cantidad `2`, costo `3`.
  - `F8-LATE-81478555`, vencimiento `2027-12-31`, cantidad `1`, costo `4`.
- Usuario sin caja abierta no vende.
- Producto con solo lote vencido no vende.

### 4.7 Anulacion movimiento caja

Validado:

- Movimiento manual `INGRESO` creado.
- Movimiento anulado con motivo.
- Estado devuelve `ANULADO`.
- Resumen excluye movimiento anulado:
  - antes: ingresos `7`
  - despues: ingresos `0`

### 4.8 Cierre de caja persistente

Validado:

- Caja cajero cerrada por admin.
- Snapshot persistido:
  - apertura `50`
  - ventas `38.25`
  - saldo esperado `88.25`
  - monto contado `88.25`
  - diferencia `0`
- Historial muestra cierre persistido con `cerradoPor=ADMINISTRADOR`.

### 4.9 Historial de precios

Validado:

- Cambio de `Precio 1/2/3` funciona.
- Historial muestra slot, precio nuevo, accion, usuario y fecha.
- Ejemplo validado:
  - `PRECIO_1`: `12.75`
  - `PRECIO_2`: `13.5`
  - `PRECIO_3`: `14.25`

### 4.10 Reporte utilidad

Validado:

- Reporte `utilidad-ventas` encuentra venta `VTA-20260511-0002`.
- Venta multi-lote suma costos reales:
  - ingreso `38.25`
  - costo total `10`
  - utilidad `28.25`
  - margen aproximado `73.86%`

## 5. Bugs encontrados y corregidos

### Bug 1 - Venta permitia producto con solo lotes vencidos

Problema:

- Si el producto tenia stock global, pero ningun lote vigente, la venta podia caer al flujo sin lotes.
- Eso permitia vender stock respaldado solo por lotes vencidos.

Correccion:

- `sales.routes.ts` ahora lee `lrequiere_lote`.
- Si `lrequiere_lote=true` y FEFO no encuentra lotes vigentes, rechaza con:

```txt
NO HAY LOTES VIGENTES DISPONIBLES
```

Test agregado:

- `sales.test.ts`: rechaza producto que requiere lote si no hay lotes vigentes disponibles.

### Bug 2 - Pago CXP fallaba con `FOR UPDATE` sobre `LEFT JOIN`

Problema:

```txt
FOR UPDATE cannot be applied to the nullable side of an outer join
```

Correccion:

- `cxp.routes.ts` usa `FOR UPDATE OF x` para bloquear solo `bot_cuentas_por_pagar`.

Test agregado:

- `cxp.test.ts`: valida pago parcial, movimiento de caja y SQL `FOR UPDATE OF x`.

### Bug 3 - Anular movimiento de caja fallaba por tipo de parametros

Problema:

```txt
42P18
```

Causa:

- PostgreSQL no podia inferir tipo en `CONCAT(... $2, $3 ...)`.

Correccion:

- `caja.routes.ts` usa `$2::TEXT` y `$3::TEXT`.

Test ajustado:

- `caja.test.ts` valida casts en query de anulacion.

### Bug 4 - `checkSchema` no detectaba migraciones 019/020 faltantes

Problema:

- Backend arrancaba con `Schema OK` aunque faltaban:
  - `bot_producto_precios`
  - `bot_producto_precios_hist`
  - `bot_caja_movimientos`
  - `bot_cuentas_por_pagar`
  - `bot_pagos_compras`

Correccion:

- `schema-check.ts` ahora valida tablas/columnas de precios, caja movimientos, CXP, pagos y cierre persistente.

Test ajustado:

- `schema-check.test.ts` reescrito con matriz actual de 20 tablas y 65 columnas.

## 6. Migraciones aplicadas localmente

No se crearon migraciones nuevas.

Para alinear la base local se aplicaron migraciones existentes:

```bash
psql -h localhost -d botica_db -v ON_ERROR_STOP=1 -f ops/migrations/019_producto_precios_y_historial.sql
psql -h localhost -d botica_db -v ON_ERROR_STOP=1 -f ops/migrations/020_caja_movimientos_y_cxp.sql
```

Despues de reiniciar backend:

```txt
Schema OK — 20 tablas y 65 columnas verificadas
```

## 7. Archivos modificados

- `backend-fastify/src/routes/sales.routes.ts`
- `backend-fastify/src/__tests__/sales.test.ts`
- `backend-fastify/src/routes/cxp.routes.ts`
- `backend-fastify/src/__tests__/cxp.test.ts`
- `backend-fastify/src/routes/caja.routes.ts`
- `backend-fastify/src/__tests__/caja.test.ts`
- `backend-fastify/src/lib/schema-check.ts`
- `backend-fastify/src/__tests__/schema-check.test.ts`
- `BOTICA_FASE8_VALIDACION_FUNCIONAL_LOCAL.md`

## 8. Comandos tecnicos ejecutados

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado:

- Backend `npx tsc --noEmit`: OK.
- Backend `npm test`: OK, 14 archivos, 103 tests.
- Backend `npm run build`: OK.
- Backend `npm run lint`: OK.
- Frontend `npx tsc --noEmit`: OK.
- Frontend `npm test`: OK, 4 archivos, 50 tests.
- Frontend `npm run build`: OK.
- Frontend `npm run lint`: OK.

Observaciones:

- Frontend tests emiten warnings React `act(...)` existentes, pero no fallan.
- Frontend build emite warning de chunk mayor a `500 kB`, pero build termina OK.

## 9. Riesgos y pendientes recomendados

- Los datos `F8-*` creados son datos de validacion local. No se eliminaron automaticamente.
- `start.sh` deberia revisarse en otra fase para asegurar que aplique migraciones 019/020/021/022 si se usa como bootstrap oficial.
- Mantener `schema-check` actualizado cuando se agreguen migraciones nuevas.
- Considerar un test E2E formal para el flujo completo API, para no depender de script manual ad hoc.

## 10. Checklist final

- [x] Producto medicamento validado.
- [x] Producto no medicamento validado.
- [x] Compra contado validada.
- [x] Compra credito validada.
- [x] CXP pago parcial validado.
- [x] Caja admin/cajero validada.
- [x] Venta POS FEFO validada.
- [x] Lote vencido bloqueado en venta.
- [x] Anulacion movimiento caja validada.
- [x] Cierre persistente validado.
- [x] Historial precios validado.
- [x] Reporte utilidad validado.
- [x] Build/tests/lint final OK.
