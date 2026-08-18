# BOTICA FASE 6 - Productos no medicamentosos

## 1. Resumen

Se habilitaron productos `NO_MEDICAMENTO` sin composicion obligatoria y con lote/vencimiento configurables. Productos `MEDICAMENTO` mantienen reglas estrictas: composicion obligatoria, lote obligatorio y vencimiento obligatorio.

## 2. Archivos revisados via Graphify

- `backend-fastify/src/routes/inventory.routes.ts`
- `backend-fastify/src/routes/purchases.routes.ts`
- `backend-fastify/src/db/schema.ts`
- `backend-fastify/src/lib/schema-check.ts`
- `backend-fastify/src/__tests__/inventory-prices.test.ts`
- `backend-fastify/src/__tests__/purchases.test.ts`
- `backend-fastify/src/__tests__/schema-check.test.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/inventory-page.tsx`
- `frontend/src/pages/compras-page.tsx`
- `frontend/src/pages/compras-page.test.tsx`

## 3. Migracion nueva

Archivo:

- `ops/migrations/022_productos_tipo_no_medicamento.sql`

Agrega:

- `bot_productos.ctipo_producto VARCHAR(30) NOT NULL DEFAULT 'MEDICAMENTO'`
- CHECK: `MEDICAMENTO | NO_MEDICAMENTO`

Campos reutilizados:

- `lrequiere_lote`
- `lrequiere_vencimiento`

## 4. Cambios backend

Inventario:

- `tipoProducto` normaliza a `MEDICAMENTO` o `NO_MEDICAMENTO`.
- Medicamento exige composicion.
- No medicamento no exige composicion.
- Medicamento fuerza `requiereLote = true` y `requiereVencimiento = true`.
- No medicamento permite configurar ambos flags.
- GET inventario devuelve `tipoProducto`, `requiereLote`, `requiereVencimiento`.

Compras:

- Lote/fecha ya no se exigen globalmente antes de leer producto.
- Se validan segun flags reales del producto.
- Si producto no requiere lote, compra puede ingresar stock y kardex sin lote.

Schema check:

- `ctipo_producto` agregado a columnas requeridas.

## 5. Cambios frontend

Inventario:

- Form producto agrega selector `Tipo producto`.
- Composicion muestra `*` solo para medicamento.
- No medicamento permite composicion vacia.
- Medicamento bloquea lote/vencimiento en `Si`.
- No medicamento permite `requiere lote` y `requiere vencimiento` en `Si/No`.
- Tabla marca `No med.`.

Compras:

- Validacion de lote/vencimiento depende de `requiereLote` y `requiereVencimiento`.
- Placeholders cambian a obligatorio/opcional segun producto seleccionado.

## 6. Tests agregados/ajustados

- Inventario: medicamento sin composicion rechaza.
- Inventario: no medicamento sin composicion no cae en error de composicion.
- Compras: producto sin lote/vencimiento requerido registra compra sin tocar `bot_lotes`.
- Schema-check actualizado por nueva columna.

## 7. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test -- inventory-prices.test.ts purchases.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

cd frontend && npx tsc --noEmit
cd frontend && npm test -- compras-page.test.tsx
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado:

- Backend TypeScript OK
- Backend focal OK: 21 tests
- Backend suite OK: 13 archivos, 101 tests
- Backend build OK
- Backend lint OK
- Frontend TypeScript OK
- Frontend focal compras OK: 2 tests
- Frontend suite OK: 4 archivos, 50 tests
- Frontend build OK
- Frontend lint OK

Notas:

- Frontend tests conservan warning existente de React `act(...)` en POS.
- Build Vite conserva warning existente de chunk mayor a 500 kB.

## 8. No tocado

- Caja
- FEFO
- CXP
- Reporte utilidad ventas
- Layout
- Clerk
- Legacy PHP/Supabase
