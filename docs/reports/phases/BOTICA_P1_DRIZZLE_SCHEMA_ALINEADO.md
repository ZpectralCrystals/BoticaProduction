# BOTICA P1 - Drizzle schema alineado

Fecha: 2026-05-13

## 1. Resumen

Se cerró P1 de auditoría: `backend-fastify/src/db/schema.ts` quedó alineado con el SQL real definido en `ops/baseline/schema_botica_actual.sql`.

No se cambiaron reglas de negocio.
No se tocó frontend.
No se creó migración nueva porque la base/baseline ya tenían la estructura correcta.

## 2. Drift corregido

Drift principal detectado:

- Drizzle usaba nombres que no existen en SQL real para almacenes:
  - `lpermite_venta`
  - `lpermite_consumo_clinico`
- SQL real usa:
  - `bpermite_venta`
  - `bpermite_consumo_clinico`
  - `brequiere_revision`

También se alinearon columnas reales de ventas, compras, detalle, kardex y movimientos de almacén.

## 3. Tablas alineadas

Tablas revisadas/alineadas:

- `bot_almacenes`
- `bot_movimientos_almacen`
- `bot_productos`
- `bot_lotes`
- `bot_compras`
- `bot_compras_det`
- `bot_ventas`
- `bot_ventas_det`
- `bot_kardex`
- `bot_caja`

## 4. Cambios en schema.ts

Archivo:

- `backend-fastify/src/db/schema.ts`

Cambios principales:

- `bot_almacenes` ahora usa columnas reales:
  - `ccodigo`
  - `bpermite_venta`
  - `bpermite_consumo_clinico`
  - `brequiere_revision`
- `bot_movimientos_almacen` ahora usa columnas reales:
  - `nlote_id`
  - `nalmacen_origen_id`
  - `nalmacen_destino_id`
  - `tcreado`
- `bot_compras_det` usa `npreunit`, no `nprecio_unit`.
- `bot_ventas` usa columnas reales como `cmetpago`, `nsubtotal`, `nigv`, `nusuario_id`, `nalmacen_id`.
- `bot_ventas_det` usa `npreunit`, `nlote_id`, `clote_codigo`.
- `bot_kardex` usa `ctipo`, `cref_tabla`, `nref_id`, `nstock_anterior`, `nstock_nuevo`, `tcreado`.

## 5. Cambios en schema-check.ts

Archivo:

- `backend-fastify/src/lib/schema-check.ts`

Cambios:

- Se agregó verificación de tabla `bot_compras_det`.
- Se agregaron columnas críticas reales para:
  - compras detalle
  - ventas
  - ventas detalle
  - movimientos de almacén
  - almacenes
- Se reforzó verificación de flags reales `bpermite_*`.

## 6. Tests

Archivo:

- `backend-fastify/src/__tests__/schema-check.test.ts`

Cobertura agregada:

- `bot_compras_det` forma parte de tablas requeridas.
- Columnas críticas reales forman parte del schema-check.
- Test confirma uso de `bpermite_venta` y `bpermite_consumo_clinico`.
- Test confirma que no se esperan nombres legacy `lpermite_venta` ni `lpermite_consumo_clinico`.

## 7. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npx vitest run src/__tests__/schema-check.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
git diff --check
graphify update .
```

Resultado:

- TypeScript OK.
- `schema-check.test.ts`: 8 tests OK.
- Backend completo: 15 files, 129 tests OK.
- Build OK.
- Lint OK.
- `git diff --check` OK.
- Graphify actualizado.

## 8. Migraciones

No se creó migración nueva.

Motivo:

- El drift estaba en Drizzle/schema-check.
- SQL real y baseline ya tenían columnas correctas.
- Crear migración habría duplicado o forzado cambios innecesarios.

## 9. Riesgos pendientes

- `schema.ts` sigue siendo una representación parcial del ERP completo. Si nuevas rutas empiezan a usar Drizzle para tablas legacy/no mapeadas, habrá que ampliar schema.
- Cambios futuros de SQL deben reflejarse en `schema.ts` y `schema-check.ts` en la misma fase.
- `schema-check` valida columnas críticas, no cada constraint ni índice del baseline.

## 10. Checklist

- [x] `schema.ts` alineado con baseline en tablas críticas.
- [x] `bot_almacenes` usa `bpermite_*`.
- [x] `bot_movimientos_almacen` usa columnas reales.
- [x] Compras/ventas/detalles/kardex/caja revisados.
- [x] `schema-check.ts` actualizado.
- [x] Tests schema-check actualizados.
- [x] Sin migración nueva.
- [x] Frontend no tocado.
- [x] Reglas de negocio no tocadas.
- [x] Validaciones OK.
