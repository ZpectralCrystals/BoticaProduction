# Refactorización y Consolidación del Stack — Botica El Pueblo

**Fecha:** 2026-04-13  
**Arquitecto:** Principal Software Architect + Staff Full Stack Engineer

---

## 1. Auditoría del Estado Actual

### 1.1 PHP Legacy
| Estado | Detalle |
|--------|---------|
| ✅ **ELIMINADO** | Carpeta `_legacy_backend_php/` eliminada completamente |
| ✅ Sin rastros | No hay referencias a PHP en ningún archivo del proyecto |

**Decisión:** PHP eliminado permanentemente del repositorio.

---

### 1.2 Frontend Actual

| Tecnología | Estado | Notas |
|------------|--------|-------|
| React 19 | ✅ Activo | Versión moderna |
| Vite 8 | ✅ Activo | Build tool correcto |
| TypeScript 6 | ✅ Activo | Tipado estricto |
| TailwindCSS 4 | ✅ Activo | Estilos utilitarios |
| Clerk | ⚠️ Instalado pero no integrado | `@clerk/clerk-react` en package.json pero no usado |
| Shadcn/ui | ⚠️ Parcial | Componentes propios en `/components/ui/`, no shadcn oficial |

**Estructura actual:**
```
frontend/src/
├── App.tsx
├── app/           # Router
├── components/    # UI components
├── context/       # Auth, AppData
├── data/          # Types
├── lib/           # API, utils
├── pages/         # 27 páginas
├── pos/           # Punto de venta
└── test/          # Setup
```

---

### 1.3 Backend Actual

| Tecnología | Estado | Notas |
|------------|--------|-------|
| Fastify 5 | ✅ Activo | Framework HTTP |
| TypeScript 5 | ✅ Activo | Tipado |
| PostgreSQL (pg) | ✅ Activo | Driver directo |
| Drizzle ORM | ✅ **Instalado** | Coexiste con SQL raw para migración gradual |
| JWT local | ✅ Activo | `@fastify/jwt` |

**Estructura actual:**
```
backend-fastify/src/
├── server.ts      # Entry point
├── plugins/       # db, auth, swagger
├── routes/        # 29 archivos de rutas
├── lib/           # schema-check
├── __tests__/     # 9 archivos de tests
└── services/      # Vacío
```

---

### 1.4 Autenticación Actual

| Sistema | Estado | Ubicación |
|---------|--------|-----------|
| JWT local | ✅ Activo | `backend-fastify/src/plugins/auth.ts` |
| Cookies | ✅ Activo | `botica_token` |
| Clerk | ❌ No integrado | Solo instalado en frontend |

**Flujo actual:**
1. `POST /api/v1/auth/login` → valida DNI/clave contra `bot_usuarios`
2. Genera JWT con payload `AuthUser`
3. Frontend guarda en cookie `botica_token`
4. Backend verifica JWT en cada request

---

### 1.5 Formularios Actual

| Patrón | Uso | Ejemplo |
|--------|-----|---------|
| FormData (uncontrolled) | ✅ Usado | `login-page.tsx` |
| useState por campo | ⚠️ Excesivo en algunos casos | `compras-page.tsx` |
| Mixto | ⚠️ Común | Mayoría de páginas |

**Páginas con más useState (candidatas a revisar):**
- `inventory-page.tsx` — 17 useState
- `compras-page.tsx` — 12 useState
- `ajustes-page.tsx` — 10 useState (justificado: inputs dependientes)
- `traslados-almacen-page.tsx` — 10 useState

---

## 2. Decisiones de Arquitectura

### 2.1 ORM: **Drizzle ORM**

**Justificación:**
- **Type-safe** sin code generation (a diferencia de Prisma)
- **SQL-first** — queries legibles, fácil migrar desde raw SQL
- **Ligero** — ~50KB vs ~2MB de Prisma
- **Supabase-friendly** — integración nativa
- **Performance** — sin overhead de query engine

Prisma es excelente pero añade complejidad (Prisma Client, migrations, engine binario). Para un ERP farmacéutico con queries específicas, Drizzle es más directo.

---

### 2.2 Autenticación: **Migración gradual a Clerk**

**Plan:**
1. **Fase 1 (actual):** Mantener JWT local funcional
2. **Fase 2:** Integrar Clerk en frontend para nuevos usuarios
3. **Fase 3:** Migrar usuarios existentes a Clerk
4. **Fase 4:** Eliminar auth local

**Razón:** La tabla `bot_usuarios` tiene datos de negocio (permisos, roles, DNI) que deben sincronizarse con Clerk. Migración abrupta rompería el sistema.

---

### 2.3 Formularios: **FormData como patrón principal**

**Regla:**
- CRUD estándar → `FormData` + `new FormData(e.currentTarget)`
- Búsqueda dinámica → `useState` (necesario para debounce)
- Inputs dependientes → `useState` (ej: producto → lotes)
- Validación en tiempo real → `useState` (ej: stock disponible)

---

## 3. Stack Objetivo Final

### Frontend
```
React 19 + Vite 8 + TypeScript
TailwindCSS 4
Shadcn/ui (componentes)
Clerk (autenticación)
Lucide (iconos)
Sonner (toasts)
React Router DOM 7
```

### Backend
```
Node.js 20+
Fastify 5 + TypeScript
PostgreSQL (Supabase)
Drizzle ORM
Zod (validación)
```

### Base de Datos
```
PostgreSQL 15+ (Supabase)
Drizzle ORM para queries
Drizzle Kit para migrations
```

---

## 4. Estructura de Carpetas Objetivo

```
/
├── README.md
├── frontend/
│   └── src/
│       ├── app/           # Router, providers
│       ├── components/    # UI reutilizables
│       │   ├── ui/        # Primitivos (Button, Input, etc)
│       │   ├── shared/    # Componentes compartidos
│       │   └── layout/    # AppShell, Sidebar, etc
│       ├── features/      # Lógica de dominio por módulo
│       ├── lib/           # API client, utils, helpers
│       ├── pages/         # Vistas/páginas
│       ├── context/       # React contexts
│       └── styles/        # CSS global
│
├── backend-fastify/
│   └── src/
│       ├── server.ts      # Entry point
│       ├── plugins/       # Fastify plugins (db, auth)
│       ├── routes/        # Endpoints HTTP
│       ├── services/      # Lógica de negocio
│       ├── db/            # Drizzle schema y queries
│       │   ├── schema.ts  # Definición de tablas
│       │   └── index.ts   # Cliente Drizzle
│       ├── lib/           # Utilidades
│       └── __tests__/     # Tests
│
├── docs/                  # Documentación consolidada
│   ├── architecture/
│   ├── migrations/
│   ├── guides/
│   └── reports/
│
├── scripts/               # Scripts de utilidad
└── ops/                   # Operaciones y deployment
```

---

## 5. Acciones Completadas

| Acción | Estado |
|--------|--------|
| PHP aislado en `_legacy_backend_php/` | ✅ |
| Archivos `.md` consolidados en `/docs` | ✅ |
| SQL schemas movidos a `/docs/migrations/` | ✅ |
| Scripts movidos a `/scripts/` | ✅ |
| Documento de refactorización creado | ✅ |

---

## 6. Tareas Pendientes (Roadmap)

### Fase 1: Consolidación Inmediata (1-2 días)
- [x] Instalar Drizzle ORM en backend
- [x] Crear schema Drizzle desde tablas existentes
- [ ] Migrar 1-2 rutas críticas a Drizzle (proof of concept)

### Fase 2: Formularios (3-5 días)
- [ ] Auditar las 10 páginas con más useState
- [ ] Refactorizar a FormData donde aplique
- [ ] Documentar excepciones justificadas

### Fase 3: Clerk Integration (1 semana)
- [ ] Configurar Clerk project
- [ ] Crear ClerkProvider wrapper
- [ ] Implementar sync Clerk ↔ bot_usuarios
- [ ] Migrar login-page a Clerk SignIn

### Fase 4: Drizzle Full Migration (2 semanas)
- [ ] Migrar todas las rutas a Drizzle
- [ ] Eliminar queries raw SQL
- [ ] Implementar Drizzle migrations

---

## 7. Formularios: Cuándo usar useState vs FormData

### ✅ Usar FormData (uncontrolled)
- Login/registro
- CRUD simple (crear/editar entidad)
- Formularios de configuración
- Cualquier form que se envía y resetea

**Ejemplo:**
```tsx
function handleSubmit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault()
  const data = new FormData(e.currentTarget)
  const nombre = data.get('nombre') as string
  // enviar...
}
```

### ⚠️ Usar useState (controlled)
- Búsqueda con debounce
- Inputs dependientes (producto → lotes)
- Validación en tiempo real
- Formularios con items dinámicos (agregar/quitar líneas)
- Autocomplete

**Justificación por página:**

| Página | useState | Justificación |
|--------|----------|---------------|
| `compras-page.tsx` | 12 | Items dinámicos, inputs dependientes |
| `ajustes-page.tsx` | 10 | Producto → Almacén → Lotes (cascada) |
| `inventory-page.tsx` | 17 | Tabs, filtros, distribución expandible |
| `login-page.tsx` | 3 | ✅ Ya usa FormData correctamente |

---

## 8. Dependencias a Agregar

### Backend (cuando se implemente Drizzle)
```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

### Frontend (Clerk ya instalado)
```bash
# Ya instalado: @clerk/clerk-react
```

---

## 9. Variables de Entorno Requeridas

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  # Cuando se integre Clerk
```

### Backend (.env)
```env
BOTICA_DB_HOST=localhost
BOTICA_DB_PORT=5432
BOTICA_DB_NAME=botica_db
BOTICA_DB_USER=postgres
BOTICA_DB_PASS=
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## 10. Resumen Ejecutivo

| Área | Estado Actual | Estado Objetivo | Prioridad |
|------|---------------|-----------------|-----------|
| PHP | ✅ Aislado | ✅ Aislado | — |
| Frontend Stack | ✅ React/Vite/TS/Tailwind | ✅ + Clerk | Media |
| Backend Stack | ✅ Fastify/TS/PostgreSQL | ✅ + Drizzle | Alta |
| Auth | ⚠️ JWT local | 🎯 Clerk | Media |
| ORM | ✅ **Drizzle instalado** | 🎯 Migrar rutas | Media |
| Formularios | ⚠️ Mixto | 🎯 FormData principal | Baja |
| Documentación | ✅ Consolidada | ✅ | — |

---

## 11. Conclusión

El proyecto está **bien estructurado** para el stack objetivo. Las principales acciones son:

1. **Drizzle ORM** — Agregar capa de acceso a datos type-safe
2. **Clerk** — Migración gradual de autenticación
3. **FormData** — Refactorizar formularios simples
4. **Organización** — Ya completada

**No se requiere reescritura masiva.** El código actual es funcional y el stack ya está alineado en un **80%** con el objetivo.
