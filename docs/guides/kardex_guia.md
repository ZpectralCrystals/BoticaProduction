# Módulo Kardex - Guía de Implementación

## 1. Visión General

El **Kardex** es el sistema de control de inventario que registra **todos los movimientos** de entrada, salida y ajustes de productos. Proporciona trazabilidad completa desde la compra hasta la venta.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DEL KARDEX                                 │
└─────────────────────────────────────────────────────────────────────────┘

   PROVEEDOR                    ALMACÉN                    CLIENTE
       │                           │                           │
       │    COMPRA (ENTRADA)       │                           │
       ├──────────────────────────►│                           │
       │                           │◄──────────────────────────┤
       │                           │      VENTA (SALIDA)       │
       │                           │                           │
       │    DEVOLUCIÓN             │                           │
       │◄──────────────────────────┤                           │
       │                           │                           │
       │                           │◄──────────────────────────┤
       │                           │    DEVOLUCIÓN CLIENTE     │
       │                           │        (ENTRADA)          │
       │                           │                           │
       │                           │    AJUSTE / MERMA         │
       │                           │    (Por inventario físico)│
       │                           │                           │
```

## 2. Estructura de Tablas

### 2.1 `tipos_movimiento` - Catálogo

| Código | Nombre | Entrada | Salida | Requiere Motivo |
|--------|--------|---------|--------|-----------------|
| `ENTRADA` | Entrada por compra | ✓ | ✗ | ✗ |
| `SALIDA` | Salida por venta | ✗ | ✓ | ✗ |
| `AJUSTE_POSITIVO` | Ajuste manual (+) | ✓ | ✗ | ✓ |
| `AJUSTE_NEGATIVO` | Ajuste manual (-) | ✗ | ✓ | ✓ |
| `DEVOLUCION_CLI` | Devolución cliente | ✓ | ✗ | ✓ |
| `DEVOLUCION_PROV` | Devolución proveedor | ✗ | ✓ | ✓ |
| `TRANSFERENCIA_E` | Transferencia entrada | ✓ | ✗ | ✗ |
| `TRANSFERENCIA_S` | Transferencia salida | ✗ | ✓ | ✗ |
| `MERMA` | Merma/Pérdida | ✗ | ✓ | ✓ |
| `INVENTARIO_INI` | Inventario inicial | ✓ | ✗ | ✗ |

### 2.2 `kardex` - Registro de Movimientos

#### Campos Principales

```sql
CREATE TABLE kardex (
    -- Identificación
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ NOT NULL,          -- Fecha del movimiento
    fecha_sistema TIMESTAMPTZ,           -- Fecha real de registro (auditoría)
    
    -- Tipo y documento
    tipo_movimiento_id INTEGER,          -- FK a tipos_movimiento
    documento_tipo VARCHAR(50),          -- 'VENTA', 'COMPRA', 'AJUSTE'
    documento_id INTEGER,                  -- ID interno del documento
    documento_numero VARCHAR(50),        -- Número legible (VTA-2024-001)
    
    -- Referencias
    producto_id INTEGER,
    lote_id INTEGER,
    sucursal_id INTEGER,
    
    -- Cantidades (Triple registro para auditoría)
    cantidad INTEGER,                    -- + Entrada, - Salida
    cantidad_anterior INTEGER,           -- Stock ANTES
    cantidad_nueva INTEGER,              -- Stock DESPUÉS
    
    -- Valores económicos
    costo_unitario DECIMAL(12,4),
    costo_total DECIMAL(12,4),
    precio_venta_unitario DECIMAL(12,4),
    precio_venta_total DECIMAL(12,4),
    utilidad DECIMAL(12,4),              -- Ganancia/pérdida
    margen_porcentaje DECIMAL(5,2),      -- % de margen
    
    -- Auditoría
    usuario_id UUID,
    usuario_nombre VARCHAR(100),         -- Cache del nombre
    observaciones TEXT,
    motivo_ajuste TEXT                   -- Justificación si aplica
);
```

## 3. Flujos de Movimiento

### 3.1 Entrada por Compra

```
┌──────────────────────────────────────────────────────────────┐
│ PASO 1: Proveedor entrega mercadería                          │
│ PASO 2: Se registra la compra en tabla 'compras'              │
│ PASO 3: Se crea el lote en tabla 'lotes'                      │
│ PASO 4: TRIGGER automático inserta en KARDEX:               │
│         - tipo: ENTRADA                                       │
│         - cantidad: +N (positivo)                             │
│         - cantidad_anterior: 0                              │
│         - cantidad_nueva: N                                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Salida por Venta

```
┌──────────────────────────────────────────────────────────────┐
│ PASO 1: Cliente compra producto                               │
│ PASO 2: Sistema aplica FEFO y selecciona lote               │
│ PASO 3: Se registra venta en 'ventas' y 'ventas_detalle'      │
│ PASO 4: TRIGGER automático:                                 │
│         a) Inserta en KARDEX (SALIDA)                       │
│            - cantidad: -N (negativo)                        │
│            - cantidad_anterior: stock actual                │
│            - cantidad_nueva: stock - N                      │
│         b) Actualiza stock del lote                         │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Ajuste Manual (Auditoría)

```
┌──────────────────────────────────────────────────────────────┐
│ CASO: Inventario físico vs sistema no coinciden               │
│                                                               │
│ Acción: Llamar función registrar_movimiento_kardex()        │
│                                                               │
│ Parámetros:                                                   │
│   - tipo: AJUSTE_POSITIVO o AJUSTE_NEGATIVO                  │
│   - cantidad: diferencia encontrada                          │
│   - motivo: "Diferencia en conteo físico - [explicación]"    │
│   - usuario: quien realiza el ajuste                         │
└──────────────────────────────────────────────────────────────┘
```

## 4. Consultas SQL Comunes

### 4.1 Stock Actual de un Producto

```sql
SELECT 
    producto_codigo,
    producto_nombre,
    sucursal_nombre,
    stock_total_unidades,
    stock_disponible,
    costo_promedio_ponderado,
    valor_inventario,
    numero_lotes_activos,
    fecha_vencimiento_proxima
FROM vista_stock_actual
WHERE producto_id = 1;
```

**Resultado:**
```
┌─────────────┬──────────────┬──────────────┬──────────┬──────────┬─────────┬──────────┬────────┬─────────────┐
│ codigo      │ nombre       │ sucursal     │ stock    │ disp     │ costo   │ valor    │ lotes  │ vencimiento │
├─────────────┼──────────────┼──────────────┼──────────┼──────────┼─────────┼──────────┼────────┼─────────────┤
│ MED-001     │ Paracetamol  │ Principal    │ 500      │ 480      │ 2.50    │ 1250.00  │ 3      │ 2024-12-15  │
└─────────────┴──────────────┴──────────────┴──────────┴──────────┴─────────┴──────────┴────────┴─────────────┘
```

### 4.2 Historial Kardex de un Producto

```sql
SELECT * FROM get_kardex_producto(
    p_producto_id := 1,
    p_sucursal_id := 1,
    p_fecha_desde := '2024-01-01',
    p_fecha_hasta := '2024-01-31'
);
```

**Resultado:**
```
┌────┬─────────────────────┬────────────┬──────────────┬────────────┬──────────┬──────────┬──────────┬──────────────┐
│ id │ fecha               │ tipo       │ documento    │ lote       │ cantidad │ anterior │ nueva    │ usuario      │
├────┼─────────────────────┼────────────┼──────────────┼────────────┼──────────┼──────────┼──────────┼──────────────┤
│ 10 │ 2024-01-20 14:30:00 │ Salida     │ VTA-2024001  │ LOTE-A123  │ -10      │ 100      │ 90       │ Juan Pérez   │
│  9 │ 2024-01-20 11:15:00 │ Salida     │ VTA-2024002  │ LOTE-A123  │ -5       │ 105      │ 100      │ Juan Pérez   │
│  8 │ 2024-01-18 09:00:00 │ Entrada    │ COM-2024001  │ LOTE-A123  │ 100      │ 5        │ 105      │ María López  │
│  7 │ 2024-01-15 16:45:00 │ Ajuste -   │ AJU-2024001  │ LOTE-B456  │ -3       │ 50       │ 47       │ Admin        │
└────┴─────────────────────┴────────────┴──────────────┴────────────┴──────────┴──────────┴──────────┴──────────────┘
```

### 4.3 Trazabilidad de un Lote

```sql
SELECT 
    fecha,
    tipo_movimiento,
    documento_numero,
    cantidad,
    cantidad_anterior,
    cantidad_nueva,
    usuario_nombre,
    observaciones
FROM kardex k
JOIN tipos_movimiento tm ON tm.id = k.tipo_movimiento_id
WHERE lote_id = 1
ORDER BY fecha;
```

### 4.4 Ventas con Margen de Utilidad

```sql
SELECT 
    producto_codigo,
    producto_nombre,
    SUM(ABS(cantidad)) AS total_vendido,
    SUM(utilidad) AS utilidad_total,
    AVG(margen_porcentaje) AS margen_promedio,
    SUM(costo_total) AS costo_total,
    SUM(precio_venta_total) AS venta_total
FROM vista_kardex_utilidad
WHERE tipo_movimiento = 'Salida por venta'
  AND fecha::DATE BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY producto_codigo, producto_nombre
ORDER BY total_vendido DESC
LIMIT 10;
```

### 4.5 Ajustes Recientes (Auditoría)

```sql
SELECT 
    fecha,
    usuario_nombre,
    producto_codigo,
    producto_nombre,
    tipo_movimiento,
    cantidad,
    cantidad_anterior,
    cantidad_nueva,
    motivo_ajuste
FROM kardex k
JOIN productos p ON p.id = k.producto_id
JOIN tipos_movimiento tm ON tm.id = k.tipo_movimiento_id
WHERE tm.codigo IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'MERMA')
  AND fecha::DATE >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY fecha DESC;
```

## 5. API Backend (Fastify)

### 5.1 Endpoints Proyectados

```typescript
// GET /api/v1/kardex/producto/:productoId
// Query params: sucursal_id, desde, hasta
{
  "success": true,
  "data": [
    {
      "id": 10,
      "fecha": "2024-01-20T14:30:00Z",
      "tipo": "SALIDA",
      "documento_numero": "VTA-2024001",
      "lote_numero": "LOTE-A123",
      "cantidad": -10,
      "cantidad_anterior": 100,
      "cantidad_nueva": 90,
      "costo_unitario": 2.50,
      "precio_venta": 5.00,
      "utilidad": 25.00,
      "usuario": "Juan Pérez"
    }
  ]
}

// GET /api/v1/kardex/stock-actual
// Query params: sucursal_id
{
  "success": true,
  "data": [
    {
      "producto_id": 1,
      "producto_codigo": "MED-001",
      "producto_nombre": "Paracetamol 500mg",
      "stock_total": 500,
      "stock_disponible": 480,
      "costo_promedio": 2.50,
      "valor_inventario": 1250.00
    }
  ]
}

// POST /api/v1/kardex/ajuste
// Body:
{
  "producto_id": 1,
  "lote_id": 1,
  "sucursal_id": 1,
  "tipo_ajuste": "AJUSTE_NEGATIVO", // o AJUSTE_POSITIVO
  "cantidad": 5,
  "motivo": "Diferencia en inventario físico",
  "observaciones": "Producto dañado encontrado durante conteo"
}
```

### 5.2 Servicio TypeScript

```typescript
// src/services/kardex.service.ts

export class KardexService {
  constructor(private supabase: SupabaseClient) {}

  async getHistorialProducto(
    productoId: number,
    sucursalId?: number,
    desde?: Date,
    hasta?: Date
  ): Promise<KardexEntry[]> {
    const { data, error } = await this.supabase
      .rpc('get_kardex_producto', {
        p_producto_id: productoId,
        p_sucursal_id: sucursalId,
        p_fecha_desde: desde,
        p_fecha_hasta: hasta
      });
    
    if (error) throw error;
    return data;
  }

  async getStockActual(sucursalId?: number): Promise<StockActual[]> {
    let query = this.supabase
      .from('vista_stock_actual')
      .select('*');
    
    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async registrarAjuste(
    ajuste: AjusteKardexInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('registrar_movimiento_kardex', {
        p_tipo_movimiento_codigo: ajuste.tipoAjuste,
        p_producto_id: ajuste.productoId,
        p_lote_id: ajuste.loteId,
        p_sucursal_id: ajuste.sucursalId,
        p_cantidad: ajuste.cantidad,
        p_costo_unitario: ajuste.costoUnitario,
        p_precio_venta: 0,
        p_documento_tipo: 'AJUSTE',
        p_documento_numero: `AJU-${Date.now()}`,
        p_usuario_id: usuarioId,
        p_usuario_nombre: usuarioNombre,
        p_motivo: ajuste.motivo
      });
    
    if (error) throw error;
    return data; // kardex_id
  }
}
```

## 6. Reportes y Dashboards

### 6.1 KPIs Sugeridos

| Métrica | Descripción | Consulta |
|---------|-------------|----------|
| **Rotación** | Productos más vendidos | Top 10 por cantidad negativa |
| **Margen** | Productos más rentables | Top 10 por utilidad |
| **Merma** | Pérdidas por vencimiento/daño | Sumar MERMA del mes |
| **Ajustes** | Diferencias inventario | Count AJUSTE_* |
| **Stock crítico** | Productos con bajo stock | stock < mínimo |

### 6.2 Dashboard Cards

```sql
-- Movimientos del día
SELECT * FROM vista_movimientos_hoy;

-- Productos sin rotación (30 días)
SELECT p.codigo, p.nombre_generico
FROM productos p
LEFT JOIN kardex k ON k.producto_id = p.id 
  AND k.fecha >= CURRENT_DATE - INTERVAL '30 days'
  AND k.tipo_movimiento_id = (SELECT id FROM tipos_movimiento WHERE codigo = 'SALIDA')
WHERE k.id IS NULL
  AND p.estado = TRUE;

-- Valor total del inventario
SELECT 
  SUM(valor_inventario) as valor_total,
  SUM(CASE WHEN dias_para_vencer <= 30 THEN valor_inventario END) as valor_vencimiento_proximo
FROM vista_stock_actual;
```

## 7. Buenas Prácticas

### 7.1 Reglas de Oro

1. **Nunca modificar registros** - El Kardex es inmutable (solo lectura)
2. **Siempre documentar ajustes** - Motivo obligatorio para AJUSTE y MERMA
3. **Reconciliar periódicamente** - Inventario físico vs sistema (semanal/mensual)
4. **Auditar cambios** - Todos los movimientos llevan usuario y timestamp

### 7.2 Control de Acceso

| Rol | Permisos |
|-----|----------|
| **Cajero** | Ver stock, registrar ventas (automático) |
| **Farmacéutico** | Ver historial, registrar ajustes |
| **Almacenero** | Registrar entradas, transferencias |
| **Gerente** | Ver reportes, autorizar ajustes mayores |
| **Admin** | Todo + ver auditoría completa |

### 7.3 Procedimiento de Ajuste

```
1. Físico: Realizar conteo físico del producto
2. Sistema: Consultar stock actual en vista_stock_actual
3. Diferencia: Calcular diferencia (físico - sistema)
4. Documentar: Crear registro con motivo detallado
5. Autorizar: Si diferencia > X, requiere aprobación gerente
6. Ejecutar: Llamar a registrar_movimiento_kardex()
```

## 8. Migración de Datos

### 8.1 Carga Inicial de Inventario

```sql
-- Para cada producto con stock inicial
INSERT INTO lotes (...)
VALUES (...);

-- Luego registrar en Kardex
INSERT INTO kardex (
    fecha,
    tipo_movimiento_id,
    documento_tipo,
    documento_numero,
    producto_id,
    lote_id,
    sucursal_id,
    cantidad,
    cantidad_anterior,
    cantidad_nueva,
    costo_unitario,
    costo_total,
    usuario_id,
    usuario_nombre,
    observaciones
) VALUES (
    NOW(),
    (SELECT id FROM tipos_movimiento WHERE codigo = 'INVENTARIO_INI'),
    'INVENTARIO_INICIAL',
    'INI-2024-001',
    producto_id,
    lote_id,
    sucursal_id,
    cantidad_inicial,  -- positivo
    0,                 -- anterior
    cantidad_inicial,  -- nueva
    costo_unitario,
    cantidad_inicial * costo_unitario,
    'uuid-admin',
    'Administrador',
    'Carga inicial del sistema'
);
```

---

## 9. Referencias

- **Archivo SQL:** `/backend-fastify/supabase/kardex_module.sql`
- **Vistas:** `vista_stock_actual`, `vista_kardex_utilidad`, `vista_movimientos_hoy`
- **Funciones:** `get_kardex_producto()`, `registrar_movimiento_kardex()`
- **Triggers:** Automáticos en ventas y compras

---

**Versión:** 1.0  
**Fecha:** Abril 2026  
**Sistema:** Botica El Pueblo ERP
