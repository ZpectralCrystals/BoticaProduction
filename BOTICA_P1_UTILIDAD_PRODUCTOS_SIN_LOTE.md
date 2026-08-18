# BOTICA P1 - Utilidad para productos sin lote

Fecha: 2026-05-13

## 1. Resumen

Se cerró P1 de auditoría: el reporte `utilidad-ventas` ya incluye ventas de productos sin lote.

Regla final aplicada:

- El reporte parte desde `bot_ventas_det`.
- No depende solo de kardex/lotes.
- Ventas con lote calculan costo desde lote/kardex.
- Ventas multi-lote suman costos de todos los lotes consumidos.
- Ventas sin lote aparecen en el reporte.
- Si no hay costo real, la línea queda con:
  - `costoTotal = 0`
  - `costoFuente = "SIN_LOTE"`
  - `costoIncompleto = true`
  - `lotesConsumidos = []`
- Ventas anuladas no cuentan.

## 2. Riesgo corregido

La auditoría detectó que el reporte de utilidad podía quedar incompleto si partía solo desde kardex/lotes.

Riesgo:

- Productos `NO_MEDICAMENTO` pueden venderse sin lote.
- Esas ventas podían quedar fuera del reporte.
- La utilidad e ingresos podían quedar subestimados.
- El margen podía no representar toda la venta real.

## 3. Backend

Archivo revisado:

- `backend-fastify/src/routes/reports.routes.ts`

Evidencia:

- El reporte usa `FROM bot_ventas_det` como base de líneas vendidas.
- El costo por lote se asocia con `LEFT JOIN kardex_lotes`.
- Cuando no existe lote/costo, asigna costo `0`.
- Cuando no existe lote/costo, asigna `costo_fuente = 'SIN_LOTE'`.
- Cuando no existe lote/costo, asigna `costo_incompleto = true`.
- Las ventas anuladas se excluyen con `v.cestado = 'A'`.

## 4. Frontend

Archivo revisado:

- `frontend/src/pages/reportes-page.tsx`

Evidencia:

- El reporte muestra badge `Costo incompleto` cuando corresponde.
- Las ventas sin lote no se ocultan.
- No se cambió layout global.

## 5. Tests

Archivo revisado:

- `backend-fastify/src/__tests__/reports.test.ts`

Cobertura confirmada:

- Venta con lote.
- Venta multi-lote.
- Venta sin lote.
- Totales.
- Ventas anuladas.

## 6. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npx vitest run src/__tests__/reports.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint

git diff --check
graphify update .
```

Resultado:

- Backend: 15 files, 124 tests OK.
- Frontend: 5 files, 55 tests OK.
- Build OK.
- Lint OK.
- `git diff --check` OK.
- `graphify update .` OK.

Warnings no bloqueantes:

- React `act(...)` en POS tests.
- Vite chunk >500 KB.

## 7. Alcance no tocado

No se tocaron:

- Caja.
- Compras.
- CXP.
- FEFO.
- Permisos.
- Clerk.
- Layout global.

## 8. Archivos modificados

- `BOTICA_P1_UTILIDAD_PRODUCTOS_SIN_LOTE.md`

