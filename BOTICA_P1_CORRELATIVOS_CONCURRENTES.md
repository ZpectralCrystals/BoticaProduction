# BOTICA P1 - Correlativos concurrentes ventas/compras

Fecha: 2026-05-13

## 1. Resumen

Se corrigió P1 de auditoría: códigos de ventas y compras ya no se generan con `COUNT(*) + 1`.

Regla final:

- Ventas usan secuencia PostgreSQL.
- Compras usan secuencia PostgreSQL.
- Formato visible se mantiene:
  - `VTA-YYYYMMDD-0001`
  - `CMP-YYYYMMDD-0001`
- Bajo concurrencia, PostgreSQL garantiza valores distintos por `nextval`.

## 2. Problema corregido

Antes, ventas/compras podían calcular el siguiente correlativo con conteo de filas.

Riesgo:

- dos usuarios registran al mismo tiempo
- ambos leen mismo conteo
- ambos intentan mismo código
- falla por colisión o se rompe operación

## 3. Cambios backend

Archivos modificados:

- `backend-fastify/src/routes/sales.routes.ts`
- `backend-fastify/src/routes/purchases.routes.ts`

Cambios:

- `POST /api/v1/ventas` usa `nextval('public.bot_ventas_codigo_seq')`.
- `POST /api/v1/compras` usa `nextval('public.bot_compras_codigo_seq')`.
- Se eliminó dependencia de `COUNT(*) + 1` para códigos `VTA-*` y `CMP-*`.

## 4. Migración

Archivo creado:

- `ops/migrations/023_correlativos_ventas_compras.sql`

Objetos creados:

- `public.bot_ventas_codigo_seq`
- `public.bot_compras_codigo_seq`

La migración es idempotente y alinea las secuencias con códigos existentes usando el mayor sufijo encontrado en:

- `VTA-YYYYMMDD-NNNN`
- `CMP-YYYYMMDD-NNNN`

## 5. Bootstrap y baseline

Archivos modificados:

- `start.sh`
- `ops/baseline/schema_botica_actual.sql`

Cambios:

- `start.sh` aplica `023_correlativos_ventas_compras.sql`.
- Baseline canónico incluye ambas secuencias.

## 6. Tests

Archivos modificados:

- `backend-fastify/src/__tests__/sales.test.ts`
- `backend-fastify/src/__tests__/purchases.test.ts`

Cobertura agregada:

- Venta usa secuencia y no usa `COUNT(*) + 1`.
- Compra usa secuencia y no usa `COUNT(*) + 1`.
- Dos ventas seguidas generan códigos distintos.
- Dos compras seguidas generan códigos distintos.
- Formato de código se mantiene.
- Flujo venta sigue funcionando.
- Flujo compra contado/crédito sigue funcionando por suite existente.

## 7. Validaciones ejecutadas

```bash
cd backend-fastify && npx vitest run src/__tests__/sales.test.ts src/__tests__/purchases.test.ts
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
bash -n start.sh
git diff --check
graphify update .
```

Resultado:

- Backend TypeScript OK.
- Backend tests OK.
- Backend build OK.
- Backend lint OK.
- `start.sh` sintaxis OK.
- `git diff --check` OK.
- Graphify actualizado.

## 8. Riesgos

- Secuencia no reinicia por día. El formato conserva fecha del día y sufijo numérico, pero el sufijo es global para garantizar concurrencia segura.
- Si se desea correlativo diario estricto, se recomienda implementar tabla de correlativos con llave por fecha y `SELECT ... FOR UPDATE`, no `COUNT(*) + 1`.
- `backend-fastify/src/routes/transfers.routes.ts` aún usa `COUNT(*) + 1`, pero está fuera del alcance de este P1 porque solo cubre ventas/compras.

## 9. Checklist final

- [x] No queda `COUNT(*) + 1` en ventas/compras.
- [x] Ventas generan código único con secuencia.
- [x] Compras generan código único con secuencia.
- [x] Formato visible se mantiene.
- [x] Migración 023 creada.
- [x] `start.sh` actualizado.
- [x] Baseline actualizado.
- [x] Tests agregados.
- [x] Validaciones ejecutadas.
