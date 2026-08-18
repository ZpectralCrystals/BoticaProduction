# BOTICA_FASE3_HISTORIAL_PRECIOS_UI.md

## 1. Resumen

Se hizo visible en UI el historial de cambios de precios de venta por producto.

Backend ya tenía endpoint:

```txt
GET /api/v1/inventario/precios/historial/:productoId
```

Frontend ahora lo consume desde Inventario, en cada fila de producto, mediante botón **Historial**.

## 2. Documentos leídos

- `BOTICA_FASE0_BASELINE_ESTADO_ACTUAL.md`
- `BOTICA_FASE1_CAJA_OBLIGATORIA_VENTAS.md`
- `BOTICA_FASE2_CAJA_ANULACION_ADMIN_CAJERO.md`
- `BOTICA_AUDITORIA_FINAL_FLUJOS.md`
- `BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md`

## 3. Estado encontrado

- Backend tenía endpoint de historial ya implementado.
- `frontend/src/lib/api.ts` ya tenía tipo `ApiPrecioHistorial` y helper `apiGetPrecioHistorial`.
- UI de inventario permitía editar precios, pero no mostraba historial.

## 4. Cambios aplicados

### Frontend

- `frontend/src/pages/inventory-page.tsx`
  - Se importó `apiGetPrecioHistorial`.
  - Se agregó estado local para producto seleccionado, historial y loading.
  - Se agregó botón **Historial** en cada fila de producto.
  - Se agregó modal con:
    - producto/código/familia/categoría
    - fecha
    - slot `PRECIO_1/2/3`
    - precio anterior
    - precio nuevo
    - acción
    - usuario
  - Si no hay historial, muestra estado vacío.
  - Si falla API, muestra toast de error.

### Backend tests

- `backend-fastify/src/__tests__/inventory-prices.test.ts`
  - Se agregó test de contrato para `GET /api/v1/inventario/precios/historial/:productoId`.
  - Valida normalización de `precioAnterior`, `precioNuevo`, `slot`, `accion`, `usuario` y `fecha`.

## 5. Archivos modificados

- `frontend/src/pages/inventory-page.tsx`
- `backend-fastify/src/__tests__/inventory-prices.test.ts`
- `BOTICA_FASE3_HISTORIAL_PRECIOS_UI.md`

## 6. Migraciones

No hubo migraciones.

## 7. Endpoints revisados

- `GET /api/v1/inventario/precios/historial/:productoId`
- `POST /api/v1/inventario` con `action=updatePrices`

## 8. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
```

Resultado: OK.

```bash
cd backend-fastify && npm test -- inventory-prices.test.ts
```

Resultado: OK. 1 archivo, 3 tests passed.

```bash
cd backend-fastify && npm test
```

Resultado: OK. 12 archivos, 96 tests passed.

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

## 9. Resultado final

- Usuario puede abrir Inventario.
- En cada producto puede presionar **Historial**.
- UI consulta historial real del backend.
- UI muestra cada cambio de precio por slot.
- No se tocó DB.
- No se tocó FEFO, lotes, compras, CXP, caja, reportes no relacionados, layout, Clerk ni legacy.

## 10. Riesgos / pendientes

- Historial depende de triggers SQL sobre `bot_producto_precios`.
- Cambios legacy directos sobre `bot_productos.npreventa*` podrían no aparecer si no pasan por tabla canónica/trigger correspondiente.
- Futuro recomendado: filtro por slot `PRECIO_1/2/3` y exportación CSV del historial.
