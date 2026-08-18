# 🏥 Botica El Pueblo - Sistema ERP Farmacéutico

**Fecha:** 2026-04-13
**Estado:** Sistema ERP farmacéutico operativo

---

## 📋 Qué es este proyecto

**Botica El Pueblo** es un sistema ERP completo para una farmacia, con gestión de inventario, ventas, compras, pacientes, médicos y más. Nació basado en la lógica de MPERP pero hoy corre con tecnología moderna: **React + Vite en el frontend**, **Fastify + TypeScript en el backend**, y **PostgreSQL** como base de datos.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIO                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React 19 + Vite 8 + Tailwind CSS 4)             │
│  ─────────────────────────────────────────────────────────  │
│  • 27 páginas principales                                    │
│  • Componentes UI estilo shadcn                              │
│  • React Router para navegación                               │
│  • Autenticación: JWT local + Clerk (migración en progreso) │
│  • Puerto: 5173 (desarrollo)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Fastify 5 + TypeScript + PostgreSQL)              │
│  ─────────────────────────────────────────────────────────  │
│  • 29 rutas de API REST                                      │
│  • JWT para autenticación                                    │
│  • Drizzle ORM instalado (migración gradual desde SQL raw)  │
│  • Validación con Zod                                        │
│  • Documentación Swagger en /documentation                   │
│  • Puerto: 3000                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  BASE DE DATOS (PostgreSQL 15)                              │
│  ─────────────────────────────────────────────────────────  │
│  • Tablas: bot_productos, bot_usuarios, bot_ventas, etc.   │
│  • Soporte para múltiples almacenes y locales               │
│  • Auditoría de cambios en bot_auditoria                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Cómo iniciar el sistema

### Método rápido (recomendado):

```bash
./start.sh
```

Esto hace TODO automáticamente:
1. Verifica que PostgreSQL esté corriendo (o lo inicia)
2. Crea la base de datos si no existe
3. Aplica migraciones
4. Instala dependencias si faltan
5. Inicia Backend Fastify en `http://127.0.0.1:3000`
6. Inicia Frontend Vite en `http://localhost:5173`

### Acceso:
- **Frontend:** http://localhost:5173
- **Backend API:** http://127.0.0.1:3000/api/v1
- **Swagger:** http://127.0.0.1:3000/documentation
- **Super usuario:** DNI `00000000` / Clave `12345678`

---

## 📁 Estructura de carpetas

```
BoticaElPueblo/
├── frontend/                    # App React/Vite
│   ├── src/
│   │   ├── pages/               # 27 páginas (ventas, inventario, etc)
│   │   ├── components/          # Componentes reutilizables
│   │   ├── app/                 # Router y guards de acceso
│   │   ├── context/             # AuthContext, AppDataContext
│   │   └── lib/                 # API client, utilidades
│   └── package.json
│
├── backend-fastify/             # API principal (Fastify/TS)
│   ├── src/
│   │   ├── routes/              # 29 archivos de rutas REST
│   │   ├── plugins/             # db, auth, swagger, drizzle
│   │   ├── db/                  # Drizzle ORM schema
│   │   └── __tests__/           # Tests con Vitest
│   └── package.json
│
├── docs/                        # Documentación completa
│   ├── architecture/            # Decisiones técnicas
│   ├── guides/                  # Guías de módulos
│   ├── migrations/              # SQL schemas
│   ├── operations/              # Checklists
│   └── reports/                 # Auditorías
│
├── ops/migrations/              # Migraciones SQL versionadas
├── scripts/                     # Scripts de utilidad
└── start.sh                     # Script de inicio principal
```

---

## 🧩 Módulos del Sistema

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Vista general con métricas y alertas |
| **Inventario** | Gestión de productos, stock, lotes, kardex |
| **Ventas** | Punto de venta (POS), recetas, historial |
| **Caja** | Apertura/cierre de caja, movimientos |
| **Compras** | Órdenes de compra, recepción de mercadería |
| **Proveedores** | Gestión de proveedores y órdenes |
| **Pacientes** | Historia clínica, prescripciones |
| **Médicos** | Catálogo de médicos tratantes |
| **Transferencias** | Movimiento de stock entre almacenes |
| **Alquileres** | Gestión de alquileres de equipos |
| **Deudores** | Control de créditos y pagos pendientes |
| **Inventario Var** | Productos varios (no farmacéuticos) |
| **Auditoría** | Registro de cambios en el sistema |
| **Usuarios** | Gestión de usuarios y permisos |
| **Almacenes** | Configuración de múltiples almacenes |
| **Locales** | Configuración de sucursales |
| **Reportes** | Reportes de ventas, inventario, etc. |

---

## 🔐 Autenticación

### Estado actual:
- **JWT local** (implementado y funcional)
- **Clerk** (instalado, integración en progreso)

### Flujo JWT:
```
1. Usuario ingresa DNI + Clave en /login
2. POST /api/v1/auth/login valida contra bot_usuarios
3. Backend genera JWT + cookie "botica_token"
4. Frontend redirige a /panel
5. Cada request incluye el token automáticamente
6. Backend verifica JWT en cada endpoint protegido
```

### Migración a Clerk (en progreso):
- Clerk está instalado en el frontend (`@clerk/clerk-react`)
- Endpoints para vincular Clerk ↔ ERP: `/api/v1/usuarios/:id/clerk-link`
- Tabla `bot_usuarios` tiene campo `cclerk_user_id`
- Plan: mantener JWT local mientras se migra gradualmente a Clerk

---

## 💾 Base de Datos

### Tablas principales:
- `bot_productos` - Catálogo de productos
- `bot_usuarios` - Usuarios del sistema (DNI, clave, rol, permisos)
- `bot_ventas` / `bot_venta_detalle` - Ventas
- `bot_compras` / `bot_compra_detalle` - Compras
- `bot_almacenes` / `bot_locales` - Almacenes y sucursales
- `bot_lotes` - Control de lotes y vencimientos
- `bot_kardex` - Movimientos de inventario
- `bot_auditoria` - Registro de cambios
- `bot_proveedores` - Proveedores
- `bot_pacientes` / `bot_historias` / `bot_prescripciones` - Módulo clínico

### Múltiples Almacenes:
El sistema soporta múltiples almacenes y locales. Cada producto tiene stock por almacén, y se pueden hacer transferencias entre almacenes.

---

## 🔧 Variables de Entorno

```bash
# Base de datos
BOTICA_DB_HOST=localhost
BOTICA_DB_PORT=5432
BOTICA_DB_NAME=botica_db
BOTICA_DB_USER=postgres
BOTICA_DB_PASS=tu_password

# Puertos
BOTICA_BACKEND_PORT=8081      # PHP legacy (deshabilitado)
BOTICA_FASTIFY_PORT=3000      # Backend Fastify
BOTICA_FRONTEND_PORT=5173     # Frontend Vite

# Otros
BOTICA_CORS_ORIGIN=http://localhost:5173
BOTICA_PG_BIN=/opt/homebrew/opt/postgresql@15/bin
BOTICA_ENABLE_PHP_LEGACY=0    # 0 = deshabilitado, 1 = habilitado
```

---

## 🧪 Testing

### Backend:
```bash
cd backend-fastify
npm test                    # Ejecutar todos los tests
npm run test:watch          # Modo watch
npm run test:coverage       # Con cobertura
```

### Frontend:
```bash
cd frontend
npm test                    # Ejecutar tests con Vitest
npm run test:coverage       # Con cobertura
```

---

## 📚 Documentación importante

| Archivo | Descripción |
|---------|-------------|
| `docs/README.md` | Documentación general |
| `docs/REFACTORIZACION_STACK.md` | Estado actual y roadmap técnico |
| `docs/CLERK_VINCULACION_ERP_IMPLEMENTADA.md` | Integración Clerk |
| `docs/guides/clinical_guia.md` | Guía del módulo clínico |
| `docs/guides/kardex_guia.md` | Guía del módulo kardex |
| `docs/operations/` | Checklists de operación |
| `docs/reports/STATUS_VERCEL_CONFIG_20260818.md` | Estado despliegue Vercel + pendientes backend |
| `docs/reports/STATUS_DB_PRODUCTIVA_SUPABASE_20260818_FASE_9_PRECORTE.md` | Precorte Supabase |

---

## 🎯 Estado del Proyecto

### ✅ Completado:
- [x] 27 páginas de frontend funcionales
- [x] 29 rutas de backend API
- [x] Autenticación JWT con cookies
- [x] Múltiples almacenes y transferencias
- [x] Módulo clínico (pacientes, prescripciones)
- [x] Módulo de caja (apertura/cierre)
- [x] Reportes básicos
- [x] Auditoría de cambios
- [x] Drizzle ORM instalado
- [x] Integración Clerk (parcial)
- [x] Rebranding UI local aplicado sobre versión duplicada
- [x] Menú lateral colapsable/expandible
- [x] Inventario con stock, lotes, vencimientos, FEFO y kardex
- [x] Compras reales con actualización de inventario
- [x] Ventas con descuento de stock y registro kardex
- [x] Anulación de ventas con reversa de stock y caja
- [x] Base local auditada antes de migración cloud
- [x] Supabase staging migrado y validado
- [x] Seguridad DB backend-only sin grants públicos a `anon`/`authenticated`
- [x] Backup Supabase post-migración generado
- [x] Frontend preparado para Vercel
- [x] Backend Fastify adaptado a Vercel Functions bajo `/api/*`
- [x] Repo producción publicado en GitHub

### 🚧 En progreso:
- [ ] Cargar variables Supabase/JWT en Vercel
- [ ] Validar despliegue serverless Fastify en producción
- [ ] Rotar contraseña Supabase y actualizar variables del backend
- [ ] Cambiar credenciales demo/admin antes de entregar producción
- [ ] Generar `JWT_SECRET` productivo y guardarlo solo en variables Vercel
- [ ] Ejecutar smoke test contra API pública
- [ ] Migración completa a Drizzle ORM (desde SQL raw)
- [ ] Integración completa de Clerk
- [ ] Optimización de formularios (usar FormData)

### 🔜 Siguientes mejoras:
- [ ] Backups automáticos diarios de Supabase
- [ ] Monitoreo de healthcheck backend
- [ ] Logs centralizados de errores API
- [ ] Dashboard con métricas reales de ventas, stock crítico y vencimientos
- [ ] Pruebas E2E de flujos críticos: compra, venta, caja, anulación, inventario
- [ ] Manual de usuario versionado junto al sistema
- [ ] Política de roles/permisos revisada por perfil real de botica
- [ ] Validación externa SUNAT para proveedores/clientes
- [ ] Optimización de bundle frontend con code splitting

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19, Vite 8, TypeScript 6, Tailwind CSS 4 |
| Backend | Fastify 5, TypeScript, Node.js 20+ |
| Base de datos | PostgreSQL 17 / Supabase |
| ORM | Drizzle ORM (migración en progreso) |
| Auth | JWT local + Clerk (migrando) |
| Testing | Vitest |
| Docs | Swagger/OpenAPI |

---

## 📞 Comandos útiles

```bash
# Iniciar todo
./start.sh

# Solo frontend
cd frontend && npm run dev

# Solo backend
cd backend-fastify && npm run dev

# Build producción
cd frontend && npm run build
cd backend-fastify && npm run build

# Ver logs
tail -f /tmp/botica_fastify.log
tail -f /tmp/botica_frontend.log
```

---

**Última actualización:** 13 de abril de 2026
**Versión del sistema:** Funcional y operativo para producción
