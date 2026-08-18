# TESTING CRÍTICO IMPLEMENTADO — Botica El Pueblo ERP
**Fecha:** 11 Abril 2026  
**Estado:** ✅ 82/82 tests pasando

---

## Resumen de cobertura

| Módulo | Archivo | Tests | Framework | Estado |
|---|---|---|---|---|
| Backend — Ventas + Anulación | `sales.test.ts` | 13 | Vitest + Fastify inject | ✅ |
| Backend — Compras + Lotes | `purchases.test.ts` | 4 | Vitest + Fastify inject | ✅ |
| Backend — Kardex | `kardex.test.ts` | 18 | Vitest + Fastify inject | ✅ |
| Frontend — Utilidades POS | `posUtils.test.ts` | 21 | Vitest | ✅ |
| Frontend — Hook usePOS | `usePOS.test.ts` | 15 | Vitest + @testing-library/react | ✅ |
| Frontend — Componente Cart | `Cart.test.tsx` | 11 | Vitest + @testing-library/react | ✅ |
| **Total** | | **82** | | **✅ 100%** |

---

## Cómo correr los tests

### Backend
```bash
cd backend-fastify

npm test               # una pasada (CI)
npm run test:watch     # modo watch (desarrollo)
npm run test:coverage  # con reporte de cobertura
```

### Frontend
```bash
cd frontend

npm test               # una pasada (CI)
npm run test:watch     # modo watch (desarrollo)
npm run test:coverage  # con reporte de cobertura
```

---

## Arquitectura de tests del backend

### Mock sin DB real

Los tests usan un **mock de `pg.Pool`** con cola de respuestas secuenciales. No requieren PostgreSQL ni base de datos de prueba.

```
buildTestApp(mockClient)
  ├─ Fastify + JWT + Cookie (real)
  ├─ db plugin → mockPool (connect → mockClient)
  └─ auth plugin → requireAuth con JWT real (secreto hardcodeado)
```

**`createMockClient()`**:
- `BEGIN`, `COMMIT`, `ROLLBACK` → no-ops automáticos (no consumen cola)
- Cada SQL real → consume una entrada de `client.responses[]`
- `responses.push(new Error(...))` → simula fallo de DB

**`makeTestToken(app, user?)`**: firma un JWT con el secreto de prueba.

### Archivos

```
backend-fastify/
├── vitest.config.ts
└── src/__tests__/
    ├── helpers/
    │   └── buildTestApp.ts    ← app factory + mock client
    ├── sales.test.ts          ← 13 tests (ventas + anulación con FEFO)
    ├── purchases.test.ts      ← 4 tests
    └── kardex.test.ts         ← 18 tests (GET lista, GET :id, POST ajuste, resumen)
```

---

## Detalle de tests del backend

### `sales.test.ts` — POST /ventas (8 tests)

| # | Test | Verifica |
|---|---|---|
| 1 | ✅ crea venta y retorna ok + codigo VTA- | Flujo feliz completo |
| 2 | ❌ rechaza total = 0 con código 400 | Validación de input |
| 3 | ❌ rechaza sin token de autenticación | Auth middleware |
| 4 | ❌ rechaza con STOCK INSUFICIENTE | Guard de stock insuficiente |
| 5 | ❌ hace rollback y retorna 500 si un INSERT falla | Atomicidad de transacción |
| 6 | ✅ aplica FEFO — consume el primer lote disponible | Lógica FEFO básica |
| 7 | ❌ FEFO — rechaza si stock en lotes es insuficiente | Guard FEFO |
| 8 | ✅ kardex generado — stock_nuevo = stock_anterior - cantidad | Integridad del kardex |

### `sales.test.ts` — PATCH /ventas/:id/anular (5 tests)

| # | Test | Verifica |
|---|---|---|
| 9 | ✅ anula venta sin lotes FEFO — revierte stock + kardex | Anulación sin lotes |
| 10 | ✅ anula venta con lotes FEFO — restaura bot_lotes + kardex | **FEFO: restaura ncantidad en lote** |
| 11 | ❌ retorna 409 si venta ya estaba anulada | Idempotencia |
| 12 | ❌ retorna 404 si venta no existe | Manejo de not-found |
| 13 | ❌ retorna 403 si usuario no es admin | Control de acceso |

### `kardex.test.ts` — 18 tests

| Suite | Tests | Verifica |
|---|---|---|
| `GET /kardex` | 5 | Lista paginada, filtros `producto_id`/`tipo`, auth, campos `loteId`/`codigoLote` |
| `GET /kardex/:id` | 3 | Movimiento por ID, 404, 400 ID inválido |
| `POST /kardex/ajuste` | 7 | Ajuste positivo, negativo, stock negativo, cantidad 0, sin motivo, 403 no-admin, 404 producto |
| `GET /kardex/resumen/:id` | 3 | Resumen por tipo, 404 producto, auth |

### `purchases.test.ts` — POST /compras

| # | Test | Verifica |
|---|---|---|
| 1 | ✅ crea compra, aumenta stock y genera kardex COMPRA | Flujo feliz + kardex |
| 2 | ✅ crea lote nuevo si no existía (INSERT bot_lotes) | FEFO — creación de lote |
| 3 | ✅ actualiza lote existente (UPDATE bot_lotes) | FEFO — re-compra mismo lote |
| 4 | ❌ rechaza sin autenticación | Auth middleware |

---

## Arquitectura de tests del frontend

### Sin dependencias externas

Los tests del frontend mockan `@/lib/api` completamente. No hacen llamadas HTTP reales.

```typescript
vi.mock('@/lib/api', () => ({
  apiGetLotesDisponibles: vi.fn(),
  apiPOSCrearVenta: vi.fn(),
}))
```

### Archivos

```
frontend/
├── vitest.config.ts            ← jsdom + @vitejs/plugin-react + alias @/
└── src/
    ├── test/
    │   └── setup.ts            ← @testing-library/jest-dom
    └── pos/
        ├── utils/posUtils.test.ts      ← 21 tests puros
        ├── hooks/usePOS.test.ts        ← 15 tests de hook
        └── components/Cart.test.tsx    ← 11 tests de componente
```

---

## Detalle de tests del frontend

### `posUtils.test.ts` — Funciones puras

| Suite | Tests |
|---|---|
| `calcularTotales` | carrito vacío, ítem con IGV, múltiples ítems, sin desvío de redondeo |
| `calcularVuelto` | pago exacto, vuelto correcto, mixto, nunca negativo |
| `diasHastaVencimiento` | null/undefined, fecha pasada, fecha futura |
| `getVencimientoColorClass` | rojo 0d, rojo 7d, amarillo 30d, verde 60d, neutro null |
| `getVencimientoText` | VENCIDO, Vence pronto, días restantes, Vigente |
| `generarIdUnico` | 100 IDs únicos sin colisión |

### `usePOS.test.ts` — Hook

| Suite | Tests |
|---|---|
| `addItem` | agrega producto, adjunta fefoLote, null si sin lotes, graceful fallback en error de red, incrementa cantidad, no supera stock de lotes |
| `updateQuantity` | recalcula total, mínimo 1, limita al stock de lotes |
| Totales | cero vacío, recalcula al agregar |
| `submitVenta` | llama API correctamente, retorna false si API falla, retorna false con carrito vacío, clearCart reinicia estado |

### `Cart.test.tsx` — Componente React

| Suite | Tests |
|---|---|
| Estado vacío | mensaje "Carrito vacío" |
| Sin lotes | nombre del producto visible, badge "Sin trazabilidad de lote" |
| Con lote FEFO | código del lote visible, fecha de vencimiento visible |
| Lote CRÍTICO | código del lote crítico, alerta de vencimiento |
| Multi-lote | badge "FEFO Multi-lote", ambos códigos visibles |
| Interacciones | click X llama `onRemoveItem`, click "Proceder al pago" llama `onCheckout` |

---

## Qué falta cubrir (backlog de testing)

### Backend — alta prioridad
| Test pendiente | Complejidad | Riesgo |
|---|---|---|
| GET /ventas — paginación y filtros | Baja | Bajo |
| FEFO multi-lote — distribución entre 3+ lotes | Media | Alto |
| Venta con producto vencido (sin lotes, tvencimien en pasado) | Baja | Alto |
| Compra sin productoId (item de servicio) | Baja | Medio |
| GET /lotes/disponibles/:id | Baja | Medio |
| Anulación con múltiples ítems | Media | Alto |
| Tests de auth.routes.ts (login, logout, user enum fix) | Baja | Alto |

### Frontend — media prioridad
| Test pendiente | Componente |
|---|---|
| `CheckoutModal` — renderiza trazabilidad de lote | CheckoutModal.test.tsx |
| `ProductSearch` — debounce, sin resultados, selección | ProductSearch.test.tsx |
| `PaymentPanel` — cálculo de vuelto en pantalla | PaymentPanel.test.tsx |
| Error de API en `ProductSearch` | ProductSearch.test.tsx |
| usePOS — métodoPago Mixto y cálculo de vuelto | usePOS.test.ts |

### Tests de integración E2E (futuro)
- Playwright para flujo completo: búsqueda → carrito → checkout
- Regreción de FEFO en BD real (test DB con transacción)
- Prueba de carga en kardex (N ventas simultáneas)

---

## Variables de entorno para CI

```bash
# Backend (no necesario actualmente — usa mock)
# Para tests de integración futuros con DB real:
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/botica_test

# Frontend (no necesario — todo mockeado)
```

---

## Notas técnicas

### Por qué mock de DB en backend
El backend usa `fastify.db` (plugin decorado), no un módulo importable directamente. La estrategia de mock vía `buildTestApp()` inyecta un pool falso sin tocar el código de producción. Cada test controla exactamente qué retorna cada query.

**Limitación**: los tests son sensibles al orden de queries SQL. Si se añade un query nuevo a una ruta, hay que actualizar el `seedXxx()` correspondiente.

### Por qué vitest@2.1.0 con vite 8
Hay un conflicto de tipos entre `@vitejs/plugin-react` (compilado contra vite 8) y la versión de vite 5 que vitest 2.x bundlea internamente. Se resuelve con `react() as any` en `vitest.config.ts`. El comportamiento en runtime es correcto.
