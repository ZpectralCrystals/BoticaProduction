# BOTICA FIX - Caja operativa cajero + cierre admin

## 1. Resumen ejecutivo

Se completó el flujo operativo de caja para separar responsabilidades:

- Administrador abre caja y la asigna a un usuario/cajero.
- Cajero asignado ve su caja, resumen y movimientos.
- Cajero puede registrar movimientos permitidos en su caja.
- Cajero no puede cerrar caja.
- Administrador puede seleccionar/ver/cerrar caja de cualquier cajero.
- Cierre calcula saldo esperado automáticamente.
- Administrador solo ingresa monto contado.
- Diferencia se calcula como `monto contado - saldo esperado`.

## 2. Problema corregido

El flujo anterior mezclaba dos casos:

- Cajero necesitaba operar su caja asignada sin tener permisos de administrador.
- Administrador necesitaba cerrar caja de otro usuario, pero la UI no dejaba claro qué caja se estaba revisando/cerrando.

También la UI mostraba `Monto de cierre` sin desglose operativo suficiente, lo que daba a entender cálculo manual.

## 3. Cambios backend

Archivo: `backend-fastify/src/routes/caja.routes.ts`

- `GET /api/v1/caja` mantiene:
  - `cajaAbierta`: caja asignada al usuario autenticado.
  - `cajasAbiertas`: cajas visibles para admin, o caja propia para cajero.
- `POST /api/v1/caja` con `action: "abrir"` exige `usuarioId`.
- `POST /api/v1/caja` con `action: "cerrar"` queda restringido a admin/super.
- `GET /api/v1/caja/resumen?cajaId=...` soporta resumen de caja específica.
- Resumen valida permisos:
  - Cajero solo ve caja asignada.
  - Admin ve cualquier caja abierta.
- Resumen devuelve:
  - apertura
  - ventas
  - ingresos
  - egresos manuales
  - pagos factura
  - gastos
  - egresos totales
  - saldoTeorico
  - saldoEsperado
  - usuario asignado
- `POST /api/v1/caja/movimientos` acepta `cajaId` opcional y valida acceso.

## 4. Cambios frontend

Archivos:

- `frontend/src/lib/api.ts`
- `frontend/src/pages/caja-page.tsx`

Cambios aplicados:

- API client agregó `cajaId` en resumen.
- API client agregó `cajaId` opcional en movimientos.
- `CajaPage` permite a admin seleccionar caja abierta para resumen/cierre.
- `CajaPage` muestra saldo esperado automático.
- `CajaPage` muestra desglose:
  - apertura
  - ventas
  - ingresos
  - egresos/gastos/pagos
  - saldo esperado
- Admin ingresa solo monto contado.
- UI calcula diferencia en vivo.
- Cajero ve mensaje claro: cierre reservado para administrador.
- Cajero mantiene operación de movimientos sobre su caja asignada.

## 5. Tests agregados/ajustados

Archivo: `backend-fastify/src/__tests__/caja.test.ts`

- Admin abre caja asignada a cajero.
- Apertura exige usuario asignado.
- `GET /caja` separa caja propia y cajas administrables.
- Cajero sin admin no puede cerrar caja.
- Cajero con `caja_cierre` tampoco puede cerrar caja.
- Admin cierra caja de cajero con `cajaId`.
- Cajero puede consultar resumen de su caja asignada.
- Resumen calcula saldo esperado.

Archivo: `backend-fastify/src/__tests__/sales.test.ts`

- Venta permite operar al cajero con caja abierta asignada.
- Venta mantiene bloqueo si no hay caja abierta asignada.

## 6. Endpoints revisados

- `GET /api/v1/caja`
- `POST /api/v1/caja`
- `GET /api/v1/caja/resumen`
- `GET /api/v1/caja/movimientos`
- `POST /api/v1/caja/movimientos`
- `POST /api/v1/ventas`

## 7. Pantallas revisadas

- `frontend/src/pages/caja-page.tsx`
- `frontend/src/app/router.tsx`

No se cambiaron rutas.

## 8. Migraciones

No hubo migraciones nuevas.

Se reutilizó estructura existente:

- `bot_caja.nusuario_id`
- columnas persistentes de cierre en `bot_caja`
- `bot_caja_movimientos`

## 9. Validaciones ejecutadas

Backend:

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
```

Resultado:

- TypeScript OK
- Tests OK: 108 tests
- Build OK
- Lint OK

Frontend:

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado:

- TypeScript OK
- Tests OK: 51 tests
- Build OK
- Lint OK

Notas:

- Tests frontend muestran warning preexistente de React `act(...)` en `usePOS.test.ts`.
- Warning no falla tests.

Proyecto:

```bash
git diff --check
graphify update .
```

Resultado:

- Diff check OK
- Graphify actualizado

## 10. Archivos modificados por este fix

- `backend-fastify/src/routes/caja.routes.ts`
- `backend-fastify/src/__tests__/caja.test.ts`
- `backend-fastify/src/__tests__/sales.test.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/caja-page.tsx`
- `BOTICA_FIX_CAJA_OPERATIVA_CAJERO_CIERRE_ADMIN.md`

## 11. Archivos sucios previos no tocados por este fix

Estos archivos ya estaban modificados por trabajo anterior de POS/F14:

- `frontend/src/pos/components/Cart.tsx`
- `frontend/src/pos/components/Cart.test.tsx`

No se revirtieron ni se mezclaron con lógica de caja.

## 12. Riesgos

- Admin puede cerrar la última caja abierta si llama backend sin `cajaId`; la UI siempre envía `cajaId`.
- Si existen varias cajas abiertas y se usa API manual sin `cajaId`, backend conserva compatibilidad previa.
- No se agregó test frontend específico para `CajaPage`; validación actual cubre TypeScript, build y lint.

## 13. Checklist final

- [x] Admin abre caja.
- [x] Admin asigna caja a usuario/cajero.
- [x] Cajero ve caja asignada.
- [x] Cajero registra movimientos permitidos.
- [x] Cajero ve resumen.
- [x] Cajero no cierra caja.
- [x] Admin selecciona caja de cajero.
- [x] Admin ve resumen automático.
- [x] Admin ingresa monto contado.
- [x] Diferencia se calcula automáticamente.
- [x] Cierre persiste resumen.
- [x] Venta sigue bloqueada si no hay caja asignada.
- [x] Venta permite cajero con caja asignada.
- [x] Tests/backend/build/lint OK.
- [x] Frontend TS/tests/build/lint OK.
