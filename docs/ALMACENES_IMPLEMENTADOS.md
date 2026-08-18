# Almacenes y Locales — Implementación
**Fecha:** 12 Abril 2026

---

## Tablas creadas

| Tabla | Acción |
|---|---|
| `bot_locales` | **Nueva** — sedes físicas |
| `bot_almacenes` | **Nueva** — almacenes lógicos con políticas |
| `bot_movimientos_almacen` | **Nueva** — registro de movimientos |
| `bot_lotes` | **Alterada** — añadido `nalmacen_id` FK |
| `bot_kardex` | **Alterada** — añadido `nalmacen_id` FK |
| `vw_stock_por_almacen` | **Nueva vista** — stock por producto/almacén/local |

**Migración:** `ops/migrations/010_locales_almacenes.sql` (idempotente)

---

## Endpoints nuevos

### Locales — `/api/v1/locales`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listar locales activos con count de almacenes |
| POST | `/` | Crear o editar local (con validación tipo, código único) |

### Almacenes — `/api/v1/almacenes`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Listar almacenes (filtro: `?localId=`, `?tipo=`) |
| POST | `/` | Crear o editar almacén (validación tipo, local FK, código único) |
| GET | `/stock` | Stock por producto/almacén (filtro: `?localId=`, `?almacenId=`, `?soloVendible=true`) |

### Modificaciones a endpoints existentes

| Endpoint | Cambio |
|---|---|
| `POST /compras` | Acepta `almacenId` opcional. Default: primer almacén DISPONIBLE. Lotes se crean con `nalmacen_id`. Se registra `bot_movimientos_almacen`. |
| `GET /lotes/disponibles/:id` | Acepta `?soloVendible=true`, `?soloClinico=true`, `?almacenId=X`. JOIN con `bot_almacenes` para filtrar por políticas. |
| Kardex (INSERT) | Ahora incluye `nalmacen_id` en compras. |

---

## Frontend: páginas creadas

### `/panel/locales` — LocalesPage
- Listado de locales con tipo (badge), count almacenes, dirección
- Formulario crear/editar con select de tipo (BOTICA, CLINICA, OTRO)
- Código obligatorio y único

### `/panel/almacenes` — AlmacenesPage
- Listado con filtro por local
- Muestra políticas como badges: Venta, Clínico, Revisión
- Muestra lotes activos y stock total por almacén
- Formulario crear/editar:
  - Select de local (catálogo)
  - Select de tipo almacén (catálogo, no texto libre)
  - Checkboxes explícitos: permite venta, consumo clínico, requiere revisión

### Compras — ComprasPage
- Nuevo selector "Almacén destino" en el formulario de compra
- Default: "Por defecto (Disponible)"
- Se envía `almacenId` al backend

### Navegación
- Sidebar: items "Locales" y "Almacenes" con iconos
- Secciones registradas en `app-sections.ts`
- Rutas registradas en `router.tsx`

---

## Archivos modificados

### Backend
- `src/server.ts` — import + register locales y almacenes routes
- `src/routes/locales.routes.ts` — **nuevo**
- `src/routes/almacenes.routes.ts` — **nuevo**
- `src/routes/purchases.routes.ts` — almacenId, movimiento, kardex con almacén
- `src/routes/lotes.routes.ts` — filtro FEFO por almacén/políticas
- `src/__tests__/purchases.test.ts` — mock actualizado

### Frontend
- `src/lib/api.ts` — tipos ApiLocal, ApiAlmacen + funciones
- `src/lib/app-sections.ts` — secciones locales, almacenes
- `src/app/router.tsx` — rutas /panel/locales, /panel/almacenes
- `src/components/layout/app-shell.tsx` — nav items + pageMeta
- `src/pages/locales-page.tsx` — **nuevo**
- `src/pages/almacenes-page.tsx` — **nuevo**
- `src/pages/compras-page.tsx` — selector almacén destino

### Base de datos
- `ops/migrations/010_locales_almacenes.sql` — todo el DDL

---

## Validación

| Escenario | Estado |
|---|---|
| Backend TS compila sin errores | ✅ |
| Frontend TS compila sin errores | ✅ |
| 35 tests backend pasan | ✅ |
| 47 tests frontend pasan | ✅ |
| Locales seed (Botica + Clínica) | ✅ |
| 7 almacenes seed con políticas correctas | ✅ |
| Lotes existentes asignados a ALM-BOT-DISP | ✅ |
| FEFO filtra por almacén vendible | ✅ |
| Compras registran almacén destino | ✅ |
| Movimientos almacén registrados en compras | ✅ |

---

## Limitaciones actuales

1. **Ventas POS** no seleccionan almacén origen todavía — usan todos los lotes. Fase siguiente: filtrar FEFO con `soloVendible=true`.
2. **Traslados** entre almacenes: tabla lista, endpoint pendiente.
3. **Stock consolidado** (`bot_productos.nstock`) sigue siendo global. Fase siguiente: deprecar a favor de la vista `vw_stock_por_almacen`.
4. **Consumo clínico** de insumos por procedimiento: tabla `bot_servicio_insumos` pendiente.
5. **Anulación de ventas** no revierte movimiento de almacén todavía.

---

## Pasos siguientes recomendados

1. **POS multi-almacén** — filtrar FEFO por almacén vendible del local activo
2. **Endpoint traslados** — `POST /almacenes/traslado` con validación de origen/destino
3. **Deprecar `bot_productos.nstock`** — usar suma de lotes por almacén
4. **Consumo clínico** — `bot_servicio_insumos` + descuento de stock desde almacén clínico
5. **Reportes por almacén** — stock valorizado, rotación, vencimientos por almacén
6. **Auditoría de movimientos** — vista de todos los movimientos entre almacenes
