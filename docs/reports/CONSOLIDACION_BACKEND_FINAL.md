# CONSOLIDACIÓN BACKEND FINAL — Botica El Pueblo
> Fecha: 2026-04-11  
> Build: **✅ 0 errores** (`npm run build`)  
> Sin referencias a Supabase en `src/`: **✅ confirmado**

---

## Backend Activo Real

### Estrategia de acceso a datos

Una sola estrategia: **PostgreSQL directo via `pg.Pool`**

```
fastify.db  →  pg.Pool  →  PostgreSQL (botica_db)
```

Sin ORM, sin query builder, sin Supabase.  
Patrón uniforme en todas las rutas:

```typescript
const { rows } = await fastify.db.query<T>('SELECT ...', [params])
```

### Plugins registrados en `server.ts`

| Plugin | Decorador / Hook | Dependencias |
|---|---|---|
| `@fastify/cors` | — | — |
| `@fastify/cookie` | — | — |
| `@fastify/jwt` | `fastify.jwt` | — |
| `@fastify/swagger` | — | — |
| `@fastify/swagger-ui` | `/documentation` | swagger |
| `plugins/db.ts` | `fastify.db` (pg.Pool) | — |
| `plugins/auth.ts` | `fastify.requireAuth`, `fastify.buildAuthUser` | db |
| `plugins/error-handler.ts` | hook `onError` global | — |

### Rutas registradas — endpoints reales bajo `/api/v1`

| Prefijo | Archivo | Métodos | Función |
|---|---|---|---|
| `/auth` | `auth.routes.ts` | `GET /session` `POST /login` `POST /logout` | JWT + cookie |
| `/dashboard` | `dashboard.routes.ts` | `GET /` | Métricas, alertas, cashBreakdown |
| `/inventario` | `inventory.routes.ts` | `GET /` `GET /lotes/:id` `GET /buscar` | Productos, lotes FEFO |
| `/inventario-var` | `misc-inventory.routes.ts` | `GET /` `POST /` | Ajustes / variaciones de stock |
| `/ventas` | `sales.routes.ts` | `GET /` `POST /` `GET /:id` | Registro y listado de ventas |
| `/caja` | `caja.routes.ts` | `GET /estado` `POST /` | Apertura y cierre de caja |
| `/compras` | `purchases.routes.ts` | `GET /` `POST /` | Compras / entradas de stock |
| `/pacientes` | `patients.routes.ts` | `GET /` `POST /` | Padrón de pacientes |
| `/historial` | `histories.routes.ts` | `GET /` `GET /:id` | Historial clínico básico |
| `/recetas` | `prescriptions.routes.ts` | `GET /` `POST /` | Recetas médicas |
| `/medicos` | `doctors.routes.ts` | `GET /` `POST /` | Médicos del centro |
| `/citas` | `appointments.routes.ts` | `GET /` `POST /` | Agenda de citas |
| `/servicios` | `services.routes.ts` | `GET /` `POST /` | Procedimientos / servicios |
| `/proveedores` | `providers.routes.ts` | `GET /` `POST /` | Proveedores |
| `/alquileres` | `rentals.routes.ts` | `GET /` `POST /` | Alquileres de consultorios |
| `/deudores` | `debtors.routes.ts` | `GET /` `POST /` | Cuentas por cobrar |
| `/transferencias` | `transfers.routes.ts` | `GET /` `POST /` | Transferencias inter-sucursal |
| `/reportes` | `reports.routes.ts` | `GET /` | Vencimientos y faltantes |
| `/auditoria` | `audit.routes.ts` | `GET /` | Log de operaciones |
| `/perfil` | `profile.routes.ts` | `GET /` `PUT /` | Perfil del usuario autenticado |
| `/usuarios` | `users.routes.ts` | `GET /` `POST /` | Gestión de usuarios |
| `/health` | inline `server.ts` | `GET /health` | Health check (sin auth) |
| `/internal/auth/verify-password` | inline `auth.ts` | `POST /` | Verificación bcrypt interna |

**Total: 21 archivos de rutas + 2 endpoints inline**

---

## Archivos eliminados

| Archivo | Motivo |
|---|---|
| `src/routes/ventas.routes.ts` | Duplicado Supabase de `sales.routes.ts` — nunca registrado |
| `src/routes/inventario.routes.ts` | Duplicado Supabase de `inventory.routes.ts` — nunca registrado |
| `src/services/ventas.service.ts` | Solo servía a `ventas.routes.ts` |
| `src/services/inventario.service.ts` | Solo servía a `inventario.routes.ts` |
| `src/plugins/supabase.ts` | Plugin Supabase sin uso en producción |
| `src/types/database.ts` | Tipos generados de Supabase — sin referencia activa |

> El directorio `src/services/` quedó vacío y fue eliminado.  
> El directorio `src/schemas/` quedó vacío y fue eliminado tras mover su contenido.

---

## Archivos movidos a `_draft/`

> Fuera del árbol compilado — no afectan el build. Para activarlos, migrar de Supabase a `fastify.db` y registrar en `server.ts`.

| Archivo en `_draft/` | Contenido |
|---|---|
| `kardex.routes.ts` | Endpoints de movimientos de stock (kardex) |
| `kardex.service.ts` | Servicio Supabase para kardex |
| `clinical.routes.ts` | Endpoints clínicos extendidos (historial, recetas ampliadas) |
| `clinical.service.ts` | Servicio Supabase para módulo clínico |
| `schemas.index.ts` | Zod schemas de contrato API (productoSchema, ventaCreateSchema, etc.) |

---

## Dependencias removidas

| Paquete | Paquetes transitivos | Método |
|---|---|---|
| `@supabase/supabase-js` | 11 paquetes eliminados | `npm uninstall @supabase/supabase-js` |

Script `db:types` eliminado de `package.json` (dependía de Supabase CLI).  
Descripción actualizada: `"Fastify + PostgreSQL"`.

---

## Arquitectura final

```
backend-fastify/
│
├── src/                          ← Único árbol compilado
│   ├── server.ts                 ← Entry point: registra plugins y 21 rutas
│   │
│   ├── plugins/
│   │   ├── db.ts                 ← pg.Pool → fastify.db
│   │   ├── auth.ts               ← JWT + requireAuth + buildAuthUser + bcrypt
│   │   └── error-handler.ts      ← Manejo global onError
│   │
│   └── routes/                   ← 21 archivos, TODOS en server.ts
│       ├── auth.routes.ts
│       ├── dashboard.routes.ts
│       ├── inventory.routes.ts
│       ├── misc-inventory.routes.ts
│       ├── sales.routes.ts
│       ├── caja.routes.ts
│       ├── purchases.routes.ts
│       ├── patients.routes.ts
│       ├── histories.routes.ts
│       ├── prescriptions.routes.ts
│       ├── doctors.routes.ts
│       ├── appointments.routes.ts
│       ├── services.routes.ts
│       ├── providers.routes.ts
│       ├── rentals.routes.ts
│       ├── debtors.routes.ts
│       ├── transfers.routes.ts
│       ├── reports.routes.ts
│       ├── audit.routes.ts
│       ├── profile.routes.ts
│       └── users.routes.ts
│
├── _draft/                       ← Fuera de src/ — no compila
│   ├── kardex.routes.ts
│   ├── kardex.service.ts
│   ├── clinical.routes.ts
│   ├── clinical.service.ts
│   └── schemas.index.ts
│
├── dist/                         ← Output tsc
├── package.json                  ← Sin @supabase/supabase-js
└── tsconfig.json
```

### Notas sobre la estructura

- No hay directorio `services/` activo — las rutas implementan la lógica directamente con `fastify.db.query()`. Es correcto para la escala actual.
- No hay directorio `shared/` ni `types/` activo — los tipos se definen inline en cada ruta o en `plugins/auth.ts` (`AuthUser`).
- Si el proyecto crece, el siguiente paso natural es extraer helpers SQL a un directorio `src/services/` real (PostgreSQL, no Supabase).

---

## Riesgos eliminados

| Riesgo | Estado |
|---|---|
| Dos implementaciones del mismo dominio (ventas, inventario) coexistiendo en `src/` | ✅ Eliminado |
| Activación accidental de ruta Supabase por registro erróneo en `server.ts` | ✅ Imposible — archivos fuera de `src/` |
| Fallo en arranque por `SUPABASE_URL` ausente | ✅ Eliminado |
| `@supabase/supabase-js` (11 paquetes) en `node_modules` | ✅ Desinstalado |
| Schemas Zod sin uso compilando junto al código de producción | ✅ Movido a `_draft/` |
| Confusión sobre cuál ruta es la "real" para ventas e inventario | ✅ Eliminado — hay exactamente una |

---

## Riesgos pendientes

| Riesgo | Prioridad | Acción recomendada |
|---|---|---|
| Kardex sin implementación activa | Alta | Migrar `_draft/kardex.routes.ts` de Supabase a `fastify.db.query()` y registrar en `server.ts` |
| Módulo clínico extendido sin implementación activa | Media | Migrar `_draft/clinical.routes.ts` de Supabase a `fastify.db.query()` |
| `_legacy_backend_php/` en raíz del proyecto | Media | Eliminar con `rm -rf _legacy_backend_php/` cuando BD de producción esté confirmada |
| 2 vulnerabilidades en dependencias transitivas | Baja | `npm audit` para ver detalles; `npm audit fix` si no hay breaking changes |
| Lógica de negocio inline en rutas (sin capa service) | Baja | Extraer a `src/services/` cuando las rutas superen ~150 líneas o se reutilice lógica |

---

## Variables de entorno requeridas

| Variable | Default | Descripción |
|---|---|---|
| `BOTICA_DB_HOST` / `DB_HOST` | `localhost` | Host PostgreSQL |
| `BOTICA_DB_PORT` / `DB_PORT` | `5432` | Puerto PostgreSQL |
| `BOTICA_DB_NAME` / `DB_NAME` | `botica_db` | Nombre de la BD |
| `BOTICA_DB_USER` / `DB_USER` | `$USER` | Usuario PostgreSQL |
| `BOTICA_DB_PASS` / `DB_PASS` | `""` | Contraseña PostgreSQL |
| `JWT_SECRET` | `botica-fastify-local-secret` | Clave de firma JWT |
| `CORS_ORIGIN` | `http://localhost:5173` | Origins permitidos (coma-separados) |
| `PORT` | `3000` | Puerto del servidor |
| `HOST` | `127.0.0.1` | Host de escucha |
| `LOG_LEVEL` | `info` | Nivel de log Pino |
| `NODE_ENV` | — | `development` activa pino-pretty |

---

## Comandos de validación

```bash
# Build TypeScript
cd backend-fastify && npm run build
# → 0 errores ✅

# Confirmar cero referencias Supabase en src/
grep -r "supabase\|@supabase" backend-fastify/src --include="*.ts"
# → sin resultados ✅

# Confirmar que no hay schemas en src/
ls backend-fastify/src/schemas 2>/dev/null || echo "no existe"
# → no existe ✅

# Arrancar servidor
cd backend-fastify && npm run dev
# → GET http://localhost:3000/health → { status: "ok", runtime: "fastify" }
# → GET http://localhost:3000/documentation → Swagger UI
```
