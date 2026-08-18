# AUDITORÍA BACKEND FINAL — Botica El Pueblo
> Fecha: 2026-04-11  
> Build: **✅ 0 errores** (`npm run build`)  
> Estado: arquitectura consolidada, una sola línea de implementación

---

## 1. Estado actual — qué se eliminó antes de esta auditoría

Las tareas de consolidación ya fueron ejecutadas en sesiones anteriores:

| Eliminado | Motivo |
|---|---|
| `src/routes/ventas.routes.ts` | Duplicado Supabase de `sales.routes.ts` — nunca registrado en `server.ts` |
| `src/routes/inventario.routes.ts` | Duplicado Supabase de `inventory.routes.ts` — nunca registrado en `server.ts` |
| `src/services/ventas.service.ts` | Solo servía a `ventas.routes.ts` (eliminado) |
| `src/services/inventario.service.ts` | Solo servía a `inventario.routes.ts` (eliminado) |
| `src/plugins/supabase.ts` | Plugin Supabase sin uso en producción |
| `src/types/database.ts` | Tipos generados de Supabase, sin referencia activa |
| `@supabase/supabase-js` (npm) | Desinstalado — 11 paquetes removidos |
| Script `db:types` en `package.json` | Dependía de Supabase CLI |

Movido a `_draft/` (fuera del árbol compilado):

| Archivo | Motivo |
|---|---|
| `_draft/kardex.routes.ts` | Funcionalidad futura — sin equivalente activo |
| `_draft/kardex.service.ts` | Acompaña al route de kardex |
| `_draft/clinical.routes.ts` | Módulo clínico extendido — sin equivalente activo |
| `_draft/clinical.service.ts` | Acompaña al route clínico |

---

## 2. Backend real activo — auditoría completa

### 2.1 Estrategia de acceso a datos

**Una sola estrategia: PostgreSQL directo via `pg.Pool`**

```
fastify.db  →  pg.Pool  →  PostgreSQL (botica_db)
```

No hay ORM, no hay Supabase, no hay query builder. Todas las rutas usan:

```typescript
const { rows } = await fastify.db.query<T>('SELECT ...', [params])
```

### 2.2 Plugins registrados en `server.ts`

| Plugin | Función | Dependencias |
|---|---|---|
| `@fastify/cors` | CORS — permite origen `CORS_ORIGIN` o `localhost:5173` | — |
| `@fastify/cookie` | Cookies — para token de sesión `botica_token` | — |
| `@fastify/jwt` | JWT — firma y verificación con `JWT_SECRET` | — |
| `@fastify/swagger` | Spec OpenAPI generada automáticamente | — |
| `@fastify/swagger-ui` | UI en `/documentation` | swagger |
| `plugins/db.ts` | PostgreSQL Pool — decora `fastify.db` | — |
| `plugins/auth.ts` | `requireAuth`, `buildAuthUser` — JWT + permisos | db |

> `error-handler.ts` se registra como hook global sin ser un plugin explícito en la lista.

### 2.3 Rutas registradas — mapa completo de endpoints

Todas las rutas viven bajo el prefijo `/api/v1`.  
Auth: `preHandler: fastify.requireAuth` salvo login/logout/session.

| Prefijo | Archivo | Endpoints | Función |
|---|---|---|---|
| `/auth` | `auth.routes.ts` | `GET /session` `POST /login` `POST /logout` | Autenticación JWT + cookie |
| `/dashboard` | `dashboard.routes.ts` | `GET /` | Métricas, alertas, cashBreakdown |
| `/inventario` | `inventory.routes.ts` | `GET /` `GET /lotes/:id` `GET /buscar` | Productos, lotes FEFO, búsqueda |
| `/inventario-var` | `misc-inventory.routes.ts` | `GET /` `POST /` | Ajustes de stock (variaciones) |
| `/ventas` | `sales.routes.ts` | `GET /` `POST /` `GET /:id` | Registro y listado de ventas |
| `/caja` | `caja.routes.ts` | `GET /estado` `POST /` | Apertura/cierre de caja |
| `/compras` | `purchases.routes.ts` | `GET /` `POST /` | Entradas de stock / órdenes de compra |
| `/pacientes` | `patients.routes.ts` | `GET /` `POST /` | Padrón de pacientes |
| `/historial` | `histories.routes.ts` | `GET /` `GET /:id` | Historial clínico básico |
| `/recetas` | `prescriptions.routes.ts` | `GET /` `POST /` | Recetas médicas |
| `/medicos` | `doctors.routes.ts` | `GET /` `POST /` | Médicos del centro |
| `/citas` | `appointments.routes.ts` | `GET /` `POST /` | Agenda de citas |
| `/servicios` | `services.routes.ts` | `GET /` `POST /` | Servicios médicos / procedimientos |
| `/proveedores` | `providers.routes.ts` | `GET /` `POST /` | Proveedores |
| `/alquileres` | `rentals.routes.ts` | `GET /` `POST /` | Alquileres de consultorios |
| `/deudores` | `debtors.routes.ts` | `GET /` `POST /` | Cuentas por cobrar |
| `/transferencias` | `transfers.routes.ts` | `GET /` `POST /` | Transferencias inter-sucursal |
| `/reportes` | `reports.routes.ts` | `GET /` | Reportes de vencimiento y faltantes |
| `/auditoria` | `audit.routes.ts` | `GET /` | Log de operaciones del sistema |
| `/perfil` | `profile.routes.ts` | `GET /` `PUT /` | Perfil del usuario autenticado |
| `/usuarios` | `users.routes.ts` | `GET /` `POST /` | Gestión de usuarios del sistema |
| `/health` | inline en `server.ts` | `GET /health` | Health check (sin auth) |
| `/internal/auth/verify-password` | inline en `plugins/auth.ts` | `POST /` | Verificación de hash bcrypt (interno) |

**Total: 21 archivos de rutas + 2 endpoints inline = 43 endpoints registrados**

### 2.4 Autenticación — flujo completo

```
Cliente → POST /api/v1/auth/login
       ← JWT firmado en cookie (botica_token) + body

Rutas protegidas → preHandler: fastify.requireAuth
  requireAuth → lee cookie botica_token o header Authorization: Bearer
  → fastify.jwt.verify(token) → payload: AuthUser
  → request.authUser = { id, nombre, rol, dni, super, admin, permisos[] }
```

Tabla usada: `bot_usuarios` (campo `cestado = 'A'`)  
Permisos: `bot_permisos` (por `nusuario_id` y `cseccion`)

### 2.5 Variables de entorno requeridas

| Variable | Descripción | Default |
|---|---|---|
| `BOTICA_DB_HOST` / `DB_HOST` | Host PostgreSQL | `localhost` |
| `BOTICA_DB_PORT` / `DB_PORT` | Puerto PostgreSQL | `5432` |
| `BOTICA_DB_NAME` / `DB_NAME` | Nombre de la BD | `botica_db` |
| `BOTICA_DB_USER` / `DB_USER` | Usuario PostgreSQL | `$USER` |
| `BOTICA_DB_PASS` / `DB_PASS` | Contraseña PostgreSQL | `""` |
| `JWT_SECRET` | Clave de firma JWT | `botica-fastify-local-secret` |
| `CORS_ORIGIN` | Origins permitidos (coma-separados) | `http://localhost:5173` |
| `PORT` | Puerto del servidor | `3000` |
| `HOST` | Host de escucha | `127.0.0.1` |
| `LOG_LEVEL` | Nivel de log Pino | `info` |
| `NODE_ENV` | Entorno (`development` activa pino-pretty) | — |

---

## 3. Estructura final del directorio `src/`

```
backend-fastify/src/
│
├── server.ts                    ← Entry point; registra todos los plugins y rutas
│
├── plugins/
│   ├── db.ts                    ← pg.Pool → fastify.db
│   ├── auth.ts                  ← JWT + requireAuth + buildAuthUser
│   └── error-handler.ts         ← Manejo global de errores HTTP
│
├── routes/                      ← 21 archivos, TODOS registrados en server.ts
│   ├── auth.routes.ts
│   ├── dashboard.routes.ts
│   ├── inventory.routes.ts
│   ├── misc-inventory.routes.ts
│   ├── sales.routes.ts
│   ├── caja.routes.ts
│   ├── purchases.routes.ts
│   ├── patients.routes.ts
│   ├── histories.routes.ts
│   ├── prescriptions.routes.ts
│   ├── doctors.routes.ts
│   ├── appointments.routes.ts
│   ├── services.routes.ts
│   ├── providers.routes.ts
│   ├── rentals.routes.ts
│   ├── debtors.routes.ts
│   ├── transfers.routes.ts
│   ├── reports.routes.ts
│   ├── audit.routes.ts
│   ├── profile.routes.ts
│   └── users.routes.ts
│
└── schemas/
    └── index.ts                 ← Zod schemas (valor documental / contrato API)
```

---

## 4. Carpeta `_draft/` — funcionalidad futura

```
backend-fastify/_draft/
├── kardex.routes.ts     ← Movimientos de stock (kardex) — pendiente migrar a fastify.db
├── kardex.service.ts    ← Service Supabase para kardex
├── clinical.routes.ts   ← Módulo clínico extendido — pendiente migrar a fastify.db
└── clinical.service.ts  ← Service Supabase para clínico
```

**Para activar**: migrar de `supabase.from(...)` a `fastify.db.query(...)` y registrar en `server.ts`.  
**No compilan** con el árbol actual — están fuera de `src/`.

---

## 5. Riesgos eliminados

| Riesgo | Estado |
|---|---|
| Dos rutas distintas para el mismo dominio (ventas, inventario) coexistiendo | ✅ Eliminado |
| Activación accidental de ruta Supabase por registro erróneo en server.ts | ✅ Imposible — archivos eliminados |
| Fallo en arranque si no hay `SUPABASE_URL` en env | ✅ Eliminado |
| `@supabase/supabase-js` (11 paquetes) en node_modules | ✅ Desinstalado |
| Código zombie en `_draft/` compilándose junto al código de producción | ✅ Fuera del árbol `src/` |

---

## 6. Pendientes recomendados

| Tarea | Prioridad | Detalle |
|---|---|---|
| Implementar kardex activo | Alta | Migrar `_draft/kardex.routes.ts` de Supabase a `fastify.db.query()`; registrar en `server.ts` |
| Implementar módulo clínico | Media | Migrar `_draft/clinical.routes.ts` de Supabase a `fastify.db.query()` |
| Eliminar `_legacy_backend_php/` | Media | Confirmar que `schema_farmacia_completo.sql` cubre todos los datos semilla y eliminar la carpeta |
| `npm audit fix` | Baja | 2 vulnerabilidades (1 high, 1 critical) en dependencias transitivas — revisar impacto |
| Eliminar `src/schemas/index.ts` | Baja | Zod schemas sin uso en rutas activas — valor solo documental; eliminar si no se va a activar validación Zod |
