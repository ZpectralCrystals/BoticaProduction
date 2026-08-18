# CONSOLIDACIÓN FINAL — Botica El Pueblo
> Fecha: 2026-04-11  
> Build frontend: **✅ 0 errores** (`tsc --noEmit`)  
> Build backend: **✅ 0 errores** (`tsc`)

---

## Qué se eliminó

### Backend Fastify

| Archivo | Motivo |
|---|---|
| `src/routes/ventas.routes.ts` | Duplicado Supabase de `sales.routes.ts` — nunca registrado en server.ts |
| `src/routes/inventario.routes.ts` | Duplicado Supabase de `inventory.routes.ts` — nunca registrado en server.ts |
| `src/services/ventas.service.ts` | Solo servía a `ventas.routes.ts` (eliminado) |
| `src/services/inventario.service.ts` | Solo servía a `inventario.routes.ts` (eliminado) |
| `src/plugins/supabase.ts` | Plugin Supabase sin uso en producción |
| `src/types/database.ts` | Tipos generados de Supabase — sin referencia activa |
| `@supabase/supabase-js` (npm) | Desinstalado — 11 paquetes removidos |
| Script `db:types` en `package.json` | Dependía de Supabase CLI |

### Frontend

| Archivo / Directorio | Motivo |
|---|---|
| `src/services/api.ts` | Cliente HTTP alternativo con URL absoluta — solo lo usaba el POS zombie |
| `src/services/` (directorio) | Vacío tras eliminar `api.ts` |
| `src/pos/components/SalesPOS.tsx` | Orquestador POS Supabase — no activo desde ninguna página/ruta |
| `src/pos/components/ProductSearch.tsx` | Buscador POS Supabase — dependía de `useFEFO` y `services/api.ts` |
| `src/pos/hooks/usePOS.ts` | Hook estado POS Supabase — solo lo usaba `SalesPOS.tsx` |
| `src/pos/hooks/useFEFO.ts` | Hook FEFO Supabase — solo lo usaban `SalesPOS.tsx` y `ProductSearch.tsx` |
| `src/pos/hooks/` (directorio) | Vacío tras eliminar ambos hooks |

### Sesión anterior (cleanup previo)

| Archivo | Motivo |
|---|---|
| `backend/` → `_legacy_backend_php/` | Backend PHP completo reemplazado por Fastify |
| `src/hooks/use-local-storage.ts` | Cero referencias |
| `src/lib/clerk.ts` | Clerk nunca activado |
| Constantes mock en `data/types.ts` | 300+ líneas de datos hardcoded sin consumidores |
| `AUDITORIA_*.md` (4 archivos) | Auditorías de sesiones anteriores |

---

## Qué se movió a `_draft/` (NO eliminado)

> Funcionalidad futura sin equivalente activo. Conservar hasta sprint de implementación.

| Archivo | Contenido |
|---|---|
| `backend-fastify/_draft/kardex.routes.ts` | Endpoints de movimientos de stock (kardex) |
| `backend-fastify/_draft/kardex.service.ts` | Servicio Supabase para kardex |
| `backend-fastify/_draft/clinical.routes.ts` | Endpoints clínicos extendidos (historial, recetas) |
| `backend-fastify/_draft/clinical.service.ts` | Servicio Supabase para módulo clínico |

---

## Qué se mantuvo

### Backend Fastify — rutas activas (`src/routes/`)

```
auth.routes.ts          — Login / logout / token
dashboard.routes.ts     — Métricas del panel
inventory.routes.ts     — Productos y lotes
sales.routes.ts         — Ventas (PostgreSQL directo)
patients.routes.ts      — Padrón de pacientes
appointments.routes.ts  — Citas / agenda
caja.routes.ts          — Apertura y cierre de caja
purchases.routes.ts     — Compras / entradas de stock
providers.routes.ts     — Proveedores
doctors.routes.ts       — Médicos
reports.routes.ts       — Reportes
transfers.routes.ts     — Transferencias entre sucursales
rentals.routes.ts       — Alquileres
debtors.routes.ts       — Deudores
services.routes.ts      — Servicios médicos
prescriptions.routes.ts — Recetas
histories.routes.ts     — Historiales
audit.routes.ts         — Auditoría del sistema
users.routes.ts         — Gestión de usuarios
profile.routes.ts       — Perfil de usuario
misc-inventory.routes.ts— Ajustes de inventario
```

### Backend Fastify — plugins activos (`src/plugins/`)

```
db.ts            — Conexión PostgreSQL (pg Pool)
auth.ts          — JWT + requireAuth + buildAuthUser
error-handler.ts — Manejo global de errores
```

### Backend Fastify — schemas

```
src/schemas/index.ts — Zod schemas de contrato API (valor documental)
```

### Frontend POS — módulo limpio (`src/pos/`)

```
components/
  Cart.tsx         — Carrito de venta con resumen IGV
  CheckoutModal.tsx— Modal de confirmación de pago
  PaymentPanel.tsx — Panel de método/monto de pago

utils/
  posUtils.ts      — calcularTotales, calcularUnidadesBase,
                     formatNumber, diasHastaVencimiento, debounce...

types/
  index.ts         — CartItem, MetodoPago, ItemAlerta, Lote, etc.

index.ts           — Barrel limpio (solo exports activos)
```

### Frontend — capas activas

```
src/lib/api.ts          — ÚNICO cliente HTTP (fetch + Bearer token + proxy Vite)
src/lib/utils.ts        — formatCurrency (fuente de verdad única)
src/context/auth-context.tsx
src/context/app-data-context.tsx
src/pages/sales-page.tsx — POS activo en producción
src/app/router.tsx
```

---

## Arquitectura final

```
┌─────────────────────────────────────────────┐
│              FRONTEND (React + Vite)         │
│                                             │
│  pages/ ──────────────────────────────────┐ │
│  sales-page.tsx   (POS activo)            │ │
│  inventory-page.tsx                       │ │
│  ...14 páginas más                        │ │
│                    │                      │ │
│  pos/components/   │   lib/api.ts ────────┼─┼──► /api/v1/*
│  Cart              │   (único cliente)    │ │
│  CheckoutModal     │                      │ │
│  PaymentPanel      │   lib/utils.ts       │ │
│                    │   (formatCurrency)   │ │
└────────────────────┼──────────────────────┘ │
                     │ HTTP (proxy Vite)        
┌────────────────────▼──────────────────────┐
│         BACKEND (Fastify + TypeScript)    │
│                                           │
│  plugins/                                 │
│    db.ts      ──► PostgreSQL Pool         │
│    auth.ts    ──► JWT requireAuth         │
│    error-handler.ts                       │
│                                           │
│  routes/ (21 archivos, todos registrados) │
│    sales.routes.ts ──► bot_ventas         │
│    inventory.routes.ts ──► bot_productos  │
│    ...                                    │
└───────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐
│  PostgreSQL         │
│  (schema_farmacia   │
│   _completo.sql)    │
└─────────────────────┘

_draft/ (fuera del árbol src — no compilado)
  kardex.routes.ts
  kardex.service.ts
  clinical.routes.ts
  clinical.service.ts
```

---

## Riesgos eliminados

| Riesgo | Estado |
|---|---|
| Dos implementaciones del mismo endpoint (ventas/inventario) activas en paralelo | ✅ Eliminado |
| `@supabase/supabase-js` cargado en un backend sin `SUPABASE_URL` (fallo en arranque) | ✅ Eliminado |
| Dos clientes HTTP en frontend con comportamiento CORS diferente | ✅ Eliminado |
| `formatCurrency` con dos implementaciones que podían divergir | ✅ Eliminado (sesión anterior) |
| Componentes POS que enviaban ventas a rutas no registradas (silencioso) | ✅ Eliminado |
| Backend PHP conviviendo con Fastify sin función | ✅ Movido a `_legacy_backend_php/` |

---

## Pendientes recomendados

| Tarea | Prioridad | Descripción |
|---|---|---|
| Eliminar `_legacy_backend_php/` | Media | Una vez confirmado que la BD de producción está correctamente inicializada con `schema_farmacia_completo.sql` |
| Implementar kardex activo | Alta | Registrar `_draft/kardex.routes.ts` en `server.ts` tras migrar de Supabase a `fastify.db` |
| Implementar módulo clínico | Media | Migrar `_draft/clinical.routes.ts` de Supabase a `fastify.db` |
| Eliminar `backend-fastify/src/schemas/index.ts` | Baja | Solo si se confirma que ninguna ruta futura lo necesitará |
| `npm audit fix` backend | Baja | 2 vulnerabilidades (1 high, 1 critical) en dependencias — revisar impacto |

---

## Comandos de validación

```bash
# Frontend — TypeScript
cd frontend && npx tsc --noEmit

# Frontend — build completo
cd frontend && npm run build

# Backend — build
cd backend-fastify && npm run build

# Backend — verificar que no queda Supabase
grep -r "supabase\|@supabase" backend-fastify/src --include="*.ts"
# Resultado esperado: solo el comentario en error-handler.ts

# Frontend — verificar que no queda services/api
grep -r "services/api" frontend/src --include="*.ts" --include="*.tsx"
# Resultado esperado: sin resultados
```
