# BOTICA P2 - Pago mixto auditable

Fecha: 2026-05-13

## 1. Resumen

Se implementó pago mixto auditable para ventas.

El sistema ahora puede persistir el desglose real de una venta mixta:

- monto efectivo
- monto digital
- vuelto
- método de pago secundario

Esto permite conciliación más clara entre POS, caja y reportes.

## 2. Problema corregido

Antes el frontend calculaba el pago mixto, pero el backend no persistía el desglose completo.

Riesgo:

- La venta quedaba con método general.
- No había detalle auditable de efectivo vs digital.
- Caja no podía diferenciar efectivo neto de pago digital.
- La conciliación era limitada.

## 3. Regla final

Pago mixto:

- Guarda `nmonto_efectivo`.
- Guarda `nmonto_digital`.
- Guarda `nvuelto`.
- Guarda `cmetodo_pago_secundario`.
- El efectivo neto para caja es `nmonto_efectivo - nvuelto`.
- El pago digital queda separado para conciliación.

Ejemplos:

- Total `200`, efectivo `50`:
  - digital `150`
  - vuelto `0`

- Total `200`, efectivo `250`:
  - digital `0`
  - vuelto `50`

## 4. Migración

Archivo creado:

- `ops/migrations/024_ventas_pago_mixto_desglose.sql`

Columnas agregadas en `bot_ventas`:

- `nmonto_efectivo`
- `nmonto_digital`
- `nvuelto`
- `cmetodo_pago_secundario`

La migración es idempotente.

## 5. Cambios backend

Ventas:

- Backend recibe desglose de pago mixto.
- Backend valida montos no negativos.
- Backend persiste desglose en `bot_ventas`.
- Pago efectivo normal mantiene comportamiento existente.

Caja:

- Caja usa efectivo neto para saldo esperado:
  - `nmonto_efectivo - nvuelto`
- Caja expone:
  - `ventasTotal`
  - `ventasDigital`

## 6. Cambios frontend

POS envía:

- `montoEfectivo`
- `montoDigital`
- `vuelto`
- `metodoPagoSecundario`

El frontend mantiene cálculo automático:

- Total `200` + efectivo `50` → digital `150`, vuelto `0`.
- Total `200` + efectivo `250` → digital `0`, vuelto `50`.

## 7. Bootstrap y baseline

Archivos actualizados:

- `start.sh`
- `ops/baseline/schema_botica_actual.sql`

Cambios:

- `start.sh` incluye migración 024.
- Baseline incluye columnas de pago mixto.

## 8. Tests

Tests agregados:

- Venta mixta `total=200`, efectivo `50` guarda digital `150` y vuelto `0`.
- Venta mixta `total=200`, efectivo `250` guarda digital `0` y vuelto `50`.
- Venta mixta rechaza montos negativos.
- POS envía desglose auditable.

## 9. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npx vitest run src/__tests__/sales.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint

git diff --check
```
