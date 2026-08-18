# LOTES IMPLEMENTADOS — Botica El Pueblo ERP
**Fecha:** Abril 2026  
**Fase:** Transición — preparación FEFO sin romper funcionamiento actual

---

## Tabla `bot_lotes`

### Estructura

```sql
CREATE TABLE bot_lotes (
    nid               SERIAL PRIMARY KEY,
    nproducto_id      INTEGER      NOT NULL,  -- FK → bot_productos.nid
    ncompra_id        INTEGER,               -- FK → bot_compras.nid (origen)
    ccodigo_lote      VARCHAR(100),          -- Código del lote (ej: "L-2026-001")
    dfechavencimiento DATE         NOT NULL, -- Fecha de vencimiento
    ncantidad         INTEGER      NOT NULL DEFAULT 0,  -- Stock actual del lote
    ncantidad_inicial INTEGER      NOT NULL DEFAULT 0,  -- Stock al momento de ingreso
    cestado           VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO',
    cnotas            TEXT,
    nversion          INTEGER      NOT NULL DEFAULT 1,  -- Control optimista
    tcreado           TIMESTAMP    DEFAULT NOW(),
    tmodifi           TIMESTAMP    DEFAULT NOW()
);
-- Restricciones: ncantidad >= 0, cestado IN ('ACTIVO','AGOTADO','VENCIDO')
```

### Índices creados

| Índice | Columnas | Propósito |
|---|---|---|
| `idx_bot_lotes_producto_estado` | `(nproducto_id, cestado)` | Consultas por producto |
| `idx_bot_lotes_fefo` | `(nproducto_id, dfechavencimiento)` WHERE activo+stock | **Consulta FEFO rápida** |
| `idx_bot_lotes_vencimiento` | `(dfechavencimiento)` WHERE activo | Alertas de vencimiento |
| `idx_bot_lotes_compra` | `(ncompra_id)` | Trazabilidad por compra |

### Script de migración
```bash
psql -U postgres -d botica_db -f ops/migrations/004_bot_lotes.sql
```

La migración es **idempotente** — se puede ejecutar múltiples veces sin error. Maneja:
- Instalaciones nuevas (sin tabla previa)
- Instalaciones con tabla creada por `fix_database.sql` (agrega columnas faltantes)
- Instalaciones con tabla completa (no hace nada perjudicial)

---

## Integración con Compras

### Endpoint actualizado
```
POST /api/v1/compras
```

Ahora acepta campos opcionales por ítem:

```json
{
  "proveedorId": 5,
  "proveedor": "Laboratorio XXX",
  "documento": "FAC-001",
  "items": [
    {
      "productoId": 12,
      "cantidad": 100,
      "precioUnit": 2.50,
      "codigoLote": "L-ABC-2026-003",
      "fechaVencimiento": "2027-06-30",
      "notasLote": "Lote importado Enero 2026"
    }
  ]
}
```

### Reglas del UPSERT de lote

| Condición | Acción |
|---|---|
| `codigoLote` Y `fechaVencimiento` presentes | UPSERT en `bot_lotes` |
| Solo uno de los dos | Se ignora el lote (solo actualiza `nstock`) |
| Ninguno | Sin cambios en `bot_lotes` (comportamiento anterior) |
| Lote ya existe con mismo `(nproducto_id, ccodigo_lote)` | `UPDATE ncantidad += cantidad` |
| Lote no existe | `INSERT` con `ncantidad = ncantidad_inicial = cantidad` |

### Compatibilidad total
El frontend existente (`compras-page.tsx`) no envía `codigoLote` → la ruta funciona exactamente igual que antes. Los lotes son **completamente opcionales** en esta fase.

### Flujo transaccional en compras con lote
```
BEGIN
  INSERT bot_compras (cabecera)
  Para cada ítem:
    INSERT bot_compras_det
    SELECT bot_productos FOR UPDATE        → stock anterior
    UPDATE bot_productos nstock += cantidad
    INSERT bot_kardex (COMPRA)
    IF codigoLote && fechaVencimiento:
      SELECT bot_lotes WHERE (prod, lote) FOR UPDATE
      IF existe: UPDATE ncantidad += cantidad
      IF no existe: INSERT nuevo lote
  INSERT bot_auditoria
COMMIT
```

---

## Compatibilidad: `bot_productos.nstock`

Durante la transición, **ambas fuentes de verdad coexisten**:

| Campo | Fuente | Estado |
|---|---|---|
| `bot_productos.nstock` | Actualizado en ventas, compras, transferencias | **Siempre en sync** |
| `SUM(bot_lotes.ncantidad)` | Solo actualizado si se informa lote en compra | **Parcialmente poblado** |

La consistencia se verifica con `GET /api/v1/lotes/consistencia`.

**Migración completa a FEFO** (fase futura):
1. Poblar lotes históricos para todos los productos
2. Activar descuento por lote en ventas
3. Deprecar `bot_productos.nstock` como fuente primaria

---

## Endpoints disponibles

Todos requieren autenticación.

### `GET /api/v1/lotes`

Lista lotes con filtros opcionales.

| Parámetro | Tipo | Descripción |
|---|---|---|
| `producto_id` | integer | Filtrar por producto |
| `estado` | string | `ACTIVO`, `AGOTADO`, `VENCIDO` |
| `vence_antes` | date | `YYYY-MM-DD` — lotes que vencen antes de esta fecha |
| `vence_despues` | date | `YYYY-MM-DD` — lotes que vencen después de esta fecha |
| `limit` | integer | Máximo resultados (default: 100, max: 500) |

**Ejemplo — lotes próximos a vencer en 30 días:**
```
GET /api/v1/lotes?estado=ACTIVO&vence_antes=2026-05-11
```

**Respuesta:**
```json
{
  "success": true,
  "total": 2,
  "data": [
    {
      "id": 3,
      "productoId": 12,
      "productoNombre": "Paracetamol 500mg",
      "productoCodigo": "MED-001",
      "compraId": 7,
      "codigoLote": "L-ABC-2026-003",
      "fechaVencimiento": "2026-04-30",
      "cantidad": 85,
      "cantidadInicial": 100,
      "estado": "ACTIVO",
      "diasParaVencer": 19,
      "tcreado": "2026-01-15 10:00:00"
    }
  ]
}
```

---

### `GET /api/v1/lotes/fefo/:productoId`

Retorna el lote que debe usarse primero según FEFO (vence primero).

```
GET /api/v1/lotes/fefo/12
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "productoId": 12,
    "productoNombre": "Paracetamol 500mg",
    "productoCodigo": "MED-001",
    "stockActual": 185,
    "loteFefo": {
      "id": 3,
      "codigoLote": "L-ABC-2026-003",
      "fechaVencimiento": "2026-04-30",
      "cantidad": 85,
      "diasParaVencer": 19
    },
    "resumenEstados": {
      "ACTIVO": { "lotes": 2, "unidades": 185 }
    }
  }
}
```

Si no hay lotes activos: `"loteFefo": null`

---

### `GET /api/v1/lotes/consistencia`

Verifica que `bot_productos.nstock` coincide con `SUM(bot_lotes.ncantidad)` activos.

```
GET /api/v1/lotes/consistencia
GET /api/v1/lotes/consistencia?producto_id=12
```

**Respuesta:**
```json
{
  "success": true,
  "resumen": {
    "totalProductos": 45,
    "productosConsistentes": 12,
    "productosInconsistentes": 3,
    "productosSinLotes": 30
  },
  "inconsistencias": [
    {
      "productoId": 12,
      "productoNombre": "Paracetamol 500mg",
      "stockProducto": 185,
      "stockLotes": 100,
      "diferencia": 85,
      "totalLotes": 1,
      "consistente": false
    }
  ],
  "data": [ ... ]
}
```

La **diferencia** es esperada para productos comprados antes de activar lotes — indica stock que aún no tiene lote asignado.

---

## Vista SQL auxiliar

```sql
-- Consulta FEFO por producto (equivale a /lotes/fefo/:id)
SELECT * FROM vw_bot_lotes_fefo WHERE nproducto_id = 12;

-- Ver todos los lotes próximos a vencer (30 días)
SELECT * FROM vw_bot_lotes_fefo
WHERE dias_para_vencer <= 30
ORDER BY dias_para_vencer ASC;
```

---

## Validación: Simulación de escenarios

### Escenario 1: Compra con lote

```bash
POST /api/v1/compras
{
  "proveedor": "Laboratorio ABC",
  "documento": "FAC-2026-001",
  "items": [{
    "productoId": 12,
    "cantidad": 100,
    "precioUnit": 2.50,
    "codigoLote": "L-ABC-2026-003",
    "fechaVencimiento": "2027-06-30"
  }]
}
# → bot_productos.nstock += 100
# → bot_lotes INSERT (ncantidad=100, ncantidad_inicial=100)
# → bot_kardex INSERT (COMPRA, +100)
```

### Escenario 2: Consultar lotes del producto

```bash
GET /api/v1/lotes?producto_id=12&estado=ACTIVO
# → Lista lotes activos ordenados por fecha vencimiento
```

### Escenario 3: Verificar consistencia

```bash
GET /api/v1/lotes/consistencia?producto_id=12
# → { stockProducto: 100, stockLotes: 100, diferencia: 0, consistente: true }
```

### Escenario 4: Compra sin lote (backward compatible)

```bash
POST /api/v1/compras
{
  "proveedor": "Proveedor X",
  "items": [{ "productoId": 5, "cantidad": 20, "precioUnit": 1.0 }]
}
# → bot_productos.nstock += 20 (igual que antes)
# → bot_lotes: SIN cambios
# → bot_kardex INSERT (COMPRA, +20)
```

---

## Limitaciones actuales (Fase Transición)

| Limitación | Estado | Solución futura |
|---|---|---|
| Ventas no descuentan por lote | ⏳ Pendiente (Fase FEFO) | Seleccionar lote FEFO en ventas |
| Transferencias sin lote | ⏳ Pendiente | Igual que ventas |
| Sin anulación de lote en devolución | ⏳ Pendiente | Revertir ncantidad en lote específico |
| Productos existentes sin lotes asignados | ✅ Esperado | Poblar lotes históricos manualmente |
| Sin UI de gestión de lotes | ⏳ Pendiente | Página de gestión de lotes |
