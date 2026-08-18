# BOTICA FASE 4 - Cierre de caja persistente

## 1. Resumen ejecutivo

Se implemento persistencia formal del cierre de caja en `bot_caja`. Al cerrar una caja, el backend guarda un snapshot con ventas, ingresos, egresos manuales, pagos de factura, gastos, saldo esperado, monto contado, diferencia, fecha de cierre y usuario que cerro.

No se tocaron FEFO, compras, CXP, lotes ni layout.

## 2. Mapa Graphify usado

Se uso `graphify` para ubicar los puntos de cambio:

- Ruta backend: `backend-fastify/src/routes/caja.routes.ts`
- Schema/modelo: `backend-fastify/src/db/schema.ts`
- Tests caja: `backend-fastify/src/__tests__/caja.test.ts`
- API frontend: `frontend/src/lib/api.ts`
- Pantalla caja: `frontend/src/pages/caja-page.tsx`

## 3. Migracion nueva

Archivo:

- `ops/migrations/021_cierre_caja_persistente.sql`

Columnas agregadas de forma idempotente:

- `nventas_total`
- `ningresos_total`
- `negresos_total`
- `npagos_factura_total`
- `ngastos_total`
- `nsaldo_esperado`
- `ndiferencia`
- `ncerrado_por_id`
- `ccerrado_por`

Campos existentes reutilizados:

- `napertura`: monto de apertura
- `ncierre`: monto contado/cierre
- `tcierre`: fecha de cierre

## 4. Cambios backend

En `backend-fastify/src/routes/caja.routes.ts`:

- El cierre separa egresos por tipo:
  - egresos manuales: `EGRESO`
  - pagos factura: `PAGO_FACTURA`
  - gastos: `GASTO`
- El cierre mantiene el total `egresos` para compatibilidad.
- El `UPDATE bot_caja` ahora persiste el snapshot calculado.
- El historial de cajas retorna los totales persistidos.
- El resumen de caja mantiene calculo contra movimientos activos, excluyendo anulados por `cestado = 'A'`.

En `backend-fastify/src/db/schema.ts`:

- Se agregaron las columnas nuevas al modelo Drizzle de `bot_caja`.

## 5. Cambios frontend

En `frontend/src/lib/api.ts`:

- Se agrego `ApiCajaHistorial`.
- Se ampliaron tipos de resumen con `egresosManuales`, `pagosFactura` y `gastos`.

En `frontend/src/pages/caja-page.tsx`:

- El historial de cajas muestra `Esperado` y `Diferencia` usando el snapshot persistido.

## 6. Tests actualizados

En `backend-fastify/src/__tests__/caja.test.ts`:

- Se valido que cierre de caja persista `nventas_total` y demas campos calculados.
- Se valido que el resumen conserve desglose de gastos.

## 7. Validaciones ejecutadas

Backend:

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test -- caja.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
```

Resultado:

- TypeScript OK
- Test focal caja OK: 6 tests
- Suite backend OK: 12 archivos, 96 tests
- Build backend OK
- Lint backend OK

Frontend:

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado:

- TypeScript OK
- Suite frontend OK: 4 archivos, 50 tests
- Build frontend OK
- Lint frontend OK
- Build Vite emitio solo warning existente de chunk mayor a 500 kB.
- Intento focal `npm test -- caja-page` no aplica porque no existe archivo `caja-page.test`.

## 8. Resultado final esperado

- Al cerrar caja, el resumen queda congelado en `bot_caja`.
- Si despues se anulan movimientos, el historial del cierre conserva la auditoria del momento de cierre.
- La UI puede mostrar esperado y diferencia historicos sin recalcular contra movimientos actuales.

## 9. Riesgos y pendientes recomendados

- Aplicar la migracion `021_cierre_caja_persistente.sql` en la base objetivo antes de desplegar backend que consulta esas columnas.
- Recomendado posterior: agregar test de UI especifico para historial de cajas si se crea infraestructura de test para `CajaPage`.
