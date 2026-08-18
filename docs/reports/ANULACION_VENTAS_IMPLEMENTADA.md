# ANULACIÓN DE VENTAS — Implementado
**Fecha:** 11 Abril 2026 — 35/35 tests ✅

---

## Endpoint

```
PATCH /api/v1/ventas/:id/anular
Authorization: Bearer <token>   (o cookie botica_token)
Content-Type: application/json

Body: { "motivo": "Error de cajero / Producto equivocado / etc." }
```

### Respuestas

| Código | Descripción |
|---|---|
| `200` | `{ ok: true, codigo: "VTA-20260411-0003", message: "Venta VTA-... anulada correctamente" }` |
| `400` | ID inválido o motivo vacío |
| `401` | Sin sesión |
| `403` | Usuario sin rol admin/super |
| `404` | Venta no encontrada |
| `409` | Venta ya estaba anulada |
| `500` | Error interno con rollback automático |

---

## Validaciones implementadas

| Validación | Detalle |
|---|---|
| **Autenticación** | Requiere sesión activa (`requireAuth`) |
| **Autorización** | Solo `admin` o `super` — cajero no puede anular |
| **Existencia** | Verifica que `bot_ventas.nid` existe |
| **No doble anulación** | Verifica `cestado != 'I'` → HTTP 409 si ya anulada |
| **ID válido** | `Number(id) > 0` |
| **Motivo requerido** | En el frontend (campo obligatorio con feedback visual) |

---

## Cómo se revierte el stock

### 1. Productos (`bot_productos.nstock`)

Por cada item en `bot_ventas_det` con `nproducto_id`:

```sql
-- Leer stock actual con bloqueo pesimista
SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE;

-- Revertir
UPDATE bot_productos
SET nstock = nstock + ncantidad, tmodifi = NOW()
WHERE nid = $1;
```

### 2. Lotes FEFO (`bot_lotes.ncantidad`)

Cuando la venta utilizó trazabilidad FEFO, el handler consulta el Kardex
original para obtener todos los lotes consumidos (puede ser multi-lote):

```sql
-- Obtener lotes consumidos en esta venta (desde bot_kardex)
SELECT nlote_id, ABS(ncantidad)::INT AS ncantidad_abs, ccodigo_lote, nproducto_id
FROM bot_kardex
WHERE cref_tabla = 'bot_ventas'
  AND nref_id = $saleId
  AND ctipo = 'VENTA'
  AND nlote_id IS NOT NULL;

-- Por cada lote encontrado:
SELECT ncantidad FROM bot_lotes WHERE nid = $loteId FOR UPDATE;

UPDATE bot_lotes
   SET ncantidad = ncantidad + $ncantidad_abs,
       cestado   = 'ACTIVO',
       tmodifi   = NOW()
 WHERE nid = $loteId;
```

> Un lote con `cestado = 'AGOTADO'` vuelve a `'ACTIVO'` automáticamente al restaurarse.

**Garantía:** Todo ocurre en la misma transacción. Si falla cualquier paso → ROLLBACK completo. Nunca queda el stock revertido sin la venta marcada como anulada.

---

## Registro de auditoría

Cada anulación genera una fila en `bot_auditoria`:

```
caccion  = 'ANULACION'
ctabla   = 'bot_ventas'
cdetalle = 'Venta VTA-20260411-0003 anulada. Motivo: Error de cajero'
```

Esto complementa el Kardex y permite trazar quién anuló, cuándo y por qué.

---

## Afectación en Kardex

### Sin FEFO (kardex a nivel producto)

```json
{
  "ctipo": "ANULACION_VENTA",
  "cref_tabla": "bot_ventas",
  "nref_id": 142,
  "ncantidad": +3,
  "nstock_anterior": 17,
  "nstock_nuevo": 20,
  "cdetalle": "Anulación VTA-20260411-0003: Error de cajero"
}
```

### Con FEFO (kardex por lote consumido)

```json
{
  "ctipo": "ANULACION_VENTA",
  "cref_tabla": "bot_ventas",
  "nref_id": 142,
  "nlote_id": 10,
  "ccodigo_lote": "LOTE-2026-001",
  "ncantidad": +3,
  "nstock_anterior": 17,
  "nstock_nuevo": 20,
  "cdetalle": "Anulación VTA-20260411-0003 [Lote LOTE-2026-001]: Error de cajero"
}
```

La trazabilidad es completa en ambos casos: movimiento original (`VENTA`, `-3`) → reversión (`ANULACION_VENTA`, `+3`).

---

## Estado en `bot_ventas`

La venta **no se elimina físicamente**. Solo se actualiza:

```sql
UPDATE bot_ventas SET cestado = 'I' WHERE nid = $1;
-- 'A' = Activa
-- 'I' = Inactiva / Anulada
```

---

## Flujo transaccional completo

```
PATCH /ventas/142/anular
  BEGIN
    SELECT ... FROM bot_ventas WHERE nid=142 FOR UPDATE
    → valida existencia y cestado != 'I'

    SELECT nproducto_id, ncantidad, cdescripcion FROM bot_ventas_det WHERE nventa_id=142

    SELECT nlote_id, ABS(ncantidad), ccodigo_lote, nproducto_id
    FROM bot_kardex WHERE ctipo='VENTA' AND nref_id=142 AND nlote_id IS NOT NULL
    → lista de lotes FEFO consumidos (vacía si no se usó FEFO)

    UPDATE bot_ventas SET cestado='I' WHERE nid=142

    Para cada item en bot_ventas_det:
      SELECT nstock FROM bot_productos WHERE nid=X FOR UPDATE
      UPDATE bot_productos SET nstock = nstock + ncantidad WHERE nid=X
      Si el producto NO tiene movimientos FEFO:
        INSERT bot_kardex (ctipo='ANULACION_VENTA', sin nlote_id)

    Para cada lote FEFO consumido:
      SELECT ncantidad FROM bot_lotes WHERE nid=L FOR UPDATE
      UPDATE bot_lotes SET ncantidad += abs_qty, cestado='ACTIVO'
      SELECT last stock from bot_kardex for this lote
      INSERT bot_kardex (ctipo='ANULACION_VENTA', nlote_id=L, ccodigo_lote)

    INSERT INTO bot_auditoria (caccion='ANULACION', ...)
  COMMIT
  → { ok: true, codigo: "VTA-...", message: "..." }
```

---

## Frontend — UI de anulación

**Ruta:** `/panel/ventas` → pestaña **"Historial de ventas"**

La página de ventas ahora tiene dos pestañas:
- **Terminal POS** — flujo de venta normal (sin cambios)
- **Historial de ventas** — tabla con todas las ventas

En el historial:
- `Badge verde` = Activa | `Badge rojo` = Anulada
- Ventas anuladas aparecen con `opacity-50` (atenuadas)
- Botón **"Anular"** visible solo para `admin` y `super`
- Al hacer clic en "Anular":
  - Se despliega una fila de confirmación inline (no modal)
  - Campo de motivo obligatorio
  - Botón "Confirmar anulación" deshabilitado si motivo vacío
  - Enter en el input también confirma
  - Cargador "Anulando..." mientras procesa
  - Toast de éxito o error al completar
  - Lista se recarga automáticamente

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend-fastify/src/routes/sales.routes.ts` | `PATCH /:id/anular` + `cestado` en GET /ventas |
| `frontend/src/lib/api.ts` | `ApiSale.estado`, `ApiSale.itemsCount`, `apiAnularVenta()` |
| `frontend/src/pages/sales-page.tsx` | Dos pestañas: POS + Historial con anulación |
| `frontend/src/context/app-data-context.tsx` | Cast `as PaymentMethod` (fix pre-existente) |

---

## Simulación de escenarios

### Escenario 1: Anulación exitosa

```bash
# Crear venta (stock inicial: 20 unidades)
POST /api/v1/ventas
→ { ok: true, id: "142", codigo: "VTA-20260411-0003" }
# stock queda: 17 (−3)

# Anular
PATCH /api/v1/ventas/142/anular
Body: { "motivo": "Error de cajero" }
→ { ok: true, codigo: "VTA-20260411-0003", message: "Venta anulada correctamente" }
# stock queda: 20 (+3 revertido)
# bot_ventas.cestado = 'I'
# bot_kardex: ANULACION_VENTA +3
# bot_auditoria: ANULACION registrado
```

### Escenario 2: Doble anulación bloqueada

```bash
PATCH /api/v1/ventas/142/anular
→ HTTP 409: "La venta VTA-20260411-0003 ya fue anulada"
# Stock no se modifica, ningún registro adicional
```

### Escenario 3: Cajero intenta anular

```bash
# Usuario con rol 'cajero' (admin=false, super=false)
PATCH /api/v1/ventas/142/anular
→ HTTP 403: "Solo administradores pueden anular ventas"
```
