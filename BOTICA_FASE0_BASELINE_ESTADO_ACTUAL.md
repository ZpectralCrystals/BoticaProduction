# BOTICA_FASE0_BASELINE_ESTADO_ACTUAL.md

## 1. Resumen ejecutivo

Fase 0 congela el estado técnico actual de **Botica El Pueblo** después de las implementaciones recientes de lotes, vencimientos, precios múltiples, FEFO, compras contado/crédito, caja, cuentas por pagar, layout full width y auditoría final de flujos.

En esta fase no se modificó lógica de negocio, no se crearon migraciones y no se cambiaron frontend/backend. Solo se ejecutó auditoría documental, revisión de git y comandos de validación.

Fecha de baseline: 2026-05-11.

## 2. Documentos obligatorios leídos

- `BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md`
- `BOTICA_LAYOUT_FULL_WIDTH.md`
- `BOTICA_AUDITORIA_FINAL_FLUJOS.md`
- `RADIOGRAFIA_COMPLETA_BOTICA_EL_PUEBLO.md`
- `CONTEXTO_ACTUAL_PROYECTO.md`
- `CONTEXTO_PARA_CONTINUAR_DESARROLLO.md`

## 3. Estado git observado

- Rama: `main`
- HEAD corto: `9156352`
- `git diff --stat`: 43 archivos modificados, 3730 inserciones, 284 eliminaciones
- `git status --short`: 43 archivos tracked modificados y 24 entradas untracked de primer nivel
- `git ls-files --others --exclude-standard`: lista muy grande por `graphify-out/cache/ast/*`

Entradas tracked modificadas principales:

- `backend-fastify/package.json`
- `backend-fastify/package-lock.json`
- `backend-fastify/src/db/schema.ts`
- `backend-fastify/src/routes/ajustes.routes.ts`
- `backend-fastify/src/routes/caja.routes.ts`
- `backend-fastify/src/routes/inventory.routes.ts`
- `backend-fastify/src/routes/purchases.routes.ts`
- `backend-fastify/src/routes/reports.routes.ts`
- `backend-fastify/src/routes/sales.routes.ts`
- `backend-fastify/src/routes/users.routes.ts`
- `backend-fastify/src/server.ts`
- `backend-fastify/src/test-utils.ts`
- `backend-fastify/src/**/*.test.ts`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/app/router.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/shared/page-header.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/*.tsx`
- `frontend/src/pos/**/*`
- `frontend/src/test/setup.ts`
- `mcp-server/index.js`
- `start.sh`

Entradas untracked relevantes:

- `.codex/`
- `.graphify_detect.json`
- `.graphify_python`
- `AGENTS.md`
- `BOTICA_AUDITORIA_FINAL_FLUJOS.md`
- `BOTICA_LAYOUT_FULL_WIDTH.md`
- `BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md`
- `CONTEXTO_ACTUAL_PROYECTO.md`
- `CONTEXTO_PARA_CONTINUAR_DESARROLLO.md`
- `RADIOGRAFIA_COMPLETA_BOTICA_EL_PUEBLO.md`
- `backend-fastify/eslint.config.js`
- `backend-fastify/src/routes/cxp.routes.ts`
- `backend-fastify/src/routes/*.test.ts` nuevos
- `backend-fastify/src/scripts/ensure-test-user.ts`
- `backend-fastify/src/test-env.d.ts`
- `backend-fastify/src/types/fastify.d.ts`
- `backend-fastify/src/utils/`
- `drizzle/015_*` a `drizzle/020_*`
- `frontend/src/pages/cxp-page.tsx`
- `graphify-out/`
- `mcp_run_20260510_195933.log`

## 4. Baseline funcional observado

### Productos

- Producto soporta nombre comercial, composición/principio activo, familia, categoría y precios de venta 1, 2 y 3.
- Precio 1 queda validado como obligatorio.
- Precio 2 y Precio 3 son opcionales.
- Precio de compra se maneja desde lotes/compras, no como campo editable principal del producto.
- Cambios de precio de venta quedan cubiertos por historial.
- Categoría/familia en uso no deben eliminarse.

### Compras

- Compra registra proveedor, condición CONTADO/CRÉDITO, lotes, vencimiento y costo por lote.
- Compra CONTADO genera egreso de caja.
- Compra CRÉDITO genera cuenta por pagar.
- Kardex registra entrada con lote.
- Compra usa transacción según auditoría.

### Lotes y vencimientos

- Vencimiento vive en lote.
- Un producto puede tener varios lotes con vencimientos y costos distintos.
- Reporte de vencimientos muestra detalle por lote.
- Venta excluye lotes vencidos en lógica FEFO.
- Baja/merma por lote vencido existe como flujo recomendado/documentado, con endpoint de ajustes revisado.

### Ventas POS

- POS muestra una fila por producto y stock total disponible.
- Precio 1 se usa por defecto; Precio 2/3 pueden elegirse cuando existen.
- Venta consume lotes automáticamente por FEFO.
- Venta no permite exceder stock disponible.
- Lotes vencidos no se venden.
- Trazabilidad de lote consumido existe vía Kardex/equivalente, no como tabla separada `venta_detalle_lotes`.
- Costo real y ganancia quedan calculables desde costo de lote consumido.

### Caja

- Caja puede abrirse y cerrarse.
- Venta en efectivo genera ingreso.
- Pago a proveedor genera egreso.
- Gasto manual genera egreso.
- Cierre calcula monto inicial, ingresos, egresos, saldo esperado, monto contado y diferencia.
- Movimientos cerrados no deberían modificarse directo; anulación en vez de eliminación queda como riesgo/pending si no hay endpoint explícito.

### Cuentas por pagar

- Compra CRÉDITO crea cuenta por pagar.
- CXP lista pendientes.
- Pago parcial actualiza saldo.
- Pago total marca como PAGADA.
- Pago genera egreso de caja.
- No permite pagar más que saldo pendiente.

### Layout

- `AppShell` y páginas principales quedaron full width.
- Se removieron límites globales tipo `max-w-*`, `container`, `mx-auto` del panel principal.
- Login conserva layout centrado.
- Dashboard, inventario, ventas, compras, caja, reportes y CXP usan ancho disponible.

## 5. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
```

Resultado: OK.

```bash
cd backend-fastify && npm test
```

Resultado: OK. 11 archivos de test, 88 tests passed.

```bash
cd backend-fastify && npm run build
```

Resultado: OK.

```bash
cd backend-fastify && npm run lint
```

Resultado: OK.

```bash
cd frontend && npx tsc --noEmit
```

Resultado: OK.

```bash
cd frontend && npm test
```

Resultado: OK. 4 archivos de test, 49 tests passed. Hay warnings de React `act(...)` en `src/pos/hooks/usePOS.test.ts`; no bloquean.

```bash
cd frontend && npm run build
```

Resultado: OK. Vite reporta warning de chunk mayor a 500 kB; no bloquea.

```bash
cd frontend && npm run lint
```

Resultado: OK en segundo intento. Primer intento falló por archivo temporal inexistente de Vitest/ESLint: `vitest.config.ts.timestamp-1778476053226-15253ccca5932.mjs`. No se hicieron cambios de código para corregirlo.

## 6. Cambios aplicados en esta fase

- Se creó este documento de baseline.
- No se modificó lógica de negocio.
- No se modificó frontend funcional.
- No se modificó backend funcional.
- No se crearon migraciones.
- No se cambiaron datos de prueba.

## 7. Riesgos encontrados

- Worktree está muy sucio; conviene revisar, ordenar y commitear por bloques.
- `graphify-out/` genera muchos archivos untracked; puede contaminar status y diffs si no se ignora o limpia.
- No existe tabla separada `venta_detalle_lotes`; la trazabilidad se considera cubierta por Kardex/equivalente.
- Si la regla “no vender sin caja abierta” debe ser obligatoria, confirmar enforcement exacto en backend y frontend.
- Confirmar si existe endpoint formal de anulación de movimientos de caja; eliminar/modificar directo debe evitarse.
- Vite advierte chunk grande en build frontend; pendiente optimización de bundle si impacta carga inicial.
- Tests frontend muestran warnings `act(...)`; conviene limpiarlos para QA más estricto.

## 8. Pendientes recomendados

- Crear commit baseline antes de nuevas fases.
- Definir si `graphify-out/`, `.graphify_*` y logs deben ir a `.gitignore`.
- Separar commits: documentación, backend dominio, frontend POS/layout, tests, tooling.
- Agregar pruebas E2E críticas para compra crédito, pago parcial CXP, venta FEFO y cierre de caja.
- Revisar política de caja abierta obligatoria antes de ventas.
- Revisar anulación formal de movimientos cerrados.

## 9. Checklist final fase 0

- [x] Documentos obligatorios leídos.
- [x] Estado git revisado.
- [x] Backend TypeScript validado.
- [x] Backend tests ejecutados.
- [x] Backend build ejecutado.
- [x] Backend lint ejecutado.
- [x] Frontend TypeScript validado.
- [x] Frontend tests ejecutados.
- [x] Frontend build ejecutado.
- [x] Frontend lint ejecutado.
- [x] Sin cambios de lógica de negocio.
- [x] Sin migraciones nuevas en fase 0.
- [x] Baseline documentado.
