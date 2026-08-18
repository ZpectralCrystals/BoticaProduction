# BOTICA_AUDITORIA_FINAL_FLUJOS.md

## 1. Resumen ejecutivo

Se auditó el estado real del ERP/POS Botica El Pueblo contra código actual, docs obligatorios y comandos de build/test. Los flujos centrales ya están conectados: productos, compras, lotes FEFO, POS, kardex, caja, cuentas por pagar y layout full width.

Se aplicaron correcciones puntuales sin rehacer tablas ni duplicar lógica FEFO:

- Producto: Precio 1 ahora queda obligatorio `> 0` también en alta/edición general, no solo en edición rápida de precios.
- Producto: composición/principio activo ahora se valida antes de guardar.
- Compra CRÉDITO: backend ahora exige fecha de vencimiento de factura.
- Reporte vencimientos: ahora lista lotes por vencer, no solo vencimiento heredado del producto.
- Reporte ganancias: ahora calcula costo real vendido desde lotes consumidos por kardex.
- Cierre de caja: ahora calcula apertura, ventas, ingresos, egresos, saldo esperado, monto contado y diferencia.

## 2. Qué flujos ya funcionan

- Productos con familia, categoría, composición, Precio 1/2/3 y costo de compra no editable desde producto.
- Historial de precios vía `bot_producto_precios_hist` y endpoint `/api/v1/inventario/precios/historial/:productoId`.
- Familias/categorías no se eliminan si están asociadas a productos.
- Compras con proveedor, almacén destino, lote, fecha de vencimiento, costo por lote, kardex de entrada y movimiento de almacén.
- Compra CONTADO genera egreso de caja si hay caja abierta.
- Compra CRÉDITO genera cuenta por pagar.
- POS muestra una fila por producto, stock disponible agregado y precios comerciales disponibles.
- Venta consume lotes con FEFO y bloqueos `FOR UPDATE`.
- Lotes vencidos no se venden porque FEFO filtra `dfechavencimiento >= CURRENT_DATE`.
- Kardex registra salida por lote.
- CXP permite pagos parciales/totales y evita pagar más que saldo.
- Pago CXP genera movimiento de caja `PAGO_FACTURA`.
- Layout del panel usa ancho completo; login se conserva centrado.

## 3. Qué flujos estaban incompletos

- Alta/edición general de producto aceptaba `Precio 1 = 0`.
- Alta/edición de producto podía pasar sin composición si no se agregaba componente.
- Backend de compras a CRÉDITO aceptaba fecha de vencimiento vacía.
- Reporte de vencimientos usaba `bot_productos.tvencimien`, por lo que no mostraba dos lotes diferentes del mismo producto.
- Reporte de ganancias calculaba `ventas - compras del período`, no costo real vendido por lote.
- Cierre de caja solo guardaba `ncierre`; no devolvía saldo esperado ni diferencia.

## 4. Qué cambios se aplicaron

- `purchases.routes.ts`: compra CRÉDITO ahora requiere `fechaVencimientoFactura`.
- `inventory.routes.ts`: producto requiere composición y `precioVenta1 > 0`.
- `inventory-page.tsx`: validación frontend igual para composición y Precio 1.
- `reports.routes.ts`: reporte `vencimiento` ahora consulta `bot_lotes` + producto + almacén/local.
- `reports.routes.ts`: reporte `ganancias` suma costo vendido desde `bot_kardex` + `bot_lotes.nprecio_compra`.
- `reportes-page.tsx`: tabla de vencimientos muestra lote, stock lote y almacén.
- `reportes-page.tsx`: tarjetas de ganancias muestran costo real vendido y ganancia real.
- `caja.routes.ts`: cierre de caja usa transacción, bloquea caja abierta con `FOR UPDATE`, calcula saldo esperado y diferencia.
- `api.ts` y `caja-page.tsx`: frontend recibe resumen de cierre y muestra diferencia en toast.
- `purchases.test.ts`: agregado test para rechazar compra CRÉDITO sin fecha de vencimiento.

## 5. Archivos modificados

- `BOTICA_AUDITORIA_FINAL_FLUJOS.md`
- `backend-fastify/src/routes/purchases.routes.ts`
- `backend-fastify/src/routes/inventory.routes.ts`
- `backend-fastify/src/routes/reports.routes.ts`
- `backend-fastify/src/routes/caja.routes.ts`
- `backend-fastify/src/__tests__/purchases.test.ts`
- `frontend/src/pages/inventory-page.tsx`
- `frontend/src/pages/reportes-page.tsx`
- `frontend/src/pages/caja-page.tsx`
- `frontend/src/lib/api.ts`

También siguen modificados por el trabajo de layout:

- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/shared/page-header.tsx`
- `BOTICA_LAYOUT_FULL_WIDTH.md`

## 6. Migraciones nuevas si hubo

No se crearon migraciones nuevas en esta pasada.

Migraciones existentes revisadas/documentadas:

- `ops/migrations/018_lotes_costo_y_producto_flags.sql`
- `ops/migrations/019_producto_precios_y_historial.sql`
- `ops/migrations/020_caja_movimientos_y_cxp.sql`

## 7. Endpoints revisados

- `GET /api/v1/inventario`
- `POST /api/v1/inventario`
- `GET /api/v1/inventario/precios/historial/:productoId`
- `GET /api/v1/compras`
- `POST /api/v1/compras`
- `GET /api/v1/ventas`
- `POST /api/v1/ventas`
- `PATCH /api/v1/ventas/:id/anular`
- `GET /api/v1/ventas/:id`
- `GET /api/v1/caja`
- `POST /api/v1/caja`
- `GET /api/v1/caja/movimientos`
- `POST /api/v1/caja/movimientos`
- `GET /api/v1/caja/resumen`
- `GET /api/v1/cuentas-por-pagar`
- `GET /api/v1/cuentas-por-pagar/resumen`
- `GET /api/v1/cuentas-por-pagar/:id`
- `POST /api/v1/cuentas-por-pagar/:id/pagar`
- `GET /api/v1/reportes?tipo=vencimiento`
- `GET /api/v1/reportes?tipo=ganancias`
- `POST /api/v1/ajustes`

## 8. Pantallas revisadas

- `frontend/src/pages/inventory-page.tsx`
- `frontend/src/pages/compras-page.tsx`
- `frontend/src/pages/sales-page.tsx`
- `frontend/src/pages/caja-page.tsx`
- `frontend/src/pages/cxp-page.tsx`
- `frontend/src/pages/reportes-page.tsx`
- `frontend/src/pages/dashboard-page.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/shared/page-header.tsx`
- `frontend/src/pos/components/ProductSearch.tsx`
- `frontend/src/pos/components/Cart.tsx`
- `frontend/src/pos/components/CheckoutModal.tsx`
- `frontend/src/pos/hooks/usePOS.ts`

## 9. Validaciones agregadas

- Compra CRÉDITO sin fecha de vencimiento: rechazada en backend.
- Fecha de vencimiento de factura CRÉDITO: formato `YYYY-MM-DD` obligatorio.
- Producto sin composición/principio activo: rechazado en frontend y backend.
- Producto con `Precio 1 <= 0`: rechazado en frontend y backend.
- Reporte de vencimientos ahora valida por lote activo con stock.
- Cierre de caja ahora calcula diferencia contra saldo esperado.

## 10. Tests ejecutados

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build

cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
```

Resultados:

- Backend TypeScript: OK.
- Backend tests: OK, `11` archivos, `88` tests.
- Backend build: OK.
- Frontend TypeScript: OK.
- Frontend tests: OK, `4` archivos, `49` tests.
- Frontend build: OK.

Nota: frontend tests mantienen warnings existentes de React `act(...)` en `src/pos/hooks/usePOS.test.ts`; no fallan pruebas.

## 11. Resultado de build

- `backend-fastify && npm run build`: correcto.
- `frontend && npm run build`: correcto.
- Vite emitió warning de chunk grande (`> 500 kB`), no bloqueante.

## 12. Riesgos encontrados

- No existe tabla separada `venta_detalle_lotes`; la trazabilidad equivalente está en `bot_kardex` por `nlote_id` y `cref_tabla='bot_ventas'`.
- `bot_ventas_det` guarda lote primario; si una línea consume múltiples lotes, el detalle completo está en kardex.
- Venta no exige caja abierta; el resumen de caja suma ventas por rango de apertura. Regla de bloqueo no está definida como obligatoria.
- Movimientos de caja se anulan lógicamente con `cestado`, pero no hay endpoint dedicado de anulación de movimiento.
- Cierre de caja calcula y audita diferencia, pero no agrega columnas nuevas para persistir `saldo_esperado`/`diferencia`.
- Reporte de costo real depende de kardex con `nlote_id`; ventas legacy sin lote quedan con costo `0`.
- Validar composición obligatoria puede requerir excepción futura para productos no medicamentosos.

## 13. Pendientes recomendados

- Crear endpoint controlado para anular movimientos de caja, cambiando `cestado` en vez de borrar.
- Exponer historial de precios en UI.
- Decidir si venta debe bloquearse cuando no hay caja abierta.
- Persistir cierre detallado en DB si se requiere auditoría contable formal.
- Crear reporte dedicado de utilidad por venta/línea con detalle multi-lote.
- Revisar productos no medicamentosos si no deben requerir composición.
- Agregar tests específicos para reportes de vencimiento por lote y cierre de caja con diferencia.

## 14. Checklist final por módulo

### Productos

- [x] Nombre comercial obligatorio.
- [x] Composición/principio activo obligatorio.
- [x] Familia y categoría soportadas.
- [x] Precio 1 obligatorio `> 0`.
- [x] Precio 2 y Precio 3 opcionales.
- [x] Precio compra no editable desde producto.
- [x] Cambio de precio guarda historial.
- [x] Familia/categoría no se eliminan si están en uso.

### Compras

- [x] Compra con proveedor.
- [x] Condición de pago CONTADO/CRÉDITO.
- [x] CONTADO genera egreso si caja abierta.
- [x] CRÉDITO genera CXP.
- [x] Producto comprado pide lote.
- [x] Producto comprado pide vencimiento si corresponde.
- [x] Lote guarda costo de compra.
- [x] Precio de compra no se edita desde producto.
- [x] Kardex registra entrada con lote.

### Lotes y vencimientos

- [x] Vencimiento por lote.
- [x] Producto con múltiples lotes.
- [x] Lotes con vencimiento/costo distintos.
- [x] Reporte de vencimientos muestra lotes.
- [x] Dos lotes por vencer aparecen como dos filas.
- [x] Lote vencido no se vende.
- [x] Baja/merma por lote vía ajuste con motivo `VENCIMIENTO`/`MERMA`.

### Ventas POS

- [x] Búsqueda muestra una fila por producto.
- [x] No muestra una fila por lote.
- [x] Muestra stock total disponible.
- [x] Precio 1 por defecto.
- [x] Permite elegir Precio 1/2/3 si existen.
- [x] FEFO automático.
- [x] No vende más que stock disponible.
- [x] No vende lote vencido.
- [x] Trazabilidad de lote consumido vía kardex.
- [x] Kardex registra salida por lote.
- [x] Reporte calcula costo real y ganancia desde lotes consumidos.

### Caja

- [x] Abrir caja.
- [ ] Venta bloqueada sin caja abierta: no definida como regla obligatoria.
- [x] Venta en efectivo considerada en resumen de caja.
- [x] Pago proveedor genera egreso `PAGO_FACTURA`.
- [x] Gasto manual genera egreso.
- [x] Cierre calcula apertura, ingresos, egresos, saldo esperado, contado y diferencia.
- [x] Movimientos cerrados no se editan desde UI.
- [ ] Endpoint de anulación de movimientos pendiente.

### Cuentas por pagar

- [x] Compra CRÉDITO crea CXP.
- [x] Cuentas pendientes visibles.
- [x] Pago total/parcial.
- [x] Pago parcial actualiza saldo.
- [x] Pago total marca PAGADA.
- [x] Pago genera movimiento de caja.
- [x] No permite pagar más que saldo.

### Layout

- [x] `AppShell` full width.
- [x] Sin `max-w-*` global limitando panel revisado.
- [x] Login centrado conservado.
- [x] Dashboard, inventario, ventas, compras, caja y CXP full width.
