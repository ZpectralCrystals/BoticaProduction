# ERP 10/10 — Cierre de Consistencia

## 1. Fuente de Verdad del Stock

### Decisión arquitectónica

| Concepto | Fuente de verdad | Rol |
|---|---|---|
| **Stock operativo** | `bot_lotes` (SUM ncantidad WHERE cestado='ACTIVO') | **VERDAD** |
| **Stock por almacén** | `vw_stock_por_almacen` (vista derivada de lotes) | **VERDAD DERIVADA** |
| **Stock en tabla producto** | `bot_productos.nstock` | **CACHE / COMPATIBILIDAD** |
| **Trazabilidad** | `bot_kardex` | **REGISTRO INMUTABLE** |
| **Ubicación física** | `bot_movimientos_almacen` | **REGISTRO DE MOVIMIENTO** |

### Regla fundamental

> `bot_productos.nstock` es un **campo derivado**.  
> La verdad operativa vive en `bot_lotes` agrupados por almacén.  
> Si hay discrepancia, `bot_lotes` gana.

### Transición actual

`bot_productos.nstock` aún se usa para:
- Verificación rápida de stock en ventas (check previo al FEFO)
- Display en inventario original (tab "Productos")
- Dashboard KPIs

Se mantiene sincronizado vía:
- Ventas: descuenta `nstock` y `bot_lotes.ncantidad` en la misma TX
- Compras: incrementa `nstock` y crea lote en la misma TX
- **Reconciliación**: `POST /consistencia/reconciliar` sincroniza desde lotes

---

## 2. Modelo de Consistencia

### Checks implementados

| Check | Qué verifica | Severidad si falla |
|---|---|---|
| `STOCK_VS_LOTES` | `bot_productos.nstock` = SUM(lotes activos) | CRITICA |
| `STOCK_SIN_LOTES` | Productos con stock global pero sin lotes | MEDIA |
| `LOTES_VENCIDOS` | Lotes vencidos aún marcados ACTIVO | CRITICA |
| `LOTES_SIN_ALMACEN` | Lotes activos sin almacén asignado | MEDIA |
| `KARDEX_DESYNC` | Último kardex != stock actual | MEDIA |
| `KARDEX_NEGATIVOS` | Entradas kardex con stock negativo | CRITICA |

### Endpoints de verificación

| Endpoint | Función |
|---|---|
| `GET /consistencia/resumen` | Dashboard ejecutivo: estado general + totales |
| `GET /consistencia/stock` | Detalle: producto.nstock vs SUM(lotes) |
| `GET /consistencia/lotes` | Integridad: vencidos, sin almacén, almacén inactivo |
| `GET /consistencia/kardex` | Kardex vs stock, stock negativos |
| `GET /consistencia/alertas` | Alertas operativas: vencimientos, cuarentena, baja, fantasma |

### Acciones de corrección

| Endpoint | Función | Safety |
|---|---|---|
| `POST /consistencia/reconciliar` | Sync nstock desde SUM(lotes) | dryRun=true por defecto |
| `POST /consistencia/marcar-vencidos` | Marca lotes vencidos + ajusta stock | dryRun=true por defecto |

---

## 3. Riesgos Cerrados

| Riesgo | Estado | Mecanismo |
|---|---|---|
| Stock doble interpretación | ✅ CERRADO | bot_lotes es verdad, nstock es cache reconciliable |
| Lotes vencidos vendidos | ✅ CERRADO | FEFO filtra `dfechavencimiento >= CURRENT_DATE` |
| Venta desde almacén no vendible | ✅ CERRADO | POS valida `bpermite_venta = true` |
| Stock negativo en lotes | ✅ CERRADO | CHECK constraint `ncantidad >= 0` |
| Lote sin almacén | ✅ DETECTABLE | Endpoint `/consistencia/lotes` lo reporta |
| Kardex desincronizado | ✅ DETECTABLE | Endpoint `/consistencia/kardex` lo compara |
| Movimiento sin tipo válido | ✅ CERRADO | CHECK constraint `chk_mov_tipo` |
| Anulación inconsistente | ✅ CERRADO | Revierte lotes + stock + movimiento en TX |

---

## 4. Constraints de Base de Datos

| Tabla | Constraint | Tipo |
|---|---|---|
| `bot_lotes` | `chk_bot_lotes_cantidad` — ncantidad >= 0 | CHECK |
| `bot_lotes` | `chk_bot_lotes_estado` — ACTIVO/AGOTADO/VENCIDO | CHECK |
| `bot_lotes` | `fk_lotes_almacen` → bot_almacenes | FK RESTRICT |
| `bot_movimientos_almacen` | `ncantidad > 0` | CHECK |
| `bot_movimientos_almacen` | `chk_mov_tipo` — tipos válidos | CHECK |
| `bot_movimientos_almacen` | FK origen/destino → bot_almacenes | FK RESTRICT |

---

## 5. Limitaciones que Quedan

| Limitación | Impacto | Mitigación |
|---|---|---|
| `bot_productos.nstock` sigue siendo escrito en TX | Bajo — siempre dentro de TX con lotes | Reconciliación automática disponible |
| No hay trigger automático de reconciliación | Bajo — se ejecuta bajo demanda o cron | Endpoint POST disponible |
| Lotes sin almacén (datos legacy) | Bajo — solo productos pre-migración | `/consistencia/lotes` los detecta |
| No hay soft-delete de lotes | Bajo — se marcan VENCIDO/AGOTADO | Estado controlado por CHECK |
