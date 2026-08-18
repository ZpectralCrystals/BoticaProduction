# BOTICA_FASE1_CAJA_OBLIGATORIA_VENTAS.md

## 1. Resumen

Se implementó la regla de negocio: **no se puede registrar una venta si el usuario autenticado no tiene una caja abierta**.

La autoridad queda en backend en `POST /api/v1/ventas`. El frontend POS ya mostraba errores devueltos por la API; se agregó test para asegurar que el mensaje de caja cerrada llegue claro al usuario.

## 2. Documentos leídos

- `BOTICA_FASE0_BASELINE_ESTADO_ACTUAL.md`
- `BOTICA_AUDITORIA_FINAL_FLUJOS.md`
- `BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md`

## 3. Problema encontrado

La auditoría final marcaba como pendiente/riesgo:

- Venta no exigía caja abierta.
- El resumen de caja podía considerar ventas por rango de apertura, pero no existía bloqueo duro antes de vender.

Antes de esta fase, `POST /api/v1/ventas` validaba permisos, total, almacén, stock, precios y FEFO, pero no validaba caja abierta del usuario.

## 4. Regla aplicada

Antes de insertar la venta y antes de ejecutar FEFO, backend valida caja abierta del usuario autenticado:

```sql
SELECT nid
FROM bot_caja
WHERE cestado = 'A'
  AND nusuario_id = $1
ORDER BY tapertura DESC
LIMIT 1
FOR UPDATE;
```

En este proyecto, caja abierta se representa como `bot_caja.cestado = 'A'`.

Si no existe caja abierta:

```json
{
  "ok": false,
  "error": "NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas."
}
```

HTTP: `400`.

## 5. Cambios aplicados

### Backend

- `backend-fastify/src/routes/sales.routes.ts`
  - Se agregó validación de caja abierta dentro de la transacción de venta, como primera query transaccional.
  - Si no hay caja abierta, se ejecuta `ROLLBACK` y se retorna error claro.
  - No se tocó FEFO.
  - No se tocó Kardex.
  - No se tocó compras, CXP, lotes, reportes ni layout.

### Backend tests

- `backend-fastify/src/__tests__/sales.test.ts`
  - Se ajustaron mocks de ventas para contemplar la nueva query de caja abierta.
  - Se agregó test: venta rechazada cuando usuario no tiene caja abierta.
  - Suite de ventas pasa de 14 a 15 tests.

### Frontend

- No se cambió lógica de POS.
- `usePOS` ya capturaba `Error.message` de `apiPOSCrearVenta` y lo mostraba en `errors`.

### Frontend tests

- `frontend/src/pos/hooks/usePOS.test.ts`
  - Se agregó test para validar que el mensaje de caja cerrada se muestra en POS.
  - Suite de POS hook pasa de 15 a 16 tests.

## 6. Archivos modificados

- `backend-fastify/src/routes/sales.routes.ts`
- `backend-fastify/src/__tests__/sales.test.ts`
- `frontend/src/pos/hooks/usePOS.test.ts`
- `BOTICA_FASE1_CAJA_OBLIGATORIA_VENTAS.md`

## 7. Migraciones

No hubo migraciones nuevas.

## 8. Endpoints revisados

- `POST /api/v1/ventas`
- `GET /api/v1/caja`
- `POST /api/v1/caja`

## 9. Validaciones ejecutadas

### Tests focales

```bash
cd backend-fastify && npm test -- sales.test.ts
```

Resultado: OK. 1 archivo, 15 tests passed.

```bash
cd frontend && npm test -- usePOS.test.ts
```

Resultado: OK. 1 archivo, 16 tests passed. Persisten warnings previos de React `act(...)`; no bloquean.

### Validación completa

```bash
cd backend-fastify && npx tsc --noEmit
```

Resultado: OK.

```bash
cd backend-fastify && npm test
```

Resultado: OK. 11 archivos, 89 tests passed.

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

Resultado: OK. 4 archivos, 50 tests passed. Persisten warnings previos de React `act(...)`; no bloquean.

```bash
cd frontend && npm run build
```

Resultado: OK. Vite mantiene warning de chunk mayor a 500 kB; no bloquea.

```bash
cd frontend && npm run lint
```

Resultado: OK.

## 10. Resultado final

- Venta con caja abierta: continúa flujo normal.
- Venta sin caja abierta: bloqueada por backend antes de crear venta, antes de FEFO y antes de Kardex.
- POS muestra mensaje claro recibido desde backend.
- Sin cambios de DB.
- Sin migraciones.
- Sin cambios a Clerk, Supabase/PHP legacy, compras, CXP, reportes, lotes ni layout.

## 11. Riesgos / notas

- Caja abierta sigue representada por `cestado = 'A'`, no por string `ABIERTA`.
- La validación usa `FOR UPDATE` para leer y bloquear la caja abierta durante la transacción de venta.
- No se creó registro en `bot_caja_movimientos` por venta; se conserva diseño actual donde ventas se suman desde `bot_ventas` en resumen/cierre de caja.
