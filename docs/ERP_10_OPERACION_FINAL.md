# ERP 10/10 — Operación Final

## 1. Flujo Compra → Lote → Almacén → Venta → Anulación

### A. Compra (`POST /compras`)

```
1. Crear cabecera bot_compras
2. Para cada item:
   a. Crear bot_lotes (producto, almacén, vencimiento, cantidad)
   b. UPDATE bot_productos.nstock += cantidad
   c. INSERT bot_kardex (COMPRA, +cantidad)
   d. INSERT bot_movimientos_almacen (COMPRA, destino=almacén)
3. COMMIT
```

**Resultado**: Lote creado en almacén específico, stock y kardex sincronizados.

### B. Venta POS (`POST /ventas`)

```
1. Resolver almacenId (seleccionado en POS o default vendible)
2. Validar almacén: bpermite_venta = true
3. Para cada item:
   a. Verificar bot_productos.nstock >= cantidad
   b. FEFO: buscar lotes en almacenId, vigentes, ORDER BY vencimiento ASC
   c. Descontar bot_lotes.ncantidad (FEFO order)
   d. UPDATE bot_productos.nstock -= cantidad
   e. INSERT bot_kardex (VENTA, -cantidad, almacenId)
   f. INSERT bot_movimientos_almacen (VENTA, origen=almacenId)
4. INSERT bot_ventas (con nalmacen_id)
5. COMMIT
```

**Resultado**: Stock descontado de lotes FEFO del almacén vendible.

### C. Anulación (`PATCH /ventas/:id/anular`)

```
1. SELECT venta con FOR UPDATE
2. Validar estado != ANULADA
3. Para cada item:
   a. UPDATE bot_productos.nstock += cantidad
   b. INSERT bot_kardex (ANULACION_VENTA, +cantidad)
4. Para cada lote afectado:
   a. UPDATE bot_lotes.ncantidad += cantidad_usada
   b. INSERT bot_kardex por lote (ANULACION_VENTA)
5. Si venta tiene nalmacen_id:
   a. INSERT bot_movimientos_almacen (DEVOLUCION_CLIENTE, destino=almacenId)
6. UPDATE bot_ventas.cestado = 'ANULADA'
7. INSERT bot_auditoria
8. COMMIT
```

**Resultado**: Todo revertido: producto, lotes, movimiento de almacén.

---

## 2. Flujo de Traslados entre Almacenes

### `POST /traslados-almacen`

```
Entrada: productoId, almacenOrigenId, almacenDestinoId, cantidad, [loteId], motivo

1. Validar almacenes origen y destino (activos, distintos)
2. Validar producto

Si loteId especificado:
   3a. Verificar lote en almacén origen con stock suficiente
   4a. Si cantidad == total lote → mover lote (UPDATE nalmacen_id)
   4b. Si cantidad < total → fraccionar:
       - Reducir lote origen
       - Crear nuevo lote en destino con misma fecha/código

Si loteId no especificado:
   3b. FEFO desde almacén origen
   4b. Para cada lote tomado → mover o fraccionar

5. INSERT bot_movimientos_almacen (TRASLADO, origen→destino)
6. INSERT bot_kardex (TRASLADO, cantidad=0, mismo stock — solo reubicación)
7. INSERT bot_auditoria
8. COMMIT
```

**Nota**: El traslado no cambia `bot_productos.nstock` (el producto sigue existiendo, solo cambió de ubicación).

---

## 3. Flujo de Devoluciones

### A. Devolución Cliente (`POST /traslados-almacen/devolucion-cliente`)

```
1. Validar almacén destino (típicamente: CUARENTENA)
2. UPDATE bot_productos.nstock += cantidad
3. Crear o actualizar lote en almacén destino
4. INSERT bot_movimientos_almacen (DEVOLUCION_CLIENTE)
5. INSERT bot_kardex (DEVOLUCION_CLIENTE, +cantidad)
6. COMMIT
```

**Política**: El producto devuelto entra a CUARENTENA para revisión. Un traslado posterior lo mueve a DISPONIBLE si pasa inspección.

### B. Devolución Proveedor (`POST /traslados-almacen/devolucion-proveedor`)

```
1. Validar almacén origen
2. Descontar de lote(s) en almacén origen (FEFO si no se especifica loteId)
3. UPDATE bot_productos.nstock -= cantidad
4. INSERT bot_movimientos_almacen (DEVOLUCION_PROVEEDOR)
5. INSERT bot_kardex (DEVOLUCION_PROVEEDOR, -cantidad)
6. COMMIT
```

**Política**: Sale del inventario. El proveedor recibe la mercadería de vuelta.

---

## 4. Decisiones de Arquitectura

### Transacciones

Toda operación que modifica stock usa **TX con client** (BEGIN/COMMIT/ROLLBACK).  
Los lotes se bloquean con `FOR UPDATE` para evitar race conditions.  
Se usa **optimistic locking** (`nversion`) en lotes para traslados.

### FEFO

El sistema FEFO siempre:
- Filtra por almacén
- Ordena por `dfechavencimiento ASC, tcreado ASC`
- Excluye lotes vencidos (`dfechavencimiento >= CURRENT_DATE`)
- Solo toma lotes ACTIVO con `ncantidad > 0`

### Kardex

Cada movimiento de stock genera entrada en `bot_kardex` con:
- `nstock_anterior` y `nstock_nuevo` (de bot_productos.nstock)
- `nlote_id` y `ccodigo_lote` cuando aplica
- `nalmacen_id` para trazabilidad por almacén
- `ctipo`: VENTA, COMPRA, ANULACION_VENTA, TRASLADO, DEVOLUCION_CLIENTE, DEVOLUCION_PROVEEDOR, RECONCILIACION, VENCIMIENTO, AJUSTE

### Movimientos de Almacén

`bot_movimientos_almacen` registra toda entrada/salida física con:
- `nalmacen_origen_id` (NULL si es entrada)
- `nalmacen_destino_id` (NULL si es salida)
- Tipos controlados por CHECK: COMPRA, VENTA, CONSUMO_CLINICO, TRASLADO, DEVOLUCION_CLIENTE, DEVOLUCION_PROVEEDOR, BAJA, AJUSTE

---

## 5. Endpoints Completos

### Operaciones de Stock

| Endpoint | Método | Función |
|---|---|---|
| `/ventas` | POST | Venta POS con FEFO por almacén |
| `/ventas/:id/anular` | PATCH | Anulación con reversión completa |
| `/compras` | POST | Compra con lote + almacén |
| `/traslados-almacen` | POST | Traslado entre almacenes |
| `/traslados-almacen` | GET | Historial de traslados |
| `/traslados-almacen/devolucion-cliente` | POST | Devolución de cliente |
| `/traslados-almacen/devolucion-proveedor` | POST | Devolución a proveedor |

### Consistencia y Alertas

| Endpoint | Método | Función |
|---|---|---|
| `/consistencia/resumen` | GET | Dashboard ejecutivo de consistencia |
| `/consistencia/stock` | GET | Stock tabla vs lotes |
| `/consistencia/lotes` | GET | Integridad de lotes |
| `/consistencia/kardex` | GET | Kardex vs stock real |
| `/consistencia/alertas` | GET | Alertas operativas |
| `/consistencia/reconciliar` | POST | Sincronizar nstock desde lotes |
| `/consistencia/marcar-vencidos` | POST | Marcar lotes vencidos |

### Inventario

| Endpoint | Método | Función |
|---|---|---|
| `/inventario` | GET | Lista de productos |
| `/inventario/distribucion` | GET | Stock por almacén + lote |
| `/lotes/consistencia` | GET | Verificación básica lotes |
| `/lotes/disponibles/:id` | GET | Lotes FEFO por producto |
