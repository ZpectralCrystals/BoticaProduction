# Módulo POS - Point of Sale

Sistema de ventas completo para botica/farmacia con soporte FEFO, fraccionamiento y gestión de lotes.

## Estructura

```
pos/
├── components/
│   ├── SalesPOS.tsx           # Componente principal
│   ├── ProductSearch.tsx        # Búsqueda de productos con FEFO
│   ├── Cart.tsx                 # Carrito de compras
│   ├── PaymentPanel.tsx         # Panel de pagos
│   └── CheckoutModal.tsx        # Modal de confirmación
├── hooks/
│   ├── usePOS.ts               # Hook principal del POS
│   └── useFEFO.ts              # Hook para lógica FEFO
├── types/
│   └── index.ts                # Tipos TypeScript
├── utils/
│   └── posUtils.ts             # Utilidades del POS
└── index.ts                    # Exportaciones
```

## Flujo de Venta

```
┌─────────────────────────────────────────────────────────────────┐
│                         FLUJO DE VENTA                          │
└─────────────────────────────────────────────────────────────────┘

1. BUSCAR PRODUCTO (F2)
   ↓
   ProductSearch.tsx
   - Input con debounce
   - Lista de productos con stock
   - Alertas de receta/controlado
   ↓
   
2. SELECCIONAR CANTIDAD Y UNIDAD
   ↓
   - Cantidad: 1, 2, 3...
   - Unidad: UNIDAD / CAJA / BLISTER
   - Preview de lotes FEFO disponibles
   ↓
   
3. SISTEMA APLICA FEFO AUTOMÁTICAMENTE
   ↓
   useFEFO.ts → buscarLotesFEFO()
   - Ordena por fecha_vencimiento ASC
   - Selecciona lote(s) más próximo(s) a vencer
   - Calcula unidades base según fraccionamiento
   ↓
   
4. AGREGAR AL CARRITO
   ↓
   usePOS.ts → addItem()
   - Distribuye cantidad entre lotes si es necesario
   - Calcula precios (por unidad o caja)
   - Genera alertas (vencimiento, receta, etc.)
   ↓
   
5. GESTIONAR CARRITO
   ↓
   Cart.tsx
   - Ver items con sus lotes
   - Modificar cantidades (+/-)
   - Eliminar items
   - Alertas visuales por item
   ↓
   
6. CONFIGURAR PAGO (F4)
   ↓
   PaymentPanel.tsx
   - Nombre del cliente
   - Método de pago (Efectivo/Yape/Plin/Tarjeta/Mixto)
   - Montos (con autofill según método)
   - Calculadora rápida
   - Vuelto automático
   ↓
   
7. CONFIRMAR VENTA
   ↓
   CheckoutModal.tsx
   - Resumen de items
   - Verificación de pago completo
   - Validaciones finales (recetas, stock)
   ↓
   
8. PROCESAR (Backend)
   ↓
   POST /api/v1/ventas
   - Transacción SQL atómica
   - Inserta venta + detalle
   - Descuenta stock de lotes
   - Registra en kardex
   ↓
   
9. TICKET / IMPRESIÓN
   - Comprobante de venta
   - Detalle de lotes asignados
```

## Características Clave

### FEFO (First Expired First Out)

```typescript
// useFEFO.ts
const { lotesDisponibles } = await buscarLotesFEFO(
  productoId,
  sucursalId,
  cantidadRequerida,
  unidadMedida,
  unidadesPorCaja,
  unidadesPorBlister
)

// Retorna lotes ordenados por fecha_vencimiento ASC
// El cajero ve visualmente qué lote se usará
```

### Fraccionamiento

```typescript
// Venta por unidad (tableta)
{
  cantidad: 10,
  unidadMedida: 'UNIDAD',
  cantidadUnidades: 10
}

// Venta por caja
{
  cantidad: 2,
  unidadMedida: 'CAJA',
  cantidadUnidades: 200  // 2 cajas × 100 tabletas
}

// El precio se ajusta automáticamente
```

### Alertas Visuales

- **Vencimiento**: Color según días restantes
  - Rojo crítico: ≤ 0 días (vencido)
  - Rojo: ≤ 7 días
  - Ámbar: ≤ 30 días
  - Verde: > 30 días

- **Receta**: Badge amarillo con ícono
- **Controlado**: Badge rojo
- **Stock bajo**: Indicador en producto

### Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| F2 | Buscar producto |
| F4 | Proceder al pago |
| F8 | Focus en monto efectivo |
| ESC | Cancelar/Cerrar |
| + / - | Aumentar/Disminuir cantidad |

## Uso

```tsx
import { SalesPOS } from '@/pos'

function VentasPage() {
  return (
    <SalesPOS
      sucursalId={1}
      cajaId={1}
      userId="uuid-del-usuario"
      userName="Nombre Cajero"
    />
  )
}
```

## Estado del Carrito (usePOS)

```typescript
const {
  // Items
  items,                      // CartItem[]
  addItem,                    // (producto, lotes, cantidad, unidad) => void
  updateItemQuantity,         // (itemId, cantidad) => void
  removeItem,                 // (itemId) => void
  clearCart,                  // () => void
  
  // Totales
  subtotal,                   // number
  montoIgv,                   // number (18%)
  total,                      // number
  
  // Cliente
  clienteData,                // { nombre, documento, ... }
  setClienteData,             // (data) => void
  
  // Pago
  metodoPago,                 // 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'MIXTO'
  montoEfectivo,              // number
  montoDigital,               // number
  setMetodoPago,
  setMontoEfectivo,
  setMontoDigital,
  
  // Submit
  submitVenta,                // () => Promise<boolean>
  isProcessing,               // boolean
  errors                      // string[]
} = usePOS(sucursalId, cajaId, userId)
```

## Integración con Backend

```typescript
// Flujo FEFO completo
const handleAddProduct = async (producto: Producto) => {
  // 1. Buscar lotes FEFO
  const { lotes } = await buscarLotesFEFO(
    producto.id,
    sucursalId,
    cantidad,
    'CAJA',
    producto.unidadPorCaja,
    null
  )
  
  // 2. Agregar al carrito (distribuye entre lotes)
  await addItem(producto, cantidad, 'CAJA', lotes)
}

// Al confirmar venta
const handleConfirm = async () => {
  const success = await submitVenta()
  if (success) {
    // Backend procesa:
    // - Inserta venta
    // - Descontará stock por lote
    // - Registra en kardex
  }
}
```

## Estilos

Usa las clases del tema del sistema:
- `bg-surface` - Fondos de tarjetas
- `text-primary` - Precios y totales
- `text-muted` - Textos secundarios
- `border-border` - Bordes
- `bg-accent` - Hover states

## Validaciones

- Stock insuficiente: Alerta antes de agregar
- Lote vencido: Bloqueo con mensaje
- Receta requerida: Advertencia visual
- Pago incompleto: Bloqueo en checkout
