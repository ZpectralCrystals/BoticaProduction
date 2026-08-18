# Arquitectura: Multi-Local y Multi-Almacén
**Fecha:** 12 Abril 2026

---

## 1. Modelo de datos

### bot_locales
Representa una sede física (botica, clínica, etc.)

| Columna | Tipo | Descripción |
|---|---|---|
| `nid` | SERIAL PK | ID |
| `cnombre` | VARCHAR(120) | Nombre del local |
| `ccodigo` | VARCHAR(20) UNIQUE | Código corto |
| `ctipo_local` | VARCHAR(20) | `BOTICA`, `CLINICA`, `OTRO` |
| `cdireccion` | VARCHAR(250) | Dirección física |
| `ctelefono` | VARCHAR(30) | Teléfono |
| `cestado` | CHAR(1) | `A`/`I` |

### bot_almacenes
Almacén lógico dentro de un local, con políticas sanitarias explícitas.

| Columna | Tipo | Descripción |
|---|---|---|
| `nid` | SERIAL PK | ID |
| `nlocal_id` | INT FK → bot_locales | Local al que pertenece |
| `cnombre` | VARCHAR(120) | Nombre descriptivo |
| `ccodigo` | VARCHAR(30) UNIQUE | Código corto |
| `ctipo_almacen` | VARCHAR(30) | Tipo (ver tabla abajo) |
| `bpermite_venta` | BOOLEAN | Si los lotes de este almacén pueden venderse |
| `bpermite_consumo_clinico` | BOOLEAN | Si pueden usarse en procedimientos clínicos |
| `brequiere_revision` | BOOLEAN | Si los productos necesitan revisión antes de usar |
| `cestado` | CHAR(1) | `A`/`I` |

### Tipos de almacén

| Tipo | Permite venta | Permite clínico | Requiere revisión | Descripción |
|---|---|---|---|---|
| `DISPONIBLE` | ✅ | — | — | Stock vigente, listo para venta |
| `CUARENTENA` | ❌ | ❌ | ✅ | Productos en espera de revisión |
| `DEVOLUCION_CLIENTE` | ❌ | ❌ | ✅ | Devoluciones de clientes |
| `DEVOLUCION_PROVEEDOR` | ❌ | ❌ | — | Stock a devolver al proveedor |
| `BAJA` | ❌ | ❌ | — | Vencidos, rechazados, destruidos |
| `PROCEDIMIENTOS` | — | ✅ | — | Insumos para procedimientos clínicos |
| `CONTROL_ESPECIAL` | configurable | configurable | configurable | Medicamentos controlados |

### bot_lotes (extendida)
Se añadió `nalmacen_id` FK → `bot_almacenes`.

Cada lote pertenece a un almacén concreto. Los lotes existentes fueron asignados al almacén por defecto "Botica – Disponible".

### bot_movimientos_almacen
Registra todo movimiento de stock entre almacenes.

| Columna | Tipo | Descripción |
|---|---|---|
| `nid` | SERIAL PK | ID |
| `nproducto_id` | INT FK | Producto |
| `nlote_id` | INT FK nullable | Lote (si aplica) |
| `nalmacen_origen_id` | INT FK nullable | Origen (null = ingreso externo) |
| `nalmacen_destino_id` | INT FK nullable | Destino (null = salida) |
| `ctipo_movimiento` | VARCHAR(30) | COMPRA, VENTA, TRASLADO, etc. |
| `ncantidad` | INT > 0 | Cantidad movida |
| `cdetalle` | TEXT | Detalle libre |
| `nusuario_id` | INT | Quién lo hizo |
| `tcreado` | TIMESTAMP | Cuándo |

### bot_kardex (extendida)
Se añadió `nalmacen_id` FK → `bot_almacenes` para trazabilidad.

### Vista: vw_stock_por_almacen
Stock real por producto + almacén + local, calculado desde `bot_lotes`.

---

## 2. Reglas de negocio

### FEFO solo sobre stock vendible
- El endpoint `/lotes/disponibles/:productoId` ahora acepta:
  - `?soloVendible=true` → solo lotes en almacenes con `bpermite_venta = TRUE`
  - `?soloClinico=true` → solo lotes en almacenes con `bpermite_consumo_clinico = TRUE`
  - `?almacenId=X` → lotes de un almacén específico
- El POS de ventas botica debería usar `soloVendible=true`
- El consumo clínico debería usar `soloClinico=true`

### Compras → almacén destino
- El formulario de compras permite seleccionar almacén destino
- Si no se selecciona, se usa el primer almacén DISPONIBLE
- Los lotes creados llevan `nalmacen_id`
- Se registra movimiento en `bot_movimientos_almacen` tipo COMPRA

### Ventas (preparado)
- La estructura permite que ventas seleccionen almacén origen
- FEFO debe filtrar por almacén vendible
- No implementado aún el selector en POS (fase siguiente)

### Traslados entre almacenes
- La tabla `bot_movimientos_almacen` soporta tipo TRASLADO
- Backend para traslados: fase siguiente

### Productos que no deben mezclarse
- Devoluciones → almacén DEVOLUCION_CLIENTE o DEVOLUCION_PROVEEDOR
- Vencidos/rechazados → almacén BAJA
- Cuarentena → almacén CUARENTENA (requiere revisión)
- Disponible → solo almacenes con `bpermite_venta = TRUE`

---

## 3. Relación con ventas y FEFO

```
                    ┌─────────────┐
                    │ bot_locales  │
                    └──────┬──────┘
                           │ 1:N
                    ┌──────┴──────┐
                    │bot_almacenes│ (políticas)
                    └──────┬──────┘
                           │ 1:N
                    ┌──────┴──────┐
                    │  bot_lotes  │ (nalmacen_id)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐  ┌───┴───┐  ┌────┴────┐
         │  FEFO   │  │Kardex │  │Movimien.│
         │(filtro) │  │(traza)│  │(registro│
         └─────────┘  └───────┘  └─────────┘
```

---

## 4. Semilla inicial

### Locales
| Código | Nombre | Tipo |
|---|---|---|
| LOC-BOTICA | Botica El Pueblo | BOTICA |
| LOC-CLINICA | Clínica El Pueblo | CLINICA |

### Almacenes
| Código | Nombre | Tipo | Venta | Clínico |
|---|---|---|---|---|
| ALM-BOT-DISP | Botica – Disponible | DISPONIBLE | ✅ | — |
| ALM-BOT-CUAR | Botica – Cuarentena | CUARENTENA | — | — |
| ALM-BOT-DEVC | Botica – Devoluciones Cliente | DEVOLUCION_CLIENTE | — | — |
| ALM-BOT-DEVP | Botica – Devolución Proveedor | DEVOLUCION_PROVEEDOR | — | — |
| ALM-BOT-BAJA | Botica – Baja / Vencidos | BAJA | — | — |
| ALM-CLI-PROC | Clínica – Procedimientos | PROCEDIMIENTOS | — | ✅ |
| ALM-CLI-DISP | Clínica – Disponible | DISPONIBLE | ✅ | — |
