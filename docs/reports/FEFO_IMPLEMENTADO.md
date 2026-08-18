# FEFO IMPLEMENTADO — Botica El Pueblo ERP
**Fecha:** Abril 2026  
**Alcance:** Ventas con descuento FEFO real de `bot_lotes`

---

## ¿Qué es FEFO?

**First Expired, First Out** — Primero en Vencer, Primero en Salir.  
Principio regulatorio farmacéutico: cuando se vende un medicamento que tiene múltiples lotes en stock, se debe consumir primero el lote cuya fecha de vencimiento sea más próxima. Esto minimiza el riesgo de vender productos caducados y reduce las mermas.

---

## Migraciones necesarias

Ejecutar en orden:

```bash
psql -U postgres -d botica_db -f ops/migrations/004_bot_lotes.sql
psql -U postgres -d botica_db -f ops/migrations/005_fefo.sql
```

**`005_fefo.sql`** agrega:
- `bot_kardex.nlote_id` (INTEGER, FK → bot_lotes)
- `bot_kardex.ccodigo_lote` (VARCHAR 100)
- `bot_ventas_det.nlote_id` (INTEGER, FK → bot_lotes)
- `bot_ventas_det.clote_codigo` (VARCHAR 100)
- Índices `idx_bot_kardex_lote` y `idx_bot_ventas_det_lote`

---

## Flujo FEFO en Ventas (`POST /api/v1/ventas`)

### Diagrama de decisión por ítem

```
Para cada ítem de la venta:
│
├─ ¿Tiene productoId?
│   NO → INSERT bot_ventas_det (Servicio) → siguiente ítem
│   SÍ ↓
│
├─ SELECT bot_productos FOR UPDATE
│   ├─ ¿No encontrado o inactivo?  → ROLLBACK + 400
│   └─ ¿nstock < cantidad?          → ROLLBACK + 400 (STOCK INSUFICIENTE)
│
├─ SELECT bot_lotes WHERE activo + vigente + stock > 0
│   ORDER BY dfechavencimiento ASC   FOR UPDATE
│
│   ¿Hay lotes? SÍ ─────────────────────────────────────────┐
│   │                                                        │
│   ├─ ¿SUM(lotes) < cantidad? → ROLLBACK + 400            │
│   │   (STOCK EN LOTES INSUFICIENTE)                       │
│   │                                                        │
│   └─ Distribuir FEFO:                                     │
│       Lote 1 → consumir MIN(lote1.cantidad, restante)     │
│       Lote 2 → consumir MIN(lote2.cantidad, restante)...  │
│                                                            │
│   ¿Hay lotes? NO ──────────────────────────────────────┐  │
│   │                                                     │  │
│   └─ ¿Producto vencido (tvencimien)?                   │  │
│       SÍ → ROLLBACK + 400 (PRODUCTO VENCIDO)           │  │
│       NO → sin lotes, continuar                        │  │
│                                                         │  │
├─ INSERT bot_ventas_det (nlote_id = lote primario) ←───┘  │
├─ UPDATE bot_productos nstock -= cantidad ←────────────────┘
│
│  Con lotes:                    Sin lotes:
├─ FOR EACH lote consumido:     ├─ INSERT bot_kardex
│   UPDATE bot_lotes                  (stock producto)
│   INSERT bot_kardex
│   (stock del lote)
```

### Columnas nuevas en `bot_ventas_det`

| Columna | Descripción |
|---|---|
| `nlote_id` | ID del lote primario (el primero en FEFO) |
| `clote_codigo` | Código del lote primario |

Si la venta consume múltiples lotes, el detalle registra el primero. Los demás quedan en `bot_kardex` con su `nlote_id` individual.

### Columnas nuevas en `bot_kardex`

| Columna | Descripción |
|---|---|
| `nlote_id` | ID del lote afectado por el movimiento |
| `ccodigo_lote` | Código del lote afectado |

Cuando hay FEFO, hay **N entradas de Kardex por ítem** (una por lote consumido), cada una con su `nlote_id`.

---

## Compatibilidad total con productos sin lotes

Si un producto no tiene filas en `bot_lotes` (escenario habitual durante la transición):

1. No se ejecuta la rama FEFO
2. Se valida `bot_productos.tvencimien` (validación anterior)
3. Se inserta **un solo kardex** a nivel de producto
4. `bot_ventas_det.nlote_id` queda `NULL`
5. `bot_productos.nstock` se descuenta igual que antes

**El sistema funciona correctamente en ambos casos.**

---

## Escenarios validados

### Escenario 1: Venta de un producto con un solo lote

**Setup:**
```sql
-- Producto P1 con nstock=100
-- Lote A: 100 unidades, vence 2027-06-30
```

**Venta de 30 unidades:**
```
FEFO: consume Lote A (30 unidades)
bot_lotes A: ncantidad 100 → 70, cestado='ACTIVO'
bot_productos P1: nstock 100 → 70
bot_kardex: VENTA -30 [nlote_id=LoteA, stock_ant=100, stock_new=70]
```

### Escenario 2: Venta con dos lotes (FEFO multi-lote)

**Setup:**
```sql
-- Lote A: 50 unidades, vence 2026-05-01  (vence primero)
-- Lote B: 100 unidades, vence 2026-10-01
-- nstock total = 150
```

**Venta de 80 unidades:**
```
FEFO distribuye:
  Lote A: consumir 50 (agota el lote) → cestado='AGOTADO'
  Lote B: consumir 30 (quedan 70)

bot_kardex entrada 1: VENTA -50 [nlote_id=A] stock_lote 50→0
bot_kardex entrada 2: VENTA -30 [nlote_id=B] stock_lote 100→70
bot_productos: nstock 150→70
bot_ventas_det: nlote_id=LoteA (lote primario)
```

### Escenario 3: Rechazo por stock insuficiente en lotes

**Setup:**
```sql
-- Lote A: 20 unidades activo
-- Lote B: 30 unidades activo
-- nstock = 50 (consistente)
```

**Intento de venta de 60 unidades:**
```
HTTP 400: STOCK EN LOTES INSUFICIENTE: Paracetamol 500mg
           tiene 50 unidad(es) en lotes vigentes, se requieren 60
```
El `bot_productos.nstock` también es 50, así que primero fallaría esa validación. Ambas capas actúan como red de seguridad.

### Escenario 4: Rechazo de lote vencido

**Setup:**
```sql
-- Solo Lote C: 100 unidades, dfechavencimiento < CURRENT_DATE
-- La query FEFO filtra: AND dfechavencimiento >= CURRENT_DATE
-- → No encuentra lotes activos
-- → Fallback a bot_productos.tvencimien (si está configurado)
```

Los lotes vencidos (`dfechavencimiento < CURRENT_DATE`) son excluidos automáticamente del query FEFO. No se pueden consumir por diseño.

---

## Endpoints de consulta de lotes

### `GET /api/v1/lotes/disponibles/:productoId`

Retorna todos los lotes vigentes de un producto en orden FEFO, con stock acumulado.

```
GET /api/v1/lotes/disponibles/12
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "productoId": 12,
    "productoNombre": "Paracetamol 500mg",
    "productoCodigo": "MED-001",
    "stockTotal": 150,
    "stockEnLotes": 150,
    "stockSinLote": 0,
    "tieneLottes": true,
    "lotes": [
      {
        "id": 3,
        "codigoLote": "L-A-2026",
        "fechaVencimiento": "2026-05-01",
        "cantidad": 50,
        "cantidadInicial": 50,
        "diasParaVencer": 20,
        "alerta": "CRITICO",
        "stockAcumulado": 50
      },
      {
        "id": 4,
        "codigoLote": "L-B-2026",
        "fechaVencimiento": "2026-10-01",
        "cantidad": 100,
        "cantidadInicial": 100,
        "diasParaVencer": 173,
        "alerta": "OK",
        "stockAcumulado": 150
      }
    ]
  }
}
```

El campo `stockAcumulado` permite al frontend determinar desde qué lote se puede satisfacer una cantidad X usando FEFO.

### `GET /api/v1/lotes/fefo/:productoId`

Retorna solo el próximo lote FEFO (el primero que se consumirá).

### `GET /api/v1/lotes?producto_id=X&estado=ACTIVO`

Lista todos los lotes con filtros opcionales.

### `GET /api/v1/lotes/consistencia`

Verifica `bot_productos.nstock` vs. `SUM(bot_lotes.ncantidad)`.

---

## Trazabilidad completa de un lote

```sql
-- Ver todos los movimientos de un lote específico
SELECT
    k.tcreado,
    k.ctipo,
    k.ncantidad,
    k.nstock_anterior,
    k.nstock_nuevo,
    k.cdetalle,
    k.cusuario,
    v.ccodigo AS venta_codigo
FROM bot_kardex k
LEFT JOIN bot_ventas v ON k.cref_tabla = 'bot_ventas' AND k.nref_id = v.nid
WHERE k.nlote_id = <lote_id>
ORDER BY k.tcreado;

-- Ver qué lote se vendió en cada detalle de venta
SELECT
    vd.nventa_id,
    v.ccodigo,
    p.cnombre AS producto,
    vd.ncantidad,
    vd.clote_codigo,
    l.dfechavencimiento
FROM bot_ventas_det vd
JOIN bot_ventas   v ON v.nid = vd.nventa_id
JOIN bot_productos p ON p.nid = vd.nproducto_id
LEFT JOIN bot_lotes l ON l.nid = vd.nlote_id
WHERE vd.clote_codigo IS NOT NULL
ORDER BY v.tcreado DESC;
```

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `ops/migrations/005_fefo.sql` | Columnas `nlote_id` y `ccodigo_lote` en kardex y ventas_det |
| `src/routes/sales.routes.ts` | Loop FEFO multi-lote con fallback compatible |
| `src/routes/lotes.routes.ts` | `GET /disponibles/:productoId` |

---

## Limitaciones actuales

| Tema | Estado |
|---|---|
| Anulación de venta no revierte lotes | ⚠️ Pendiente — revisar `PATCH /ventas/:id/anular` |
| Transferencias sin FEFO | ⏳ Fase futura |
| Frontend no muestra info de lotes en POS | ⏳ Fase futura |
| Sin gestión de lotes vencidos (cambio automático a VENCIDO) | ⏳ Implementar job/cron |
