# CONSOLIDACIÓN POS FINAL

**Fecha:** Sesión de consolidación frontend POS  
**Estado:** ✅ Completado — build exitoso

---

## Objetivo

Adoptar `SalesPOS` como POS oficial único, eliminar la implementación inline
de `sales-page.tsx`, y asegurar que todos los llamados a la API usen `lib/api.ts`.

---

## Arquitectura final

```
frontend/src/
├── pages/
│   └── sales-page.tsx          ← 5 líneas: wrapper que renderiza <SalesPOS />
│
├── pos/
│   ├── index.ts                ← barrel con todos los exports
│   ├── types/
│   │   └── index.ts            ← CartItem, MetodoPago, ItemAlerta (simplificados)
│   ├── hooks/
│   │   └── usePOS.ts           ← CREADO — estado del carrito + submitVenta()
│   ├── components/
│   │   ├── SalesPOS.tsx        ← CREADO — orquestador principal
│   │   ├── ProductSearch.tsx   ← CREADO — búsqueda en tiempo real con debounce
│   │   ├── Cart.tsx            ← actualizado para CartItem simplificado
│   │   ├── PaymentPanel.tsx    ← MetodoPago alineado al backend (Efectivo/Yape/Mixto)
│   │   └── CheckoutModal.tsx   ← actualizado para CartItem simplificado
│   └── utils/
│       └── posUtils.ts         ← calcularTotales sin descuentoGlobal; funciones null-safe
│
└── lib/
    └── api.ts                  ← agregadas: apiPOSBuscarProductos(), apiPOSCrearVenta()
```

---

## Archivos eliminados (sesiones previas)

| Archivo | Razón |
|---|---|
| `src/services/api.ts` | Cliente API duplicado (Supabase) |
| `src/pos/hooks/useFEFO.ts` | Dependía de services/api y rutas Supabase inexistentes |
| `src/pos/components/ProductSearch.tsx` (versión antigua) | Dependía de services/api y useFEFO |
| `src/pos/components/SalesPOS.tsx` (versión antigua) | Orquestaba componentes con API Supabase |
| `src/pos/hooks/usePOS.ts` (versión antigua) | Dependía de services/api |

---

## Archivos creados en esta sesión

### `src/pos/hooks/usePOS.ts`
- Gestiona el estado completo del carrito
- Llama a `apiPOSCrearVenta()` de `lib/api.ts` en `submitVenta()`
- Calcula totales con `calcularTotales()` de posUtils (IGV incluido)
- Genera alertas de vencimiento y stock bajo al agregar items

### `src/pos/components/ProductSearch.tsx`
- Búsqueda en tiempo real contra `GET /api/v1/inventario/search`
- Debounce de 300ms
- Muestra: nombre, código, genérico, precio, stock, vencimiento, badge receta
- Atajo de teclado F2 para enfocar el input
- Deshabilita productos sin stock

### `src/pos/components/SalesPOS.tsx`
- Orquesta `ProductSearch`, `Cart`, `PaymentPanel`, `CheckoutModal`
- Layout responsivo: 1 columna en mobile, 2 en desktop
- Atajos: F2 (buscar), F4 (finalizar), Esc (cancelar)
- Llama a `pos.submitVenta()` y muestra toast con código de venta

---

## Archivos modificados en esta sesión

### `src/pos/types/index.ts`
**Antes:** 271 líneas con tipos Supabase complejos (Producto, Lote, LoteFEFO,
VentaInput con lotes, POSState, etc.)

**Después:** 35 líneas — solo los tipos que usa el backend activo:
```typescript
type MetodoPago = 'Efectivo' | 'Yape' | 'Mixto'   // alineado al backend
interface CartItem { id, productoId, productoCodigo, productoNombre,
                     categoria, stock, expiresAt, cantidad, precioUnitario,
                     total, receta, alertas }
interface ItemAlerta { tipo, severidad, mensaje }
```

### `src/lib/api.ts`
Agregadas al final:
- `ApiPOSProduct` — tipo de producto del endpoint `/inventario/search`
- `apiPOSBuscarProductos(search)` → `GET /inventario/search?search=...&limit=8`
- `ApiPOSSaleItem` — item para POST /ventas
- `apiPOSCrearVenta(data)` → `POST /ventas` con array `items[]`

### `src/pos/utils/posUtils.ts`
- `calcularTotales(items)`: eliminado parámetro `descuentoGlobal` (no soportado en backend)
- `diasHastaVencimiento(fecha)`: acepta `string | null | undefined`, retorna `number | null`
- `getVencimientoColorClass(dias)`: acepta `number | null`
- `getVencimientoText(dias)`: acepta `number | null`

### `src/pos/components/Cart.tsx`
- `item.loteFechaVencimiento` → `item.expiresAt`
- `item.productoPrincipioActivo` → `item.productoCodigo`
- `item.loteNumero` → badge de vencimiento (si expiresAt existe)
- `item.unidadMedida` → eliminado (siempre "unid")
- `item.cantidadUnidades` → `item.cantidad`
- `item.descuentoMonto` → eliminado

### `src/pos/components/CheckoutModal.tsx`
- `item.loteNumero` → `item.productoCodigo`
- `item.unidadMedida` → "unid"
- Eliminado import de `formatNumber`

### `src/pos/components/PaymentPanel.tsx`
- MetodoPago: `'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'MIXTO'`
  → `'Efectivo' | 'Yape' | 'Mixto'`
- Simplificado a 3 métodos (Tarjeta/Plin no están en el CHECK del backend)

### `src/pages/sales-page.tsx`
**Antes:** 642 líneas con implementación POS inline (búsqueda sobre contexto
pre-cargado, cart local, checkout simplificado sin items[], sin FEFO).

**Después:** 5 líneas — wrapper puro:
```tsx
import { SalesPOS } from '@/pos'
export function SalesPage() {
  return <SalesPOS />
}
```

---

## API Backend usada por el POS

| Endpoint | Uso |
|---|---|
| `GET /api/v1/inventario/search?search=...&limit=8` | Búsqueda en tiempo real de productos |
| `POST /api/v1/ventas` | Crear venta con `items[]` detallados |

El `POST /ventas` recibe:
```json
{
  "patient": "Consumidor final",
  "paymentMethod": "Efectivo",
  "total": 35.50,
  "cashier": "Caja principal",
  "area": "Botica",
  "notes": "Amoxicilina... | cant: 2 | p.u.: ...",
  "items": [
    { "productoId": 5, "productoNombre": "Amoxicilina 500mg",
      "cantidad": 2, "precioUnitario": 3.50, "total": 7.00 }
  ]
}
```
El backend calcula subtotal e IGV internamente (`total / 1.18`).

---

## IGV — criterio unificado

Los precios almacenados en `bot_productos.npreventa` son **IGV incluido**.

```
total    = sum(items[i].cantidad * items[i].precioUnitario)
subtotal = total / 1.18        (base imponible)
igv      = total - subtotal    (18% del valor de venta)
```

Este mismo criterio se aplica en:
- `posUtils.calcularTotales()`
- `sales.routes.ts` (backend)
- `Cart.tsx` y `CheckoutModal.tsx` (display)

---

## UX mínima verificada

| Requisito | Estado |
|---|---|
| Búsqueda rápida (live search) | ✅ ProductSearch con debounce 300ms |
| Atajo F2 para enfocar búsqueda | ✅ |
| Atajo F4 para finalizar venta | ✅ |
| Badge de vencimiento visible | ✅ Cart muestra color + días |
| Badge de receta visible | ✅ ProductSearch y Cart |
| Stock bajo visible | ✅ Alerta en cart, deshabilita en search si stock=0 |
| Fraccionamiento | ⚠️ Pendiente (backend no tiene tabla lotes activa) |
| FEFO por lote | ⚠️ Pendiente (backend no tiene tabla lotes activa) |
| Limpiar carrito | ✅ Botón en Cart header |
| Cambio de cantidad | ✅ Botones +/- en Cart |
| Eliminar item | ✅ Botón X en Cart |
| Pago efectivo/Yape/Mixto | ✅ PaymentPanel con cálculo de vuelto |
| Checkout con confirmación | ✅ CheckoutModal con resumen tributario |
| Toast de éxito con código | ✅ SalesPOS.handleConfirmCheckout |

---

## Pendiente (futuro)

- **Tabla `bot_lotes`**: Cuando se active, `usePOS.addItem()` deberá consultar
  FEFO vía nuevo endpoint `GET /inventario/lotes/:id` y mostrar lote en Cart.
- **Fraccionamiento**: Agregar campo `unidadMedida` y `factorConversion` al CartItem
  cuando el backend soporte venta por blister/caja.
- **Receta médica**: Actualmente solo es un badge. Futuro: bloquear checkout
  si `receta='S'` y no se ha capturado número de receta.
- **Calculadora `eval`**: Reemplazar por parser seguro en PaymentPanel.tsx.

---

## Build

```
✓ tsc -b  → sin errores de TypeScript
✓ vite build → 555 kB (146 kB gzip), 1780 módulos
```
