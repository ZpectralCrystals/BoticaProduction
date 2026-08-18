# BOTICA FASE 5 - Utilidad por venta y por linea

## 1. Resumen

Se agrego reporte de utilidad real por venta y por linea usando costo real del lote consumido. La fuente de costo es `bot_lotes.nprecio_compra`; la trazabilidad de consumo viene de `bot_kardex` con `ctipo = 'VENTA'` y `cref_tabla = 'bot_ventas'`.

## 2. Archivos revisados via Graphify

- `backend-fastify/src/routes/reports.routes.ts`
- `backend-fastify/src/routes/sales.routes.ts`
- `backend-fastify/src/db/schema.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/reportes-page.tsx`
- `backend-fastify/src/__tests__/helpers/buildTestApp.ts`

## 3. Cambios aplicados

- Nuevo endpoint: `GET /api/v1/reportes?tipo=utilidad-ventas&desde=YYYY-MM-DD&hasta=YYYY-MM-DD`.
- Query usa CTE de detalle vendido por producto y CTE de lotes consumidos desde Kardex.
- Calcula por linea:
  - cantidad consumida
  - ingreso asignado por precio promedio de detalle
  - costo unitario real del lote
  - costo total
  - utilidad
  - margen
- Agrupa por venta en respuesta `ventas`.
- Devuelve detalle plano en `lineas`.
- UI de reportes agrega opcion `Utilidad por venta`.
- UI muestra resumen y tabla por linea.
- Tests backend cubren calculo de utilidad por lote y validacion de fecha.

## 4. No tocado

- Caja
- Compras
- CXP
- Layout
- Clerk
- Legacy PHP/Supabase
- FEFO existente

## 5. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test -- reports.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado:

- Backend TypeScript OK
- Backend test focal OK: `reports.test.ts`, 2 tests
- Backend suite OK: 13 archivos, 98 tests
- Backend build OK
- Backend lint OK
- Frontend TypeScript OK
- Frontend suite OK: 4 archivos, 50 tests
- Frontend build OK
- Frontend lint OK

Notas:

- Frontend tests conservan warning existente de React `act(...)` en `usePOS.test.ts`.
- Build Vite conserva warning existente de chunk mayor a 500 kB.
