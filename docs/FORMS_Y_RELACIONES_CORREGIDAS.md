# FORMULARIOS Y RELACIONES CORREGIDAS
**Fecha:** 12 Abril 2026  
**Estado:** ✅ 82/82 tests · ✅ TS sin errores

---

## 1. Formularios corregidos

### inventory-page.tsx (Productos / Inventario)

| Campo | Antes | Ahora |
|---|---|---|
| **Proveedor** | `<Input>` texto libre | `<select>` desde catálogo `bot_proveedores` |
| **Stock (en edición)** | `<Input>` editable | `<div>` solo lectura — stock se gestiona vía compras/ventas |
| **Stock (en creación)** | `<Input>` editable | Sin cambio (stock inicial al crear producto) |

### compras-page.tsx (Compras)

| Campo | Antes | Ahora |
|---|---|---|
| **Proveedor** | Ya era `<select>` ✅ | Sin cambio |
| **Código de lote** | No existía | `<Input>` por cada ítem (opcional) |
| **Fecha vencimiento lote** | No existía | `<Input type="date">` por cada ítem (opcional) |

---

## 2. Campos cambiados: editable → seleccionable

| Componente | Campo | Tipo anterior | Tipo nuevo | Fuente de datos |
|---|---|---|---|---|
| `inventory-page.tsx` | Proveedor | Input texto | Select | `GET /api/v1/proveedores` |
| `inventory-page.tsx` | Categoría | Select ✅ | Sin cambio | Fijo: Medicamentos/Insumos/Vitaminas/Equipos |
| `inventory-page.tsx` | Rotación | Select ✅ | Sin cambio | Fijo: Alta/Media/Baja |
| `inventory-page.tsx` | Receta | Select ✅ | Sin cambio | Fijo: Si/No |
| `compras-page.tsx` | Proveedor | Select ✅ | Sin cambio | `GET /api/v1/proveedores` |
| `compras-page.tsx` | Producto | Select ✅ | Sin cambio | `GET /api/v1/inventario` |

---

## 3. Campos cambiados a solo lectura

| Componente | Campo | Razón |
|---|---|---|
| `inventory-page.tsx` | Stock (en edición) | Stock se modifica solo vía compras, ventas, transferencias o ajustes de kardex. Editar manualmente rompe consistencia con lotes. |

---

## 4. Lotes en productos/inventario

### Tabla de inventario

Columna nueva: **Lote FEFO** — muestra el lote principal (primer vencimiento) con:
- Código del lote (`MIGRACION-X`, `L-CMP-001`, etc.)
- Fecha de vencimiento + días restantes
- Color semáforo: rojo ≤30d, ámbar ≤90d, gris >90d
- Si hay más lotes: `+N más`
- Si no hay lotes: `Sin lote`

### API — GET /api/v1/inventario

Nuevos campos en la respuesta:

```json
{
  "supplierId": "10",
  "supplier": "Distribuidora Farma SAC",
  "lotes": [
    { "id": 1, "codigo": "L-CMP-001", "vencimiento": "2027-01-01", "cantidad": 50, "estado": "ACTIVO", "diasParaVencer": 630 }
  ],
  "lotePrincipal": {
    "codigo": "L-CMP-001",
    "vencimiento": "2027-01-01",
    "cantidad": 50,
    "diasParaVencer": 630
  },
  "totalLotes": 1
}
```

Si el producto no tiene lotes activos con stock > 0:
- `lotes: []`
- `lotePrincipal: null`
- `totalLotes: 0`

---

## 5. Validaciones agregadas en backend

### inventory.routes.ts

| Validación | Detalle |
|---|---|
| **Proveedor por ID** | Si `supplierId > 0`, valida existencia en `bot_proveedores WHERE cestado = 'A'`. Si no existe → `400 PROVEEDOR NO ENCONTRADO` |
| **`nproveedor_id` almacenado** | Se guarda tanto `nproveedor_id` (FK) como `cproveedor` (nombre derivado) |
| **Stock no editable en update** | El UPDATE ya no incluye `nstock` — solo se modifica vía transacciones controladas |

### purchases.routes.ts

| Validación | Detalle |
|---|---|
| **Proveedor por ID** | Si `proveedorId > 0`, valida existencia en `bot_proveedores WHERE cestado = 'A'`. Si no existe → `400 PROVEEDOR NO ENCONTRADO` |
| **Nombre derivado** | `cproveedor` se toma del registro en BD, no del payload del frontend |

---

## 6. Resumen de archivos modificados

| Archivo | Cambios |
|---|---|
| `backend-fastify/src/routes/inventory.routes.ts` | GET: JOIN proveedores + subquery lotes FEFO. POST: validar supplierId, almacenar nproveedor_id, stock readonly en update |
| `backend-fastify/src/routes/purchases.routes.ts` | Validar proveedorId contra bot_proveedores antes de crear compra |
| `backend-fastify/src/__tests__/purchases.test.ts` | Mock: agregar respuesta para nueva query de validación de proveedor |
| `frontend/src/lib/api.ts` | Nuevos tipos: `ApiInventoryLote`, campos `supplierId`, `lotes`, `lotePrincipal`, `totalLotes` |
| `frontend/src/pages/inventory-page.tsx` | Proveedor→select, stock readonly en edit, columnas Proveedor y Lote FEFO en tabla |
| `frontend/src/pages/compras-page.tsx` | Campos código de lote y fecha vencimiento por ítem |
| `frontend/src/pos/hooks/usePOS.test.ts` | Mock: agregar `apiGetPatients` faltante |

---

## 7. Pendientes fuera de alcance

| Ítem | Razón |
|---|---|
| Categoría como catálogo dinámico (no fijo) | No existe tabla `bot_categorias` — requiere migración |
| Laboratorio como catálogo seleccionable | No existe tabla `bot_laboratorios` — requiere migración |
| Familia como catálogo seleccionable | No existe tabla `bot_familias` — requiere migración |
| Edición/eliminación de líneas en compras | UX menor — se puede agregar en siguiente sprint |
| Vista detalle de producto con todos los lotes | Requiere página nueva o modal expandible |
