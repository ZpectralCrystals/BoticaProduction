# KARDEX IMPLEMENTADO — Botica El Pueblo ERP
**Fecha:** 11 Abril 2026 — 34/34 tests ✅  
**Tipo:** Trazabilidad completa de movimientos de inventario

---

## Estructura de la tabla `bot_kardex`

```sql
CREATE TABLE bot_kardex (
    nid             SERIAL PRIMARY KEY,
    nproducto_id    INTEGER      NOT NULL,   -- FK → bot_productos.nid
    ctipo           VARCHAR(30)  NOT NULL,   -- Tipo de movimiento
    cref_tabla      VARCHAR(40),             -- Tabla origen del documento
    nref_id         INTEGER,                 -- ID del documento origen
    ncantidad       INTEGER      NOT NULL,   -- Positivo=entrada, Negativo=salida
    nstock_anterior INTEGER      NOT NULL,   -- Stock antes del movimiento
    nstock_nuevo    INTEGER      NOT NULL,   -- Stock después del movimiento
    cdetalle        TEXT,                    -- Descripción del movimiento
    nusuario_id     INTEGER,                 -- FK → bot_usuarios.nid
    cusuario        VARCHAR(100),            -- Nombre del usuario
    tcreado         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    -- Trazabilidad FEFO (agregado por 005_fefo.sql)
    nlote_id        INTEGER,                 -- FK → bot_lotes.nid (nullable)
    ccodigo_lote    VARCHAR(100)             -- Código del lote consumido
);
```

**Scripts de migración:**
- `ops/migrations/003_bot_kardex.sql` — tabla base + 4 índices (idempotente)
- `ops/migrations/005_fefo.sql` — añade `nlote_id`, `ccodigo_lote` y FK a `bot_lotes`

---

## Valores del campo `ctipo`

| ctipo | Operación | `ncantidad` | `cref_tabla` |
|---|---|---|---|
| `VENTA` | Venta desde POS (sin lotes) | Negativo | `bot_ventas` |
| `VENTA` | Venta FEFO — por lote | Negativo | `bot_ventas` |
| `ANULACION_VENTA` | Reversión por anulación de venta | Positivo | `bot_ventas` |
| `COMPRA` | Recepción de compra | Positivo | `bot_compras` |
| `TRANSFERENCIA` | Salida por transferencia | Negativo | `bot_transferencias` |
| `MERMA` | Merma o pérdida | Negativo | `bot_transferencias` |
| `ENTRADA` | Entrada genérica | Positivo | `bot_transferencias` |
| `DONACION` | Entrada por donación | Positivo | `bot_transferencias` |
| `REGALO` | Entrada por regalo | Positivo | `bot_transferencias` |
| `MUESTRA` | Entrada de muestra médica | Positivo | `bot_transferencias` |
| `AJUSTE` | Ajuste manual de inventario (admin) | Positivo o Negativo | `bot_kardex` |

---

## Operaciones que ya registran Kardex

### Ventas — `POST /api/v1/ventas`

Archivo: `backend-fastify/src/routes/sales.routes.ts`

**Flujo dentro de la transacción:**
```
BEGIN
  → INSERT bot_ventas (cabecera)
  → Para cada ítem:
      → SELECT bot_productos FOR UPDATE   (bloqueo + stock anterior)
      → validar stock suficiente
      → validar producto no vencido
      → INSERT bot_ventas_det
      → UPDATE bot_productos SET nstock = nstock - cantidad
      → INSERT bot_kardex (ctipo='VENTA', ncantidad=-cantidad)
  → INSERT bot_auditoria
COMMIT
```

**Ejemplo de registro generado:**
```json
{
  "nproducto_id": 5,
  "ctipo": "VENTA",
  "cref_tabla": "bot_ventas",
  "nref_id": 142,
  "ncantidad": -3,
  "nstock_anterior": 20,
  "nstock_nuevo": 17,
  "cdetalle": "Paracetamol 500mg",
  "cusuario": "María Quispe"
}
```

---

### Compras — `POST /api/v1/compras`

Archivo: `backend-fastify/src/routes/purchases.routes.ts`

**Flujo dentro de la transacción:**
```
BEGIN
  → INSERT bot_compras (cabecera)
  → Para cada ítem:
      → INSERT bot_compras_det
      → SELECT bot_productos FOR UPDATE   (stock anterior)
      → UPDATE bot_productos SET nstock = nstock + cantidad
      → INSERT bot_kardex (ctipo='COMPRA', ncantidad=+cantidad)
  → INSERT bot_auditoria
COMMIT
```

---

### Transferencias — `POST /api/v1/transferencias`

Archivo: `backend-fastify/src/routes/transfers.routes.ts`

**Flujo para salidas (Transferencia, Merma):**
```
BEGIN
  → INSERT bot_transferencias
  → Para cada ítem:
      → SELECT bot_productos FOR UPDATE   (stock anterior + validación)
      → UPDATE nstock = nstock - cantidad
      → INSERT bot_kardex (ctipo=tipo.toUpperCase(), ncantidad=-cantidad)
  → INSERT bot_auditoria
COMMIT
```

**Flujo para entradas (Entrada, Donacion, Regalo, Muestra):**
```
BEGIN
  → Para cada ítem:
      → SELECT bot_productos FOR UPDATE   (stock anterior)
      → UPDATE nstock = nstock + cantidad
      → INSERT bot_kardex (ctipo=tipo.toUpperCase(), ncantidad=+cantidad)
COMMIT
```

---

## Endpoints disponibles

Todos los endpoints requieren autenticación (`Authorization: Bearer <token>` o cookie `botica_token`).

### `GET /api/v1/kardex`

Lista movimientos con filtros opcionales y paginación.

**Query params:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `producto_id` | integer | Filtrar por producto |
| `tipo` | string | `VENTA`, `COMPRA`, `TRANSFERENCIA`, `AJUSTE`, etc. |
| `desde` | date string | Fecha inicio (`2026-04-01`) |
| `hasta` | date string | Fecha fin (`2026-04-30`) |
| `ref_tabla` | string | `bot_ventas`, `bot_compras`, `bot_transferencias` |
| `ref_id` | integer | ID del documento origen |
| `limit` | integer | Máximo registros (default: 100, max: 500) |
| `offset` | integer | Desplazamiento para paginación (default: 0) |

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "total": 3,
  "data": [
    {
      "id": 10,
      "productoId": 5,
      "productoNombre": "Paracetamol 500mg",
      "productoCodigo": "MED-001",
      "tipo": "VENTA",
      "refTabla": "bot_ventas",
      "refId": 142,
      "cantidad": -3,
      "stockAnterior": 20,
      "stockNuevo": 17,
      "detalle": "Paracetamol 500mg",
      "usuarioId": 2,
      "usuario": "María Quispe",
      "fecha": "2026-04-11 09:30:00"
    }
  ]
}
```

La respuesta incluye `total` (total de registros con los filtros), `limit` y `offset`
para construir paginación en el cliente.

---

### `GET /api/v1/kardex/:id`

Detalle de un movimiento específico por su ID.

**Ejemplo:**
```
GET /api/v1/kardex/42
```

**Respuesta:** mismo objeto `data` que en la lista, o `404` si no existe.

---

### `POST /api/v1/kardex/ajuste`

Ajuste manual de stock (solo administradores). Atómico: stock + kardex en la misma transacción.

**Body:**
```json
{
  "productoId": 5,
  "cantidad": -3,
  "motivo": "Merma detectada en conteo físico"
}
```
- `cantidad` positiva = entrada, negativa = salida
- El ajuste es rechazado si deja el stock por debajo de 0
- `motivo` es obligatorio

**Respuesta:**
```json
{
  "success": true,
  "kardexId": 88,
  "productoId": 5,
  "productoNombre": "Paracetamol 500mg",
  "cantidad": -3,
  "stockAnterior": 20,
  "stockNuevo": 17,
  "motivo": "Merma detectada en conteo físico"
}
```

---

### `GET /api/v1/kardex/resumen/:productoId`

Resumen de movimientos agrupado por tipo para un producto específico.

**Ejemplo:**
```
GET /api/v1/kardex/resumen/5
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "productoId": 5,
    "productoNombre": "Paracetamol 500mg",
    "productoCodigo": "MED-001",
    "stockActual": 17,
    "resumenPorTipo": [
      {
        "tipo": "COMPRA",
        "cantidadMovimientos": 2,
        "unidadesNeto": 50,
        "primerMovimiento": "2026-01-15 10:00:00",
        "ultimoMovimiento": "2026-03-10 14:30:00"
      },
      {
        "tipo": "VENTA",
        "cantidadMovimientos": 8,
        "unidadesNeto": -33,
        "primerMovimiento": "2026-01-20 09:00:00",
        "ultimoMovimiento": "2026-04-11 09:30:00"
      }
    ]
  }
}
```

---

## Aplicar la migración

```bash
# Verificar que no hay productos con stock < 0 (por si acaso)
psql -U postgres -d botica_db -c "SELECT COUNT(*) FROM bot_productos WHERE nstock < 0;"

# Aplicar migración
psql -U postgres -d botica_db -f ops/migrations/003_bot_kardex.sql

# Verificar
psql -U postgres -d botica_db -c "\d bot_kardex"
```

---

## Garantía de atomicidad

Cada INSERT en `bot_kardex` vive en la **misma transacción** que el UPDATE de stock.

```
Si el INSERT en bot_kardex falla  → ROLLBACK automático (el stock NO se modifica)
Si el UPDATE de stock falla       → ROLLBACK automático (el kardex NO se registra)
```

No es posible tener stock modificado sin kardex ni kardex sin stock modificado.

---

## Consultas SQL útiles para auditoría

### Ver todos los movimientos de hoy
```sql
SELECT k.*, p.cnombre
FROM bot_kardex k
JOIN bot_productos p ON p.nid = k.nproducto_id
WHERE k.tcreado::DATE = CURRENT_DATE
ORDER BY k.tcreado DESC;
```

### Verificar consistencia: comparar suma kardex vs stock actual
```sql
SELECT
    p.nid,
    p.cnombre,
    p.nstock AS stock_actual,
    COALESCE(SUM(k.ncantidad), 0) AS suma_kardex,
    p.nstock - COALESCE(SUM(k.ncantidad), 0) AS diferencia
FROM bot_productos p
LEFT JOIN bot_kardex k ON k.nproducto_id = p.nid
GROUP BY p.nid, p.cnombre, p.nstock
HAVING p.nstock != COALESCE(SUM(k.ncantidad), 0)
ORDER BY diferencia;
-- Si retorna 0 filas, el kardex está perfectamente sincronizado
```

### Ver ventas de un producto en el último mes
```sql
SELECT k.nref_id AS venta_id, k.ncantidad, k.nstock_nuevo, k.cusuario, k.tcreado
FROM bot_kardex k
WHERE k.nproducto_id = 5
  AND k.ctipo = 'VENTA'
  AND k.tcreado >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY k.tcreado DESC;
```

---

## Limitaciones actuales

1. **Sin anulación de lotes en transferencias**: Cuando se anula una transferencia que consumió lotes, `bot_lotes.ncantidad` **no se restaura** automáticamente. Se necesita ajuste manual vía `POST /kardex/ajuste`.

2. **Sin data histórica previa**: Solo registra movimientos a partir de la fecha en que se aplicó la migración `003_bot_kardex.sql`. Los movimientos anteriores al deploy no están en Kardex.

3. **Sin fraccionamiento**: El campo `ncantidad` es `INTEGER` — no soporta fracciones (ej. 0.5 blísters). Si se implementa fraccionamiento, se necesitará `DECIMAL(10,2)`.

4. **Ajuste no restaura lotes FEFO**: El endpoint `POST /kardex/ajuste` ajusta `bot_productos.nstock` pero no afecta `bot_lotes`. Para ajustes con trazabilidad de lote se necesitará una versión extendida del endpoint.

5. **Sin endpoint de exportación**: No existe endpoint de exportación a CSV/XLSX. Para reportes, usar los filtros de `GET /kardex` combinados con la herramienta de reportes del sistema.
