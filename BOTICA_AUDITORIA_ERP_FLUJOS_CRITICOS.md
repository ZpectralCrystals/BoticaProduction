# Auditoria ERP Botica - Flujos criticos, robustez y escalabilidad

Fecha: 2026-05-12

## 1. Alcance

Auditoria tecnica del estado actual de Botica El Pueblo como ERP/POS transaccional para botica/farmacia.

No se implementaron features nuevas en esta fase. No se modifico logica de negocio. La auditoria uso Graphify como mapa inicial del proyecto y luego reviso rutas, schema, tests, frontend, baseline SQL, migraciones y bootstrap local.

## 2. Estado general

El sistema tiene implementados los flujos principales:

- Productos medicamentosos y no medicamentosos.
- Familias, categorias y componentes.
- Precios 1, 2 y 3 con historial.
- Compras contado/credito.
- Lotes, vencimientos y FEFO.
- Venta POS con caja abierta asignada.
- Caja asignada por usuario, cierre automatico y anulacion logica de movimientos.
- CXP y pagos.
- Reporte de utilidad por venta con costo de lote.
- Usuarios, roles/permisos e integracion conceptual Clerk <-> ERP.
- Baseline SQL canonico y migraciones hasta 022.

Resultado tecnico: backend y frontend compilan, pasan tests, build y lint. El sistema no esta globalmente roto. Hay riesgos puntuales que deben cerrarse antes de un piloto operativo serio.

## 3. Matriz obligatoria de flujos

| Flujo | Estado | Evidencia | Riesgo | Accion recomendada | Prioridad |
|---|---|---|---|---|---|
| Producto medicamento | OK | `backend-fastify/src/routes/inventory.routes.ts:899-912` fuerza tipo `MEDICAMENTO`, lote/vencimiento y precio 1 > 0. `frontend/src/pages/inventory-page.tsx:327-351` valida composicion y flags. | Bajo. | Mantener tests de inventario/precios. | P3 |
| Producto no medicamento | OK | `backend-fastify/src/routes/inventory.routes.ts:899-901` permite `NO_MEDICAMENTO` sin composicion obligatoria y flags configurables. `backend-fastify/src/__tests__/inventory-prices.test.ts:132` prueba no medicamento sin composicion. | Bajo. | Mantener. | P3 |
| Familias/categorias | OK | `backend-fastify/src/routes/inventory.routes.ts:300-348` bloquea familia usada; `:460-513` bloquea categoria usada. | Bajo. | Mantener. | P3 |
| Precio 1/2/3 e historial | OK | `backend-fastify/src/routes/inventory.routes.ts:780-837` actualiza precios canonicos. `:1214-1242` expone historial. `backend-fastify/src/__tests__/inventory-prices.test.ts:151` prueba historial. | Bajo. | Agregar test E2E UI si se requiere. | P3 |
| Compra credito | OK | `backend-fastify/src/routes/purchases.routes.ts:218-244` valida `CREDITO` y vencimiento factura. `:488-500` crea CXP. `backend-fastify/src/__tests__/purchases.test.ts:284` prueba rechazo sin fecha. | Bajo. | Mantener. | P3 |
| Compra contado | PARCIAL | `backend-fastify/src/routes/purchases.routes.ts:501-516` crea egreso si hay caja, pero si no hay caja registra compra contado igual. | Descuadre caja/contabilidad: compra contado sin egreso real. | Decidir y aplicar regla: bloquear contado sin caja abierta o registrar pago pendiente formal. | P0 |
| Compra con lote/costo/kardex | OK | `backend-fastify/src/routes/purchases.routes.ts:409-472` bloquea producto, crea/actualiza lote con `nprecio_compra` e inserta kardex. Tests en `backend-fastify/src/__tests__/purchases.test.ts:118-168`. | Bajo. | Mantener. | P3 |
| Compra producto sin lote | OK | `backend-fastify/src/routes/purchases.routes.ts:296-339` valida flags por producto. `backend-fastify/src/__tests__/purchases.test.ts:171` permite compra sin lote/vencimiento cuando no requiere. | Bajo. | Mantener. | P3 |
| Venta POS con caja asignada | OK | `backend-fastify/src/routes/sales.routes.ts:176-190` exige caja abierta asignada al usuario. Tests: `backend-fastify/src/__tests__/sales.test.ts:112`, `:129`, `:148`. | Bajo. | Mantener. | P3 |
| Venta POS precio permitido | OK | `backend-fastify/src/routes/sales.routes.ts:300-346` valida stock y precio configurado. Test `backend-fastify/src/__tests__/sales.test.ts:195`. | Bajo. | Mantener. | P3 |
| Venta FEFO/lotes vigentes | OK | `backend-fastify/src/routes/sales.routes.ts:349-390` selecciona lotes activos, no vencidos, ordenados por vencimiento, con `FOR UPDATE`. Tests `backend-fastify/src/__tests__/sales.test.ts:238`, `:258`, `:280`. | Bajo. | Mantener. | P3 |
| Anulacion venta | OK | `backend-fastify/src/routes/sales.routes.ts:551-662` revierte stock/lote y kardex. Tests `backend-fastify/src/__tests__/sales.test.ts:354`, `:380`. | Bajo. | Mantener. | P3 |
| Caja apertura/asignacion | OK | `backend-fastify/src/routes/caja.routes.ts:153-199` solo admin/super abre y asigna a usuario activo. `frontend/src/pages/caja-page.tsx:108` filtra usuarios activos. Tests `backend-fastify/src/__tests__/caja.test.ts:81`. | Bajo. | Mantener. | P3 |
| Caja cierre automatico | OK | `backend-fastify/src/routes/caja.routes.ts:217-325` cierra por `cajaId`, calcula resumen y persiste totales. | Bajo. | Mantener. | P3 |
| Resumen caja | OK | `backend-fastify/src/routes/caja.routes.ts:599-674` calcula apertura, ventas, ingresos, egresos y saldo esperado. Ignora movimientos anulados con `cestado = 'A'`. | Bajo. | Mantener. | P3 |
| Anulacion movimiento caja | OK | `backend-fastify/src/routes/caja.routes.ts:504-578` endpoint `PATCH /movimientos/:id/anular`, guarda motivo, usuario y fecha. | Bajo. | Mantener. | P3 |
| CXP listado/detalle/pago | PARCIAL | `backend-fastify/src/routes/cxp.routes.ts:10-158` usa solo `requireAuth`; `:189-244` pago efectivo exige caja y llama `fn_aplicar_pago_cxp`. Test unico en `backend-fastify/src/__tests__/cxp.test.ts:32`. | Cobertura baja y permisos financieros incompletos. | Agregar permisos backend y tests de sobrepago, parcial, total y caja. | P1 |
| Reporte utilidad con lotes | OK | `backend-fastify/src/routes/reports.routes.ts:105-184` calcula ingreso/costo/utilidad desde kardex y lote. Test `backend-fastify/src/__tests__/reports.test.ts:32`. | Bajo para ventas con lote. | Mantener. | P3 |
| Reporte utilidad sin lote | PARCIAL | `backend-fastify/src/routes/reports.routes.ts:146-184` parte desde `kardex_lotes`; una venta sin lote puede no aparecer. `costoFuente: SIN_LOTE` existe en `:227`, pero la query no parte desde detalle completo. | Utilidad incompleta para productos no medicamentosos sin lote. | Incluir lineas sin lote desde `bot_ventas_det` con costo definido por decision de negocio. | P1 |
| Reportes financieros permisos | PARCIAL | `backend-fastify/src/routes/reports.routes.ts:7` usa `requireAuth` global, sin permiso fino de `reportes`. | Exposicion de reportes a cualquier usuario autenticado activo. | Agregar `requireAnyPermission` para reportes. | P1 |
| Lotes vencidos / baja tecnica | PARCIAL | `backend-fastify/src/routes/consistencia.routes.ts:432-507` marca vencidos y ajusta stock/kardex. `traslados-almacen.routes.ts` maneja movimientos a almacenes tipo baja. | Flujo existe tecnicamente, pero UX de merma/baja por lote no queda como operacion clara de usuario. | Decidir si se crea pantalla/accion de merma lote. | P2 |
| Usuarios inactivos | OK | `backend-fastify/src/plugins/auth.ts:53-65` y `:84-103` solo autentican usuarios activos. `backend-fastify/src/routes/auth.routes.ts:124-135` Clerk exige ERP activo. `frontend/src/pages/usuarios-page.tsx:187-194` filtra activos/inactivos/todos. | Bajo. | Mantener tests auth. | P3 |
| Usuario inactivo en caja | OK | `backend-fastify/src/routes/caja.routes.ts:166-184` exige usuario activo al abrir/asignar caja. Test `backend-fastify/src/__tests__/caja.test.ts:81`. | Bajo. | Mantener. | P3 |
| Bootstrap local/migraciones | OK | `start.sh:22-46` define baseline y migraciones 002-022 en orden explicito, incluye doble 006. `start.sh:172` aplica baseline con `ON_ERROR_STOP`; `:197-203` aplica migraciones. | Bajo. | Mantener. | P3 |
| Baseline SQL canonico | OK | `ops/baseline/schema_botica_actual.sql` contiene tablas `bot_*`, campos caja cierre, lotes, almacenes y movimientos. | Bajo. | Mantener sincronizado con migraciones. | P3 |
| Schema Drizzle vs SQL | PARCIAL | `backend-fastify/src/db/schema.ts:48-49` usa `lpermite_venta/lpermite_consumo_clinico`; baseline y migracion usan `bpermite_venta/bpermite_consumo_clinico` (`ops/migrations/010_locales_almacenes.sql:37-38`). `schema.ts:267` usa `nalmacen_id` en movimientos; baseline usa origen/destino. | Falla futura si se usa Drizzle para almacenes/movimientos. | Alinear Drizzle con baseline canonico. | P1 |
| Generacion codigo venta/compra | PARCIAL | `backend-fastify/src/routes/sales.routes.ts:200` y `backend-fastify/src/routes/purchases.routes.ts:364-369` usan `COUNT(*) + 1`. | Colision bajo concurrencia; posible 500 por unique. | Usar secuencia DB o retry transaccional en `23505`. | P1 |
| Pago mixto POS | REQUIERE DECISION | `frontend/src/pos/components/PaymentPanel.tsx:74-109` calcula mixto automatico. `frontend/src/pos/hooks/usePOS.ts:240-251` envia solo `paymentMethod`; backend guarda metodo general. | No hay desglose persistido efectivo/digital para conciliacion. | Decidir si se persiste split de pago. | P2 |

Estados usados: OK, PARCIAL, ROTO, NO IMPLEMENTADO, REQUIERE DECISION. No se encontro flujo ROTO global. No se encontro feature critica totalmente NO IMPLEMENTADA dentro del alcance actual.

## 4. Riesgos priorizados

### P0

1. Compra contado sin caja abierta.
   - Evidencia: `backend-fastify/src/routes/purchases.routes.ts:501-516`.
   - Impacto: compra contado registrada sin egreso de caja.
   - Decision requerida: bloquear o convertir en flujo contable formal.

### P1

1. Reporte utilidad no cubre bien ventas sin lote.
   - Evidencia: `backend-fastify/src/routes/reports.routes.ts:146-184`.
   - Impacto: utilidad subestimada o ventas faltantes para no medicamentos sin lote.

2. Permisos financieros backend incompletos.
   - Evidencia: `backend-fastify/src/routes/cxp.routes.ts:10`, `backend-fastify/src/routes/reports.routes.ts:7`.
   - Impacto: cualquier usuario activo podria consultar/pagar CXP o ver reportes si conoce endpoint.

3. Drift Drizzle vs SQL real.
   - Evidencia: `backend-fastify/src/db/schema.ts:48-49`, `ops/migrations/010_locales_almacenes.sql:37-38`, `ops/baseline/schema_botica_actual.sql:1024-1029`.
   - Impacto: deuda tecnica para Supabase, tooling o futuros modulos Drizzle.

4. Codigo venta/compra no escalable por concurrencia.
   - Evidencia: `backend-fastify/src/routes/sales.routes.ts:200`, `backend-fastify/src/routes/purchases.routes.ts:364-369`.
   - Impacto: colisiones bajo ventas/compras simultaneas.

### P2

1. Pago mixto no persiste desglose.
   - Evidencia: `frontend/src/pos/components/PaymentPanel.tsx:74-109`, `frontend/src/pos/hooks/usePOS.ts:240-251`.
   - Impacto: conciliacion limitada por metodo real.

2. Merma/baja por lote existe tecnicamente, pero no como flujo operativo claro.
   - Evidencia: `backend-fastify/src/routes/consistencia.routes.ts:432-507`, `backend-fastify/src/routes/traslados-almacen.routes.ts`.
   - Impacto: operacion diaria puede depender de criterio tecnico/admin.

### P3

1. Warnings frontend.
   - Tests POS muestran warnings `act(...)`.
   - Build Vite avisa chunk mayor a 500 kB.
   - Impacto: no bloquea funcionalidad; mejorar luego.

## 5. Plan final ejecutable

| Fase | Objetivo | Archivos probables | Tests requeridos | Criterio de aceptacion | Bloquea piloto |
|---|---|---|---|---|---|
| P0 - Compra contado segura | Evitar compra contado sin caja/registro contable. | `backend-fastify/src/routes/purchases.routes.ts`, `backend-fastify/src/__tests__/purchases.test.ts`, `frontend/src/pages/compras-page.tsx`. | Compra contado sin caja falla; contado con caja crea egreso; credito no cambia. | No existe compra contado sin impacto en caja o deuda formal. | Si |
| P1 - Utilidad completa sin lote | Incluir productos no lote en utilidad. | `backend-fastify/src/routes/reports.routes.ts`, `backend-fastify/src/__tests__/reports.test.ts`, `frontend/src/pages/reportes-page.tsx`, `frontend/src/lib/api.ts`. | Venta con lote, venta sin lote, venta multi-lote, venta mixta lote/no-lote. | `ingresoTotal`, `costoTotal`, `utilidadTotal` cuadran con detalle real. | Si venden no medicamentos |
| P1 - Permisos financieros backend | Cerrar permisos reales de CXP/reportes. | `backend-fastify/src/routes/cxp.routes.ts`, `backend-fastify/src/routes/reports.routes.ts`, tests auth/CXP/reportes. | Usuario sin permiso recibe 403; admin/permisos correctos reciben 200. | Backend no depende solo del menu frontend. | Si hay multiusuario |
| P1 - Schema canonico Drizzle | Alinear Drizzle con baseline/migraciones. | `backend-fastify/src/db/schema.ts`, `backend-fastify/src/lib/schema-check.ts`, `backend-fastify/src/__tests__/schema-check.test.ts`. | `tsc`, schema-check y tests actuales. | Nombres Drizzle coinciden con SQL real. | No inmediato |
| P1 - Codigos concurrentes | Evitar colision de `ccodigo` por concurrencia. | `backend-fastify/src/routes/sales.routes.ts`, `backend-fastify/src/routes/purchases.routes.ts`, migracion opcional para secuencias. | Test de dos ventas/compras simultaneas o retry ante `23505`. | Sin error por codigo duplicado bajo concurrencia. | No baja carga |
| P2 - Pago mixto auditable | Persistir split efectivo/digital si negocio lo exige. | `backend-fastify/src/routes/sales.routes.ts`, `frontend/src/pos/hooks/usePOS.ts`, `frontend/src/pos/components/PaymentPanel.tsx`, migracion. | Venta mixta guarda efectivo/digital/vuelto; caja/reporte separan metodo. | Conciliacion por metodo posible. | No, salvo control caja estricto |
| P2 - Merma lote operativa | Dar flujo claro para baja/merma por lote. | `backend-fastify/src/routes/lotes.routes.ts`, `backend-fastify/src/routes/consistencia.routes.ts`, `frontend/src/pages/inventory-page.tsx`. | Baja lote genera kardex, ajusta stock, queda auditada. | Usuario opera merma sin script tecnico. | No |
| P3 - Higiene frontend/performance | Reducir warnings y preparar escala. | POS tests, Vite config, reportes/listados, auth. | Tests sin warnings relevantes; build sin regresion. | Menos ruido QA y mejor mantenibilidad. | No |
| P3 - Preparacion AWS/Supabase futura | Documentar env, CORS, pool, backup/restore y politica Supabase sin migrar aun. | `README`, docs deployment, `start.sh`, backend env. | Smoke local y doc revisada. | Ruta de despliegue clara. | No |

## 6. Validaciones ejecutadas

Backend:

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
```

Resultado: OK. Tests backend: 15 archivos, 113 tests pasados.

Frontend:

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado: OK. Tests frontend: 5 archivos, 55 tests pasados.

Advertencias:

- Tests frontend POS emiten warnings `act(...)`.
- Build frontend emite warning por chunk mayor a 500 kB.

## 7. Estado Git observado

La auditoria encontro worktree sucio previo:

```txt
M backend-fastify/src/__tests__/caja.test.ts
M backend-fastify/src/plugins/auth.ts
M frontend/src/pages/usuarios-page.tsx
M frontend/src/pos/components/Cart.test.tsx
M frontend/src/pos/components/Cart.tsx
M frontend/src/pos/components/PaymentPanel.tsx
M frontend/src/pos/components/SalesPOS.tsx
?? .claude/
?? BOTICA_FASE14_POS_CARRITO_COMPACTO.md
?? BOTICA_FIX_CAJA_OPERATIVA_CAJERO_CIERRE_ADMIN.md
?? CLAUDE.md
?? backend-fastify/src/__tests__/auth.test.ts
?? frontend/src/pos/components/PaymentPanel.test.tsx
```

Este reporte agrega solo documentacion de auditoria.

## 8. Decision recomendada antes de piloto

No iniciar piloto operativo con compras contado reales hasta resolver P0.

Orden recomendado:

1. P0 compra contado segura.
2. P1 permisos financieros backend.
3. P1 utilidad sin lote.
4. P1 codigos concurrentes si habra mas de un operador simultaneo.
5. P1 schema Drizzle antes de usar Drizzle/Supabase tooling como fuente tecnica.

