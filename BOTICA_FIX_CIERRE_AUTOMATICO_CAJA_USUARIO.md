# BOTICA FIX - Cierre automatico por usuario y bloqueo con caja cerrada

## 1. Resumen

Se corrigio cierre real de caja para operar por caja asignada a usuario.

Flujo final:

- Admin abre caja asignada a usuario/cajero.
- Usuario vende solo si su caja asignada esta abierta.
- Admin cierra caja por `cajaId`.
- Admin no ingresa monto contado.
- Sistema calcula cierre automatico.
- Caja cerrada deja de habilitar ventas.

## 2. Problema

La UI todavia pedia monto contado/monto de cierre.

Eso no calzaba con flujo real requerido:

- No hay conteo manual.
- Cierre debe ser calculado por sistema.
- Admin debe cerrar caja asignada, no una caja implicita.
- Caja cerrada no debe permitir venta posterior.

## 3. Cambios backend

Archivo: `backend-fastify/src/routes/caja.routes.ts`

- `POST /api/v1/caja` con `action: "cerrar"`:
  - requiere admin/super.
  - requiere `cajaId`.
  - cierra solo caja abierta con ese `cajaId`.
  - calcula:
    - apertura
    - ventas
    - ingresos
    - egresos manuales
    - pagos factura
    - gastos
    - saldo esperado
  - persiste:
    - `ncierre = saldoEsperado`
    - `nsaldo_esperado = saldoEsperado`
    - `ndiferencia = 0`
    - `cestado = 'C'`
    - `tcierre = NOW()`
    - usuario que cerro
  - ignora cualquier monto manual de cierre.

Formula:

```txt
saldoEsperado = apertura + ventas + ingresos - egresos
egresos = egresosManuales + gastos + pagosFactura
ncierre = saldoEsperado
ndiferencia = 0
```

## 4. Bloqueo real de venta

Archivo: `backend-fastify/src/routes/sales.routes.ts`

No se cambio FEFO ni logica de venta.

Venta ya valida caja con:

```sql
WHERE cestado = 'A'
  AND nusuario_id = $1
```

Se agrego test especifico para caja cerrada:

- si caja fue cerrada, no aparece como `cestado = 'A'`.
- venta retorna `NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas.`

## 5. Cambios frontend

Archivos:

- `frontend/src/lib/api.ts`
- `frontend/src/pages/caja-page.tsx`

Cambios:

- `apiCerrarCaja(cajaId)` ya no recibe monto.
- UI elimina campo `Monto contado`.
- UI elimina calculo de diferencia manual.
- UI muestra:
  - apertura
  - ventas
  - ingresos
  - egresos
  - saldo esperado
  - cierre automatico
  - diferencia `S/0.00`
- Boton queda como cierre automatico.
- Admin selecciona caja abierta y cierra por `cajaId`.

## 6. Tests

Archivo: `backend-fastify/src/__tests__/caja.test.ts`

Agregado/ajustado:

- Admin sin `cajaId` no puede cerrar.
- Admin cierra caja de cajero con cierre automatico.
- `montoCierre = saldoEsperado`.
- `cierreAutomatico = true`.
- `diferencia = 0`.
- Cajero no cierra, aunque tenga `caja_cierre`.

Archivo: `backend-fastify/src/__tests__/sales.test.ts`

Agregado:

- Venta rechaza si caja asignada ya fue cerrada.
- Query de venta exige `cestado = 'A'`.

## 7. Migraciones

No hubo migraciones nuevas.

Se reutilizan columnas existentes en `bot_caja`:

- `ncierre`
- `cestado`
- `tcierre`
- `nventas_total`
- `ningresos_total`
- `negresos_total`
- `npagos_factura_total`
- `ngastos_total`
- `nsaldo_esperado`
- `ndiferencia`
- `ncerrado_por_id`
- `ccerrado_por`

## 8. Validaciones ejecutadas

Puntuales:

```bash
cd backend-fastify && npm test -- caja.test.ts
cd backend-fastify && npm test -- sales.test.ts
cd backend-fastify && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Resultado:

- `caja.test.ts`: 11 tests OK.
- `sales.test.ts`: 18 tests OK.
- Backend TypeScript OK.
- Frontend TypeScript OK.

Validacion completa posterior:

```bash
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
git diff --check
graphify update .
```

Resultado completo:

- Backend tests OK: 110 tests.
- Backend build OK.
- Backend lint OK.
- Frontend tests OK: 51 tests.
- Frontend build OK.
- Frontend lint OK.
- `git diff --check` OK.
- `graphify update .` OK.

## 9. Archivos modificados

- `backend-fastify/src/routes/caja.routes.ts`
- `backend-fastify/src/__tests__/caja.test.ts`
- `backend-fastify/src/__tests__/sales.test.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/caja-page.tsx`
- `BOTICA_FIX_CIERRE_AUTOMATICO_CAJA_USUARIO.md`

## 10. Archivos no tocados por este fix

No se toco:

- FEFO
- compras
- CXP
- productos
- reportes
- layout global

Archivos sucios previos sin revertir:

- `frontend/src/pos/components/Cart.tsx`
- `frontend/src/pos/components/Cart.test.tsx`

## 11. Checklist final

- [x] Admin abre caja asignada.
- [x] Usuario vende solo con caja abierta.
- [x] Cierre requiere `cajaId`.
- [x] Admin cierra por caja asignada.
- [x] Admin no ingresa monto contado.
- [x] Sistema calcula cierre automatico.
- [x] `ncierre` persiste saldo esperado.
- [x] `ndiferencia` queda 0.
- [x] Caja cerrada bloquea venta.
- [x] Reporte MD generado.
