# Inventario por Almacén — Implementación

## Resumen

La vista de inventario ahora muestra la **distribución real de stock** por almacén y lote,
permitiendo al usuario responder: _"¿Dónde están mis productos?"_ sin consultar la base de datos.

---

## Endpoint Backend

### `GET /api/v1/inventario/distribucion`

**Query params opcionales:**
- `search` — filtrar por nombre o código de producto
- `localId` — filtrar por local específico
- `almacenId` — filtrar por almacén específico

**Respuesta:**
```json
{
  "success": true,
  "totalProductos": 42,
  "totalStockVendible": 1200,
  "totalStockNoVendible": 85,
  "productos": [
    {
      "productoId": 1,
      "productoCodigo": "MED-001",
      "productoNombre": "Paracetamol 500mg",
      "stockTotal": 120,
      "stockVendible": 100,
      "stockNoVendible": 20,
      "almacenes": [
        {
          "almacenId": 1,
          "almacenNombre": "Botica – Disponible",
          "tipoAlmacen": "DISPONIBLE",
          "permiteVenta": true,
          "permiteConsumoClinico": false,
          "localId": 1,
          "localNombre": "Botica El Pueblo",
          "tipoLocal": "BOTICA",
          "stock": 100,
          "lotesActivos": 2,
          "proximoVencimiento": "2026-08-15",
          "lotes": [
            {
              "id": 10,
              "codigoLote": "L-PAR-001",
              "vencimiento": "2026-08-15",
              "cantidad": 60,
              "diasParaVencer": 125
            },
            {
              "id": 11,
              "codigoLote": "L-PAR-002",
              "vencimiento": "2027-01-10",
              "cantidad": 40,
              "diasParaVencer": 273
            }
          ]
        },
        {
          "almacenId": 3,
          "almacenNombre": "Botica – Cuarentena",
          "tipoAlmacen": "CUARENTENA",
          "permiteVenta": false,
          "permiteConsumoClinico": false,
          "localId": 1,
          "localNombre": "Botica El Pueblo",
          "tipoLocal": "BOTICA",
          "stock": 20,
          "lotesActivos": 1,
          "proximoVencimiento": "2026-06-01",
          "lotes": [
            {
              "id": 12,
              "codigoLote": "L-PAR-003",
              "vencimiento": "2026-06-01",
              "cantidad": 20,
              "diasParaVencer": 50
            }
          ]
        }
      ]
    }
  ]
}
```

**Fuente de datos:** Vista `vw_stock_por_almacen` + `bot_lotes` para detalle por lote.

---

## Frontend — `inventory-page.tsx`

### Tabs

| Tab | Descripción |
|-----|-------------|
| **Productos** | Vista original: tabla de productos con stock, estado, lote FEFO |
| **Stock por almacén** | Vista nueva: distribución agrupada por producto → almacén → lote |

### Vista "Stock por almacén"

#### Cards resumen
- **Productos con stock** — total de productos con stock > 0 en algún almacén
- **Stock vendible** (verde) — sum de stock en almacenes con `permiteVenta = true`
- **Stock no vendible** (ámbar) — sum de stock en almacenes sin permiso de venta
- **Stock total** — vendible + no vendible

#### Filtros
- **Buscar producto** — por nombre o código
- **Filtrar por local** — selector de locales activos
- **Actualizar** — recarga manual

#### Tabla expandible

**Fila colapsada (producto):**
```
▶ MED-001  Paracetamol 500mg    100 / 20    120  en 2 alm.
           [código]  [nombre]    [vend] [no-vend] [total]
```

**Fila expandida (click para abrir):**
```
▼ MED-001  Paracetamol 500mg    100 / 20    120  en 2 alm.
  ├─ 🏪 DISPONIBLE  Botica – Disponible  (Botica El Pueblo)  [Venta]  100
  │     Lote          Vencimiento    Días    Cant.
  │     L-PAR-001     2026-08-15     125d    60
  │     L-PAR-002     2027-01-10     273d    40
  │
  └─ 🏪 CUARENTENA  Botica – Cuarentena  (Botica El Pueblo)          20
        Lote          Vencimiento    Días    Cant.
        L-PAR-003     2026-06-01     50d     20
```

---

## UX — Colores por tipo de almacén

| Tipo almacén | Color |
|---|---|
| `DISPONIBLE` | Verde (emerald) |
| `CUARENTENA` | Amarillo (amber) |
| `BAJA` | Rojo (red) |
| `DEVOLUCION_CLIENTE` | Naranja (orange) |
| `DEVOLUCION_PROVEEDOR` | Naranja (orange) |
| `PROCEDIMIENTOS` | Azul (blue) |
| `CONTROL_ESPECIAL` | Púrpura (purple) |

### Badges de política
- **Venta** (verde) — almacén permite venta directa
- **Clínico** (azul) — almacén permite consumo clínico

### Colores de vencimiento en lotes
| Condición | Color |
|---|---|
| Vencido (≤ 0 días) | Rojo bold |
| ≤ 30 días | Rojo semibold |
| ≤ 90 días | Ámbar |
| > 90 días | Gris (muted) |

---

## Regla de negocio clave

> **NUNCA** se muestra solo stock global.  
> **SIEMPRE** se muestra el contexto: dónde está el stock y si es vendible o no.

El stock total del producto (`bot_productos.nstock`) es informativo.  
La **verdad operativa** está en `vw_stock_por_almacen` y `bot_lotes`.

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend-fastify/src/routes/inventory.routes.ts` | Nuevo endpoint `GET /distribucion` |
| `frontend/src/lib/api.ts` | Tipos `ApiDistribucion*` + `apiGetDistribucion()` |
| `frontend/src/pages/inventory-page.tsx` | Tabs + vista distribución expandible |

## Estado de validación

- **Backend**: 35/35 tests ✅, TS clean
- **Frontend**: 47/47 tests ✅, TS clean
- **Total**: 82/82 tests ✅
