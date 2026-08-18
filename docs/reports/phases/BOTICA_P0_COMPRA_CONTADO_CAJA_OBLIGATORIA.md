# P0 - Compra contado con caja obligatoria

Fecha: 2026-05-13

## 1. Resumen

Se cerro P0 de auditoria: compra `CONTADO` ya no puede registrarse si usuario autenticado no tiene caja abierta asignada.

Regla final aplicada:

- Compra `CONTADO` requiere caja abierta del usuario que registra.
- Sin caja abierta, backend responde `400 NO_HAY_CAJA_ABIERTA`.
- Falla antes de crear compra, detalle, lote, kardex, stock o egreso.
- Compra `CREDITO` no requiere caja abierta y sigue generando CXP.

## 2. Problema corregido

Auditoria detecto que `POST /api/v1/compras` permitia compra `CONTADO` sin caja abierta.

Riesgo:

- Compra quedaba registrada.
- Stock/lotes/kardex podian actualizarse.
- No habia egreso de caja.
- Caja y contabilidad quedaban descuadradas.

## 3. Backend

Archivo modificado:

- `backend-fastify/src/routes/purchases.routes.ts`

Cambio aplicado:

- Se calcula `total` antes de iniciar flujo transaccional.
- Se abre transaccion antes de cualquier insercion.
- Si `tipoPago === 'CONTADO'`, se bloquea caja asignada al usuario:

```sql
SELECT nid
FROM bot_caja
WHERE nusuario_id = $1
  AND cestado = 'A'
ORDER BY tapertura DESC
LIMIT 1
FOR UPDATE;
```

- Si no existe caja:

```json
{
  "error": "NO_HAY_CAJA_ABIERTA",
  "message": "Debe abrir caja para registrar compras al contado"
}
```

- Si existe caja, se registra compra completa y luego egreso:

```sql
INSERT INTO bot_caja_movimientos
  (ncaja_id, ctipo, nmonto, cmetodo_pago, cref_tabla, nref_id, cdescripcion, nusuario_id, cusuario)
VALUES
  ($1, 'EGRESO', $2, 'EFECTIVO', 'bot_compras', $3, $4, $5, $6);
```

## 4. Frontend

Archivo modificado:

- `frontend/src/pages/compras-page.tsx`

Cambio aplicado:

- Se agrego aviso visible bajo `CONTADO`:

```txt
Requiere caja abierta asignada al usuario.
```

`api.ts` no requirio cambio. `requestV1` ya propaga `message` backend y la pantalla muestra toast de error.

## 5. Tests

Archivo modificado:

- `backend-fastify/src/__tests__/purchases.test.ts`

Tests agregados:

- Rechaza compra contado sin caja abierta antes de crear compra.
- Verifica que no se ejecute:
  - `INSERT INTO bot_compras`
  - `INSERT INTO bot_compras_det`
  - `INSERT INTO bot_kardex`
  - `UPDATE bot_productos`
- Permite compra credito sin caja abierta y crea CXP.
- Verifica que compra credito no consulta `bot_caja`.

Tests ajustados:

- Casos felices de compra contado ahora mockean caja abierta.
- Seed de compras mueve consulta de caja al inicio de transaccion.

## 6. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npx vitest run src/__tests__/purchases.test.ts
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

- Backend TypeScript OK.
- Backend purchases test OK: 18 tests.
- Backend suite OK: 15 files, 115 tests.
- Backend build OK.
- Backend lint OK.
- Frontend TypeScript OK.
- Frontend tests OK: 5 files, 55 tests.
- Frontend build OK.
- Frontend lint OK.
- `git diff --check` OK.
- Graphify actualizado.

Warnings no bloqueantes:

- Frontend tests mantienen warnings `act(...)` existentes en POS.
- Frontend build mantiene warning Vite por chunk mayor a 500 kB.

## 7. Archivos modificados

- `backend-fastify/src/routes/purchases.routes.ts`
- `backend-fastify/src/__tests__/purchases.test.ts`
- `frontend/src/pages/compras-page.tsx`
- `BOTICA_P0_COMPRA_CONTADO_CAJA_OBLIGATORIA.md`

## 8. Migraciones

No hubo migraciones.

No se tocaron tablas, columnas ni datos.

## 9. Endpoints revisados

- `POST /api/v1/compras`

Comportamiento final:

| Condicion | Caja abierta asignada | Resultado |
|---|---:|---|
| `CONTADO` | Si | Compra OK + egreso caja |
| `CONTADO` | No | `400 NO_HAY_CAJA_ABIERTA` |
| `CREDITO` | Si | Compra OK + CXP |
| `CREDITO` | No | Compra OK + CXP |

## 10. Alcance no tocado

No se modifico:

- FEFO.
- Ventas.
- CXP fuera del flujo de compra credito.
- Reportes.
- Productos.
- Layout.
- Clerk.
- Migraciones.

## 11. Criterio de aceptacion

Cumplido:

- Compra contado sin caja abierta falla.
- Falla antes de crear compra/stock/lote/kardex.
- Compra contado con caja abierta registra egreso.
- Compra credito no exige caja.
- Tests y builds pasan.

