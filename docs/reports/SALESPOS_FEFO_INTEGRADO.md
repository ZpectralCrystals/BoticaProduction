# SALESPOS FEFO INTEGRADO — Botica El Pueblo ERP
**Fecha:** Abril 2026  
**Alcance:** Integración de trazabilidad FEFO en el módulo POS del frontend

---

## Resumen de cambios

| Archivo | Cambio |
|---|---|
| `src/lib/api.ts` | `ApiLoteFefo`, `ApiLotesDisponiblesData`, `apiGetLotesDisponibles()` |
| `src/pos/types/index.ts` | `LoteFefo`, campos `fefoLote` y `fefoLotes` en `CartItem` |
| `src/pos/hooks/usePOS.ts` | `addItem` → async con fetch FEFO; `updateQuantity` valida contra stock de lotes |
| `src/pos/components/Cart.tsx` | Badge FEFO por ítem, distribución multi-lote visual |
| `src/pos/components/CheckoutModal.tsx` | Trazabilidad de lote en tabla de productos |
| `src/pos/components/SalesPOS.tsx` | Handler `async` en `onProductSelect` |

---

## Flujo completo

```
Usuario escribe en buscador
  → debounce 300ms
  → GET /api/v1/inventario/search
  → Lista de productos (sin info de lotes)

Usuario hace clic en un producto
  → await pos.addItem(product)
      ├─ GET /api/v1/lotes/disponibles/:productoId
      │   → fefoLote  = primer lote (más próximo a vencer)
      │   → fefoLotes = todos los lotes activos ordenados FEFO
      │   (falla silenciosa → fefoLote=null, fefoLotes=[])
      └─ setItems → CartItem con fefoLote + fefoLotes
  → toast.success("producto agregado")

En el carrito, por cada ítem:
  → Badge verde/amarillo/rojo según alerta del lote
  → Si cantidad > lote[0].cantidad → badge "Multi-lote FEFO" violeta
  → Si sin lote → indicador neutro punteado

Usuario ajusta cantidad:
  → updateQuantity valida MAX = sum(fefoLotes.cantidad) si hay lotes
  → Distribución multi-lote recalculada en tiempo real

Usuario abre Checkout (F4):
  → CheckoutModal muestra en cada fila del producto:
      nombre + código
      Lote FEFO + fecha vencimiento (en rojo/amarillo/verde)
      Multi-lote si la cantidad abarca varios lotes

Usuario confirma venta:
  → POST /api/v1/ventas  (sin cambios en payload)
  → Backend aplica FEFO real con bot_lotes
```

---

## Tipos nuevos

### `LoteFefo` (`pos/types/index.ts`)

```typescript
export interface LoteFefo {
  id: number
  codigoLote: string | null
  fechaVencimiento: string        // "YYYY-MM-DD"
  cantidad: number                // stock disponible en este lote
  diasParaVencer: number
  alerta: 'CRITICO' | 'PROXIMO' | 'OK'
  stockAcumulado: number          // suma FEFO acumulada hasta este lote
}
```

### `CartItem` actualizado

```typescript
export interface CartItem {
  // ... campos existentes ...
  fefoLote: LoteFefo | null       // lote primario FEFO (primero que vence)
  fefoLotes: LoteFefo[]           // todos los lotes disponibles, orden FEFO
}
```

---

## UX: visualización de lotes

### En ProductSearch
Sin cambios — la búsqueda no carga lotes (evita N+1 queries). La info FEFO se obtiene al agregar al carrito.

### En Cart — por ítem

| Estado | Badge |
|---|---|
| Lote único, OK (>90 días) | 🟢 `L-ABC-2026 · Vence 2026-10-01` |
| Lote único, PRÓXIMO (<90 días) | 🟡 `L-ABC-2026 · Vence 2026-07-01` |
| Lote único, CRÍTICO (<30 días) | 🔴 `L-ABC-2026 · Vence 2026-05-01` |
| Multi-lote | 🟣 `FEFO Multi-lote: L-ABC (50u) + L-DEF (30u)` |
| Sin lotes | Indicador punteado neutro `Sin trazabilidad de lote` |
| Alerta VENCIMIENTO | Badge rojo/naranja del lote FEFO |
| Alerta STOCK_BAJO | Badge azul |
| Requiere RECETA | Badge amarillo |

### En CheckoutModal — por fila de producto

```
Paracetamol 500mg
MED-001
🏷 L-ABC-2026-003 · Vence 2026-05-01        ← rojo si CRITICO
```

```
Ibuprofeno 400mg
MED-005
🏷 Multi-lote FEFO: L-X (50u) + L-Y (20u)   ← violeta
```

---

## Compatibilidad backward

Si un producto **no tiene lotes** en `bot_lotes`:
- `GET /lotes/disponibles/:id` retorna `tieneLottes: false, lotes: []`
- `fefoLote = null`, `fefoLotes = []`
- `CartItem` funciona exactamente igual que antes
- Badge "Sin trazabilidad de lote" (neutro, sin alerta)
- `updateQuantity` usa `item.stock` como límite (comportamiento anterior)
- El backend usa validación por `bot_productos.nstock` + `tvencimien`

---

## Validación de escenarios

### Escenario 1: Producto con un lote, cantidad suficiente
```
Agregar: Paracetamol 500mg
  → Lote L-2026-001: 100u, vence 2026-08-15, PROXIMO
  → fefoLote = { codigoLote: "L-2026-001", fechaVencimiento: "2026-08-15", alerta: "PROXIMO" }

Cart muestra:
  🟡 L-2026-001 · Vence 2026-08-15

Checkout muestra:
  🏷 L-2026-001 · Vence 2026-08-15    (texto amarillo)
```

### Escenario 2: Producto con dos lotes, cantidad cruza lotes
```
Lote A: 30u, vence 2026-05-01 (CRITICO)
Lote B: 100u, vence 2026-10-01 (OK)

Agregar: 1u → usa solo Lote A
  Cart: 🔴 L-A · Vence 2026-05-01

Cambiar cantidad a 50u → cruza lotes
  Cart: 🟣 FEFO Multi-lote: L-A (30u) + L-B (20u)

Intento de poner 200u → bloqueado
  maxStock = 30 + 100 = 130 → cantidad máxima = 130
```

### Escenario 3: Producto sin lotes
```
Agregar: Gasas
  → GET /lotes/disponibles/99 → tieneLottes: false
  → fefoLote = null, fefoLotes = []

Cart muestra:
  ··· Sin trazabilidad de lote   (neutro punteado)

updateQuantity usa item.stock = 50 como máximo
```

### Escenario 4: Error en la llamada a /lotes/disponibles
```
Network error o servidor caído:
  → catch silencioso → fefoLote = null, fefoLotes = []
  → Producto se agrega al carrito normalmente
  → Badge neutro sin alerta de lote
  → La venta se procesa en el backend con validación normal
```

---

## Cómo validar localmente

```bash
# 1. Levantar backend
cd backend-fastify && npm run dev

# 2. Levantar frontend
cd frontend && npm run dev

# 3. Aplicar migración FEFO si no está aplicada
psql -U postgres -d botica_db -f ops/migrations/005_fefo.sql

# 4. Registrar una compra con lote para el producto de prueba
POST /api/v1/compras
{
  "proveedor": "Test", "documento": "F-001",
  "items": [{
    "productoId": 12, "cantidad": 100, "precioUnit": 2.50,
    "codigoLote": "L-TEST-001", "fechaVencimiento": "2026-05-15"
  }]
}

# 5. Ir al POS y buscar el producto
#    → Al agregar al carrito, aparece badge FEFO con L-TEST-001
#    → Al abrir checkout, aparece lote en tabla
#    → Confirmar venta → backend descuenta del lote correctamente
```

---

## Limitaciones actuales

| Tema | Estado |
|---|---|
| ProductSearch no muestra info de lote antes de seleccionar | Por diseño (evita N+1 queries) |
| FEFO en carrito es visual/predictivo | El descuento real lo hace el backend |
| Si lotes cambian entre búsqueda y checkout | Backend valida stock real en el COMMIT |
| Sin indicador de "cargando lote" en ProductSearch | La latencia típica < 100ms |
