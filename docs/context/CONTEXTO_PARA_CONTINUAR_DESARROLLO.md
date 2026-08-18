# Contexto para continuar desarrollo

Fecha de auditoria: 2026-05-07
Workspace auditado: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo`

Este documento resume el estado real del proyecto segun archivos existentes, scripts, rutas, migraciones y comandos ejecutados. No se documentan endpoints, tablas ni funcionalidades no encontradas.

## 1. Resumen ejecutivo del proyecto

Botica El Pueblo es un sistema web para gestion operativa de una botica/farmacia con modulos de login, usuarios, productos, inventario, lotes, proveedores, clientes/pacientes, compras, ventas, caja, reportes, locales, almacenes, traslados, devoluciones, auditoria y consistencia de stock.

El problema que resuelve es centralizar venta de productos/servicios, control de stock por lotes y almacen, compras con creacion de lotes, caja diaria, gestion de usuarios/permisos y trazabilidad por kardex/auditoria.

Stack real activo:

- Frontend: React 19 + Vite 8 + TypeScript + React Router 7 + Tailwind CSS 4 + Clerk opcional.
- Backend activo: Fastify 5 + TypeScript + PostgreSQL + Drizzle ORM parcial + SQL crudo con `pg`.
- Base de datos: PostgreSQL local, tablas principales con prefijo `bot_`.
- Legacy/dudoso: documentos y SQL antiguos con Supabase/PHP, carpeta `_draft` con codigo Supabase no registrado, referencia PHP en `start.sh` pero sin carpeta `/backend`.

Estado para continuar:

- Build frontend: pasa.
- Tests frontend: pasan con warnings.
- Build backend: pasa.
- Tests backend: pasan.
- Lint frontend: falla por 10 errores existentes.
- Lint backend: falla porque ESLint 9 no encuentra `eslint.config.*`.
- Funcionalmente hay mucho implementado, pero con riesgos concretos: mismatch de endpoint de ajustes, migracion Clerk no aplicada en DB local, README/backend docs desactualizados, scripts SQL de arranque con rutas dudosas y mezcla de codigo legacy.

Estimacion practica: el proyecto esta en fase avanzada de prototipo funcional. No esta listo aun como Fase 01 cerrada sin corregir bloqueadores de validacion, contratos API y migraciones.

## 2. Estado actual real del proyecto

### Frontend

- Framework usado: React.
- Version detectada: `react` `^19.2.4` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/package.json`.
- Lenguaje: TypeScript.
- Bundler: Vite 8.
- UI: Tailwind CSS 4, componentes propios en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/components/ui`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- Sistema de rutas: `react-router-dom` con rutas en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/app/router.tsx`.
- Manejo de sesion: contexto local JWT en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/context/auth-context.tsx`; token en `localStorage` con clave `botica_fastify_token`.
- Clerk: proveedor opcional en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/clerk-provider.tsx` y puente en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/context/auth-bridge.tsx`.
- Servicios/API client: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Base API actual: `/api/v1` relativo en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Proxy Vite: `/api/v1` a `http://127.0.0.1:3000`; `/api` a `http://127.0.0.1:8081` legacy PHP en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/vite.config.ts`.
- Paginas principales: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages`.
- Componentes reutilizables: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/components`.
- POS modular: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pos`.
- Completo: estructura de rutas, layout protegido, login local, paginas principales, API client amplio, POS con tests.
- Incompleto: lint falla, contratos no totalmente alineados con backend, algunas respuestas/request pendientes por confirmar, Clerk depende de columna/migracion no presente en DB local auditada.
- Legacy: proxy `/api` a backend PHP en Vite, pero carpeta `/backend` no encontrada.

### Backend

- Framework usado: Fastify.
- Version detectada: `fastify` `^5.0.0` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/package.json`.
- Lenguaje: TypeScript.
- Entrada principal: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`.
- Estructura de rutas: archivos `*.routes.ts` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes`.
- Controladores: no hay capa formal separada detectada; la logica vive principalmente dentro de rutas Fastify.
- Servicios: carpeta `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/services` existe pero no aparece como capa activa principal; `_draft/services` contiene codigo Supabase legacy/dudoso.
- Repositorios: no se detecta carpeta/capa repository activa.
- Middlewares/plugins: auth, db, drizzle, error-handler en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins`.
- Autenticacion: JWT local con cookie `botica_token` o bearer token. Clerk sync opcional.
- Validaciones: Zod en rutas y plugin de manejo de errores.
- Acceso a DB: `pg.Pool` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/db.ts`; Drizzle parcial en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/drizzle.ts`; SQL crudo extendido en rutas.
- Tests: Vitest en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/**/*.test.ts`.
- Completo: servidor Fastify registra API amplia, build y tests pasan.
- Incompleto: lint backend roto por configuracion ESLint 9 faltante; varias rutas concentran logica critica; algunas migraciones requeridas no parecen aplicadas en DB local.
- Legacy: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/_draft`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/supabase`, README backend antiguo.

### Base de datos

- Motor usado: PostgreSQL.
- Base local usada por scripts: `botica_db` en `localhost:5432`.
- Config DB backend: variables `BOTICA_DB_*` o `DB_*` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/db.ts`.
- Migraciones activas detectadas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/ops/migrations`.
- Migraciones legacy/dudosas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/docs/migrations`.
- Seeds: no se encontro carpeta `seed` formal; el sistema muestra super usuario inicial en salida de `start.sh`, pendiente por confirmar fuente exacta del dato.
- Tablas principales auditadas en DB local: `bot_usuarios`, `bot_permisos`, `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_ventas`, `bot_ventas_det`, `bot_caja`, `bot_compras`, `bot_compras_det`, `bot_proveedores`, `bot_pacientes`, `bot_medicos`, `bot_servicios`, `bot_recetas`, `bot_recetas_det`, `bot_historial`, `bot_locales`, `bot_almacenes`, `bot_movimientos_almacen`, `bot_transferencias`, `bot_transferencias_det`, `bot_alquileres`, `bot_deudores`, `bot_auditoria`, `bot_citas`, `bot_inventario_var`.
- Vistas detectadas: `vw_bot_lotes_fefo`, `vw_stock_por_almacen`.
- Tablas legacy/dudosas detectadas: `kardex`, `tipos_movimiento`.
- Inconsistencia critica: codigo usa `bot_usuarios.cclerk_user_id`, pero esa columna no aparecio en la DB local auditada. Existe migracion `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/ops/migrations/014_usuarios_clerk_link.sql`.

## 3. Estructura real de carpetas

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend`
  - Proposito: aplicacion web principal.
  - Estado: activa.
  - Archivos importantes: `package.json`, `vite.config.ts`, `src/app/router.tsx`, `src/context/auth-context.tsx`, `src/lib/api.ts`, `src/pages`, `src/components`, `src/pos`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify`
  - Proposito: API REST principal en Fastify.
  - Estado: activa con subcarpetas legacy/dudosas.
  - Archivos importantes: `package.json`, `src/server.ts`, `src/routes`, `src/plugins`, `src/db/schema.ts`, `.env.example`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes`
  - Proposito: definicion real de endpoints API.
  - Estado: activa.
  - Archivos importantes: `auth.routes.ts`, `inventory.routes.ts`, `sales.routes.ts`, `purchases.routes.ts`, `caja.routes.ts`, `users.routes.ts`, `lotes.routes.ts`, `almacenes.routes.ts`, `traslados-almacen.routes.ts`, `consistencia.routes.ts`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins`
  - Proposito: plugins Fastify para DB, auth, Drizzle y errores.
  - Estado: activa.
  - Archivos importantes: `auth.ts`, `db.ts`, `drizzle.ts`, `error-handler.ts`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/db`
  - Proposito: schema Drizzle parcial.
  - Estado: activo parcial.
  - Archivos importantes: `schema.ts`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/_draft`
  - Proposito: borradores Supabase/servicios/rutas no registrados en `server.ts`.
  - Estado: legacy/dudoso.
  - Archivos importantes: `_draft/routes`, `_draft/services`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/supabase`
  - Proposito: SQL/RPC Supabase antiguo o auxiliar.
  - Estado: legacy/dudoso.
  - Archivos importantes: archivos `.sql`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/ops/migrations`
  - Proposito: migraciones PostgreSQL actuales.
  - Estado: activa.
  - Archivos importantes: `002_nstock_constraint.sql` a `014_usuarios_clerk_link.sql`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/docs`
  - Proposito: documentacion historica y migraciones/documentos de contexto.
  - Estado: parcial/legacy mixto.
  - Archivos importantes: `docs/context/contexto_botica.md`, `docs/migrations/schema_farmacia_completo.sql`, `docs/migrations/fix_database.sql`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/scripts`
  - Proposito: scripts operativos.
  - Estado: activo parcial.
  - Archivos importantes: pendiente por confirmar segun uso en `start.sh` y package scripts.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/mcp-server`
  - Proposito: servidor MCP TypeScript con herramientas que consultan/modifican DB.
  - Estado: activo/dudoso por bypass de API.
  - Archivos importantes: `package.json`, `src`, `mcp_config.json`, `run.sh`.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/start.sh`
  - Proposito: arranque local completo PostgreSQL + backend Fastify + frontend Vite.
  - Estado: activo.
  - Observacion: menciona backend PHP deshabilitado y rutas SQL root que requieren confirmacion.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/dist`
  - Proposito: build generado frontend.
  - Estado: generado.
  - Riesgo: no editar manualmente.

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/dist`
  - Proposito: build generado backend.
  - Estado: generado.
  - Riesgo: no editar manualmente.

## 4. Modulos funcionales detectados

### Modulo: Login / autenticacion

- Estado: parcial.
- Frontend:
  - Rutas: `/`, `/auth/clerk`, `/login/clerk`, rutas protegidas bajo `/panel`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/login-page.tsx`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/clerk-auth-page.tsx`.
  - Componentes: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/components/auth`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/components/shared/login-card.tsx`.
  - Servicios: `apiLogin`, `apiLogout`, `apiCheckSession`, `apiClerkSync` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `POST /api/v1/auth/clerk-sync`.
  - Controladores: no separados; `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`.
  - Servicios: `buildAuthUser` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/auth.ts`.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`, `requireAnyPermission` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/auth.ts`.
- Base de datos:
  - Tablas: `bot_usuarios`, `bot_permisos`.
  - Relaciones: `bot_permisos.nusuario_id -> bot_usuarios.nid`.
- Tests:
  - Existentes: tests backend/auth pendientes por confirmar por nombre exacto; suite backend general pasa.
  - Faltantes: cobertura E2E login no encontrada.
- Observaciones: JWT local activo; Clerk opcional.
- Riesgos: columna `bot_usuarios.cclerk_user_id` no aparecio en DB local auditada.
- Que falta para dejarlo funcional: validar/aplicar migracion Clerk o desactivar flujo Clerk si no se usara en Fase 01.

### Modulo: Usuarios

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/usuarios`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/users-page.tsx`.
  - Componentes: componentes UI compartidos.
  - Servicios: funciones de usuarios en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/usuarios`, `POST /api/v1/usuarios`, `GET /api/v1/usuarios/:id/clerk-link`, `POST /api/v1/usuarios/:id/clerk-link`, `DELETE /api/v1/usuarios/:id/clerk-link`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/users.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth` y permiso admin/super interno.
- Base de datos:
  - Tablas: `bot_usuarios`, `bot_permisos`.
  - Relaciones: permisos por usuario.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: permisos/acciones usuarios E2E.
- Observaciones: acciones en POST: crear, actualizar, desactivar, activar, resetClave.
- Riesgos: dependencia de `cclerk_user_id`.
- Que falta para dejarlo funcional: confirmar schema DB y permisos esperados por rol.

### Modulo: Roles y permisos

- Estado: implementado parcialmente.
- Frontend:
  - Rutas: proteccion por seccion en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/app/access-guards.tsx`.
  - Paginas: todas bajo `/panel`.
  - Componentes: `AppShell` filtra navegacion segun permisos en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/layout/app-shell.tsx`.
  - Servicios: permisos via sesion en `auth-context.tsx`.
- Backend:
  - Endpoints: no hay CRUD dedicado de roles encontrado.
  - Controladores: permisos se usan dentro de rutas.
  - Servicios: `hasAnyPermission`, `requireAnyPermission`.
  - Repositorios: no encontrado.
  - Middlewares: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/auth.ts`.
- Base de datos:
  - Tablas: `bot_usuarios`, `bot_permisos`.
  - Relaciones: `bot_permisos.nusuario_id -> bot_usuarios.nid`.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: matriz completa roles/secciones.
- Observaciones: `super` y `admin` tienen bypass; `perfil` permitido siempre en frontend.
- Riesgos: no todos los endpoints tienen permisos granulares; varios solo requieren auth.
- Que falta para dejarlo funcional: definir matriz Fase 01 y asegurar backend por modulo critico.

### Modulo: Productos

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/inventario`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/inventory-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: `apiGetInventario`, `apiCreateProduct`, `apiUpdateProduct`, busquedas en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/inventario`, `POST /api/v1/inventario`, `GET /api/v1/inventario/search`, `GET /api/v1/inventario/distribucion`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/inventory.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`, permisos `inventario` o `almacenes` para POST.
- Base de datos:
  - Tablas: `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_proveedores`.
  - Relaciones: productos con proveedores, lotes y movimientos kardex.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: CRUD producto completo y validaciones.
- Observaciones: creacion usa Drizzle parcial; update usa SQL crudo.
- Riesgos: mezcla Drizzle/SQL; `restock` por inventario devuelve 410 y empuja a compras.
- Que falta para dejarlo funcional: estabilizar contrato create/update y validaciones obligatorias.

### Modulo: Categorias

- Estado: implementado parcialmente.
- Frontend:
  - Rutas: no hay ruta exclusiva encontrada.
  - Paginas: se maneja dentro de inventario.
  - Componentes: formulario/tabla inventario.
  - Servicios: campos categoria via producto.
- Backend:
  - Endpoints: no hay endpoint de categorias dedicado encontrado.
  - Controladores: `inventory.routes.ts`.
  - Servicios: no encontrado.
  - Repositorios: no encontrado.
  - Middlewares: auth inventario.
- Base de datos:
  - Tablas: `bot_productos`.
  - Relaciones: categoria como campo `ccategoria`, no tabla separada detectada.
- Tests:
  - Existentes: no encontrado.
  - Faltantes: catalogo de categorias.
- Observaciones: categoria parece dato libre en producto.
- Riesgos: inconsistencias por texto libre.
- Que falta para dejarlo funcional: decidir si Fase 01 acepta texto libre o requiere tabla/catalogo.

### Modulo: Inventario

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/inventario`, `/panel/inventario-var`, `/panel/consistencia`, `/panel/alertas`.
  - Paginas: `inventory-page.tsx`, `inventory-var-page.tsx`, `consistencia-page.tsx`, `alertas-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: inventario, lotes, ajustes, almacenes, consistencia en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: inventario, lotes, kardex, ajustes, consistencia, almacenes.
  - Controladores: `inventory.routes.ts`, `lotes.routes.ts`, `kardex.routes.ts`, `ajustes.routes.ts`, `consistencia.routes.ts`, `almacenes.routes.ts`.
  - Servicios: no separado activo.
  - Repositorios: no encontrado.
  - Middlewares: requireAuth y permisos variables por ruta.
- Base de datos:
  - Tablas: `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_almacenes`, `bot_movimientos_almacen`.
  - Relaciones: lotes y kardex por producto/almacen.
- Tests:
  - Existentes: suite backend general pasa; tests concretos pendientes por confirmar.
  - Faltantes: escenarios integrados inventario-lotes-kardex.
- Observaciones: stock disponible debe basarse en lotes/almacen; `bot_productos.nstock` mantiene stock agregado.
- Riesgos: endpoint ajustes frontend/backend no coincide.
- Que falta para dejarlo funcional: corregir contrato de ajustes, validar stock agregado vs lotes y definir reglas de reconciliacion.

### Modulo: Lotes

- Estado: parcial.
- Frontend:
  - Rutas: asociado a inventario/compras/ventas.
  - Paginas: no hay pagina exclusiva encontrada.
  - Componentes: formularios de compra/venta usan lotes segun API.
  - Servicios: funciones de lotes en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/lotes`, `GET /api/v1/lotes/disponibles/:productoId`, `GET /api/v1/lotes/fefo/:productoId`, `GET /api/v1/lotes/consistencia`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/lotes.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`.
- Base de datos:
  - Tablas: `bot_lotes`, `bot_productos`, `bot_compras`, `bot_almacenes`.
  - Relaciones: lote pertenece a producto, compra y almacen.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: vencimientos, FEFO, consistencia.
- Observaciones: vista `vw_bot_lotes_fefo` detectada.
- Riesgos: vencimientos/lotes son criticos para farmacia.
- Que falta para dejarlo funcional: validar que ventas y compras siempre mantengan lotes con transacciones.

### Modulo: Proveedores

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/proveedores`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/providers-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: proveedores en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/proveedores`, `POST /api/v1/proveedores`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/providers.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`, permiso `proveedores` en POST.
- Base de datos:
  - Tablas: `bot_proveedores`, `bot_productos`, `bot_compras`.
  - Relaciones: productos/compras referencian proveedor.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: validacion RUC y duplicados.
- Observaciones: indice unico condicional por RUC detectado.
- Riesgos: calidad de datos proveedor.
- Que falta para dejarlo funcional: confirmar formulario, actualizacion/desactivacion y validaciones.

### Modulo: Clientes / pacientes

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/pacientes`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/patients-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: pacientes/clientes en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/pacientes`, `POST /api/v1/pacientes`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/patients.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`.
- Base de datos:
  - Tablas: `bot_pacientes`, `bot_ventas`, `bot_historial`, `bot_recetas`, `bot_citas`.
  - Relaciones: ventas/historial/recetas/citas pueden apuntar a paciente.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: busqueda, duplicados DNI, relacion con ventas.
- Observaciones: ventas aceptan cliente manual y/o paciente.
- Riesgos: dualidad cliente/paciente puede duplicar datos.
- Que falta para dejarlo funcional: definir regla Fase 01 para cliente anonimo vs paciente registrado.

### Modulo: Compras

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/compras`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/purchases-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: compras en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/compras`, `POST /api/v1/compras`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/purchases.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`, permiso `compras` en POST.
- Base de datos:
  - Tablas: `bot_compras`, `bot_compras_det`, `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_proveedores`, `bot_almacenes`.
  - Relaciones: compra con proveedor/almacen/usuario; detalle con productos; lotes por compra.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: compra crea lotes, aumenta stock, kardex y rollback.
- Observaciones: POST valida FACTURA y requiere lote/vencimiento por item.
- Riesgos: modulo critico para ingreso de stock.
- Que falta para dejarlo funcional: pruebas integradas compra-stock-lotes-kardex.

### Modulo: Ventas

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/ventas`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/sales-page.tsx`.
  - Componentes: POS en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pos`.
  - Servicios: ventas en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/ventas`, `POST /api/v1/ventas`, `GET /api/v1/ventas/:id`, `PATCH /api/v1/ventas/:id/anular`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/sales.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`, permiso `ventas` en POST/anular, admin/super para anular.
- Base de datos:
  - Tablas: `bot_ventas`, `bot_ventas_det`, `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_caja`, `bot_pacientes`, `bot_servicios`.
  - Relaciones: venta con usuario/paciente/almacen; detalle con productos/lotes/servicios.
- Tests:
  - Existentes: POS frontend tiene tests; backend sales pendiente por confirmar.
  - Faltantes: E2E venta con stock/lote/caja.
- Observaciones: backend usa transaccion y FEFO con `FOR UPDATE`.
- Riesgos: caja se registra por codigo en venta; confirmar integridad con tabla `bot_caja`.
- Que falta para dejarlo funcional: validar flujo POS completo contra DB real y caja abierta.

### Modulo: Caja

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/caja`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/cash-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: caja en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/caja`, `POST /api/v1/caja`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/caja.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`.
- Base de datos:
  - Tablas: `bot_caja`, `bot_ventas`.
  - Relaciones: ventas guardan campo `ccaja`.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: apertura/cierre/venta afecta caja.
- Observaciones: POST usa acciones `abrir` y `cerrar`.
- Riesgos: asociacion venta-caja por texto/codigo debe confirmarse.
- Que falta para dejarlo funcional: definir regla de venta permitida solo con caja abierta y pruebas.

### Modulo: Reportes

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/reportes`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/reports-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: reportes en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/reportes`.
  - Controladores: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/reports.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth`.
- Base de datos:
  - Tablas: ventas, compras, inventario y caja segun reporte; exacto pendiente por confirmar.
  - Relaciones: pendiente por confirmar.
- Tests:
  - Existentes: no encontrado.
  - Faltantes: reportes por rango y permisos.
- Observaciones: alcance exacto del reporte requiere lectura profunda de `reports.routes.ts`.
- Riesgos: reportes pueden mezclar reglas de negocio no compartidas.
- Que falta para dejarlo funcional: definir reportes Fase 01 y validar contra datos reales.

### Modulo: Configuracion / perfil

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/perfil`, `/panel/dashboard`.
  - Paginas: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/profile-page.tsx`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/dashboard-page.tsx`.
  - Componentes: UI compartidos.
  - Servicios: perfil/dashboard en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Backend:
  - Endpoints: `GET /api/v1/perfil`, `POST /api/v1/perfil`, `GET /api/v1/dashboard`, `GET /api/v1/system/schema-status`.
  - Controladores: `profile.routes.ts`, `dashboard.routes.ts`, `system.routes.ts`.
  - Servicios: no separado.
  - Repositorios: no encontrado.
  - Middlewares: `requireAuth` para perfil/dashboard; system pendiente por confirmar.
- Base de datos:
  - Tablas: `bot_usuarios` y tablas agregadas para dashboard.
  - Relaciones: pendiente por confirmar.
- Tests:
  - Existentes: pendiente por confirmar.
  - Faltantes: actualizacion perfil y dashboard.
- Observaciones: perfil POST soporta `actualizar` y `cambiarClave`.
- Riesgos: validaciones y permisos de datos personales.
- Que falta para dejarlo funcional: confirmar campos editables y validaciones.

### Modulo: Integraciones externas / Clerk

- Estado: implementado parcialmente.
- Frontend:
  - Rutas: `/auth/clerk`, `/login/clerk`.
  - Paginas: `clerk-auth-page.tsx`.
  - Componentes: `ClerkProvider`, `AuthBridge`, botones CTA.
  - Servicios: `apiClerkSync`, usuario link/unlink.
- Backend:
  - Endpoints: `POST /api/v1/auth/clerk-sync`, rutas clerk-link en usuarios.
  - Controladores: `auth.routes.ts`, `users.routes.ts`.
  - Servicios: verificacion JWT Clerk en ruta auth.
  - Repositorios: no encontrado.
  - Middlewares: no como middleware global.
- Base de datos:
  - Tablas: `bot_usuarios`.
  - Relaciones: `cclerk_user_id` esperado por codigo.
- Tests:
  - Existentes: no encontrado.
  - Faltantes: sync y link/unlink.
- Observaciones: requiere `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_JWKS_URL`, `CLERK_JWT_ISSUER`.
- Riesgos: migracion local pendiente; si se usa sin columna fallara.
- Que falta para dejarlo funcional: aplicar/validar `014_usuarios_clerk_link.sql` o retirar Clerk de Fase 01.

### Modulo: Supabase

- Estado: legacy/dudoso.
- Frontend:
  - Rutas: no encontrado uso activo.
  - Paginas: no encontrado uso activo.
  - Componentes: no encontrado uso activo.
  - Servicios: no encontrado uso activo.
- Backend:
  - Endpoints: no registrados en `server.ts`.
  - Controladores: borradores en `_draft`.
  - Servicios: borradores en `_draft/services`.
  - Repositorios: no encontrado.
  - Middlewares: no activo.
- Base de datos:
  - Tablas: SQL en docs/supabase no coincide completamente con modelo `bot_*`.
  - Relaciones: legacy.
- Tests:
  - Existentes: no encontrado.
  - Faltantes: no aplica si legacy.
- Observaciones: README backend aun habla de Supabase.
- Riesgos: confusion tecnica y dependencias no instaladas.
- Que falta para dejarlo funcional: decidir eliminar/archivar o migrar formalmente.

## 5. Flujo actual de autenticacion

Inicio de sesion local:

- Pantalla inicial: `/` en frontend.
- Archivo frontend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/login-page.tsx`.
- Servicio frontend: `apiLogin` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Endpoint backend: `POST /api/v1/auth/login`.
- Archivo backend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`.
- Payload esperado: `{ dni, clave }`.
- Validacion: DNI de 8 digitos y clave requerida.
- DB: busca usuario activo en `bot_usuarios` por `cnrodni`.
- Password: compara con `bcrypt.compare` contra `bot_usuarios.cclave`.
- Respuesta: objeto `user` con datos de usuario/permisos y `token`.
- Persistencia frontend: `localStorage` con clave `botica_fastify_token`.
- Persistencia backend: cookie `botica_token` httpOnly configurada desde login.

Sesion:

- Frontend llama `apiCheckSession` al montar `AuthProvider`.
- Endpoint: `GET /api/v1/auth/session`.
- Backend acepta cookie `botica_token` o header `Authorization: Bearer`.
- Si JWT valido, `buildAuthUser` recarga usuario/permisos desde DB.

Proteccion frontend:

- `RequireAuth` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/app/access-guards.tsx`.
- `RequireSection` valida secciones segun `canAccessSection`.
- `super` y `admin` tienen bypass; `perfil` siempre permitido.

Proteccion backend:

- Plugin auth en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/auth.ts`.
- `requireAuth` exige JWT valido.
- `requireAnyPermission` valida permisos por seccion.
- Varios endpoints solo usan `requireAuth`; no todos tienen permiso granular.

Roles/permisos:

- `bot_usuarios.crol`, `lsuper`, `ladmin`.
- `bot_permisos.cseccion`.
- Backend devuelve permisos en sesion/login.
- Frontend habilita rutas/nav segun permisos.

Clerk:

- Existe proveedor opcional frontend.
- Existe `POST /api/v1/auth/clerk-sync`.
- Backend verifica JWT Clerk contra JWKS.
- Luego busca `bot_usuarios.cclerk_user_id`.
- Riesgo: columna no aparece en DB local auditada; migracion existe en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/ops/migrations/014_usuarios_clerk_link.sql`.
- Conclusion: Clerk convive con JWT local, pero esta implementado parcialmente hasta confirmar migracion y configuracion.

## 6. Flujo actual de ventas

- Pantalla: `/panel/ventas`.
- Pagina: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/sales-page.tsx`.
- POS: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pos`.
- Servicio frontend: ventas/POS en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Endpoint crear venta: `POST /api/v1/ventas`.
- Archivo backend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/sales.routes.ts`.
- Auth: requiere `requireAuth` y permiso `ventas`.
- Payload soportado por backend: `customerMode`, `customer`, `patient`, `clienteNombre`, `documentId`, `paymentMethod` o `metodoPago`, `total`, `cashier`, `area`, `notes` o `observaciones`, `items`, `almacenId`, `customerId` o `patientId`.
- Registro de venta: inserta en `bot_ventas` y `bot_ventas_det`.
- Productos/servicios: detalle puede apuntar a `bot_productos` o `bot_servicios`.
- Descuento inventario: backend usa lotes disponibles por producto/almacen y actualiza `bot_lotes`, `bot_productos.nstock`, `bot_kardex`.
- FEFO/FIFO: hay logica FEFO por fecha de vencimiento en ventas y rutas/vista de lotes FEFO.
- Lotes: se usan `bot_lotes`, `nlote_id`, `clote_codigo`.
- Transacciones: `POST /api/v1/ventas` usa transaccion con cliente `pg` y `FOR UPDATE`.
- Caja: venta guarda `ccaja`; integridad exacta con `bot_caja` pendiente por confirmar.
- Validaciones: items, stock, lotes, anulacion con motivo.
- Anulacion: `PATCH /api/v1/ventas/:id/anular`, requiere permiso `ventas` y admin/super.
- Riesgos: confirmar caja abierta obligatoria, permisos de anulacion, y consistencia entre stock agregado y lotes.

## 7. Flujo actual de inventario

- Creacion de productos: `POST /api/v1/inventario` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/inventory.routes.ts`.
- Frontend: `/panel/inventario`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/inventory-page.tsx`.
- Servicios frontend: `apiGetInventario`, `apiCreateProduct`, `apiUpdateProduct`, busqueda/distribucion en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Lotes: se crean principalmente desde compras; endpoint de inventario `restock` responde 410 indicando usar compras.
- Entrada de stock: `POST /api/v1/compras` crea lote, actualiza stock y kardex.
- Salida de stock: `POST /api/v1/ventas` descuenta lotes/stock y registra kardex.
- Stock disponible: combina `bot_productos.nstock`, `bot_lotes.ncantidad` y vistas/consultas por almacen.
- Endpoints participantes: inventario, compras, ventas, lotes, kardex, ajustes, consistencia, almacenes.
- Tablas participantes: `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_compras`, `bot_compras_det`, `bot_ventas`, `bot_ventas_det`, `bot_almacenes`.
- Logica backend: mayormente en rutas con SQL crudo y transacciones en operaciones criticas.
- Logica frontend: formularios, busqueda, POS y validacion UI.
- Incompleto: mismatch `POST /api/v1/ajustes` vs backend real `POST /api/v1/ajustes/ajustes`; pruebas integradas insuficientes detectadas para flujo completo.

## 8. Flujo actual de compras

- Existe modulo de compras.
- Pantalla: `/panel/compras`.
- Pagina frontend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/purchases-page.tsx`.
- Servicio frontend: compras en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Endpoints: `GET /api/v1/compras`, `POST /api/v1/compras`.
- Backend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/purchases.routes.ts`.
- Auth: `requireAuth`; POST requiere permiso `compras`.
- Registro de compra: inserta cabecera en `bot_compras` y detalle en `bot_compras_det`.
- Inventario: aumenta `bot_productos.nstock`.
- Lotes: crea o actualiza `bot_lotes` por item; requiere codigo de lote y fecha de vencimiento.
- Proveedor: relaciona con `bot_proveedores`.
- Costos: usa `precioUnit` en detalle; actualizacion de costo promedio pendiente por confirmar.
- Kardex: registra movimientos de entrada en `bot_kardex`.
- Transacciones: backend usa transaccion para compra/lote/stock/kardex.
- Riesgo: reglas de comprobante limitadas; FACTURA validada explicitamente.

## 9. Flujo actual de caja

- Existe modulo de caja.
- Pantalla: `/panel/caja`.
- Pagina frontend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/cash-page.tsx`.
- Servicio frontend: caja en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`.
- Endpoints: `GET /api/v1/caja`, `POST /api/v1/caja`.
- Backend: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/caja.routes.ts`.
- Apertura: `POST /api/v1/caja` con action `abrir`.
- Cierre: `POST /api/v1/caja` con action `cerrar`.
- Ventas afectan caja: venta guarda `ccaja`; si actualiza saldos de caja directamente queda pendiente por confirmar.
- Movimientos de caja: tabla especifica de movimientos no detectada; solo `bot_caja`.
- Tablas: `bot_caja`, `bot_ventas`.
- Falta: confirmar bloqueo de ventas sin caja abierta, resumen de pagos y cierre calculado vs contado.

## 10. API actual

Todos los endpoints listados abajo fueron detectados en rutas registradas por `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`.

### Auth

- Metodo: POST
  Ruta: `/api/v1/auth/login`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`
  Requiere auth: no
  Roles/permisos: no aplica
  Request esperado: `{ dni, clave }`
  Response esperado: `{ user, token }`
  Estado: implementado
  Observaciones: setea cookie `botica_token`.

- Metodo: POST
  Ruta: `/api/v1/auth/logout`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`
  Requiere auth: no confirmado
  Roles/permisos: no aplica
  Request esperado: sin body confirmado
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: limpia cookie.

- Metodo: GET
  Ruta: `/api/v1/auth/session`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`
  Requiere auth: token/cookie si existe
  Roles/permisos: no aplica
  Request esperado: cookie o bearer token
  Response esperado: usuario/sesion
  Estado: implementado
  Observaciones: si no hay token devuelve sesion no autenticada.

- Metodo: POST
  Ruta: `/api/v1/auth/clerk-sync`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`
  Requiere auth: bearer token Clerk
  Roles/permisos: usuario linkeado en DB
  Request esperado: Authorization Bearer Clerk JWT
  Response esperado: `{ linked, authSource, user, token }`
  Estado: implementado parcialmente
  Observaciones: depende de `bot_usuarios.cclerk_user_id`.

### Usuarios

- Metodo: GET
  Ruta: `/api/v1/usuarios`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/users.routes.ts`
  Requiere auth: si
  Roles/permisos: admin/super segun ruta
  Request esperado: query pendiente por confirmar
  Response esperado: lista usuarios
  Estado: implementado parcialmente
  Observaciones: permisos internos.

- Metodo: POST
  Ruta: `/api/v1/usuarios`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/users.routes.ts`
  Requiere auth: si
  Roles/permisos: admin/super segun ruta
  Request esperado: action `crear`, `actualizar`, `desactivar`, `activar`, `resetClave`
  Response esperado: `{ ok, id? }`
  Estado: implementado parcialmente
  Observaciones: contrato multiplexado por `action`.

- Metodo: GET
  Ruta: `/api/v1/usuarios/:id/clerk-link`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/users.routes.ts`
  Requiere auth: si
  Roles/permisos: admin/super segun ruta
  Request esperado: path `id`
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: depende de columna Clerk.

- Metodo: POST
  Ruta: `/api/v1/usuarios/:id/clerk-link`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/users.routes.ts`
  Requiere auth: si
  Roles/permisos: admin/super segun ruta
  Request esperado: pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: depende de columna Clerk.

- Metodo: DELETE
  Ruta: `/api/v1/usuarios/:id/clerk-link`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/users.routes.ts`
  Requiere auth: si
  Roles/permisos: admin/super segun ruta
  Request esperado: path `id`
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: depende de columna Clerk.

### Inventario / productos

- Metodo: GET
  Ruta: `/api/v1/inventario`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/inventory.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: lista productos
  Estado: implementado
  Observaciones: consulta stock/productos.

- Metodo: POST
  Ruta: `/api/v1/inventario`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/inventory.routes.ts`
  Requiere auth: si
  Roles/permisos: `inventario` o `almacenes`
  Request esperado: crear producto o action `update`; action `restock` obsoleto
  Response esperado: `{ ok, id?, codigo? }`
  Estado: implementado parcialmente
  Observaciones: `restock` devuelve 410 y sugiere compras.

- Metodo: GET
  Ruta: `/api/v1/inventario/search`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/inventory.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query busqueda
  Response esperado: resultados productos
  Estado: implementado
  Observaciones: usado por POS/inventario.

- Metodo: GET
  Ruta: `/api/v1/inventario/distribucion`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/inventory.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: distribucion stock
  Estado: implementado
  Observaciones: relacionado con almacenes.

### Lotes

- Metodo: GET
  Ruta: `/api/v1/lotes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/lotes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: lista lotes
  Estado: implementado
  Observaciones: base para stock por lote.

- Metodo: GET
  Ruta: `/api/v1/lotes/disponibles/:productoId`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/lotes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: `productoId`
  Response esperado: lotes disponibles
  Estado: implementado
  Observaciones: usado para salida de stock.

- Metodo: GET
  Ruta: `/api/v1/lotes/fefo/:productoId`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/lotes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: `productoId`
  Response esperado: lotes ordenados FEFO
  Estado: implementado
  Observaciones: relacionado con vencimiento.

- Metodo: GET
  Ruta: `/api/v1/lotes/consistencia`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/lotes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: inconsistencias lotes
  Estado: implementado
  Observaciones: revisar con modulo consistencia.

### Kardex / ajustes

- Metodo: GET
  Ruta: `/api/v1/kardex`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/kardex.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: movimientos kardex
  Estado: implementado
  Observaciones: auditoria de stock.

- Metodo: GET
  Ruta: `/api/v1/kardex/:id`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/kardex.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: `id`
  Response esperado: movimiento kardex
  Estado: implementado
  Observaciones: detalle.

- Metodo: POST
  Ruta: `/api/v1/kardex/ajuste`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/kardex.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: ajuste stock pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: posible duplicidad con modulo ajustes.

- Metodo: GET
  Ruta: `/api/v1/kardex/resumen/:productoId`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/kardex.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: `productoId`
  Response esperado: resumen kardex
  Estado: implementado
  Observaciones: resumen por producto.

- Metodo: POST
  Ruta: `/api/v1/ajustes/ajustes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/ajustes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: ajuste pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: frontend llama `POST /api/v1/ajustes`; mismatch critico.

### Ventas

- Metodo: GET
  Ruta: `/api/v1/ventas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/sales.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query filtros pendiente por confirmar
  Response esperado: lista ventas
  Estado: implementado
  Observaciones: ventas historicas.

- Metodo: POST
  Ruta: `/api/v1/ventas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/sales.routes.ts`
  Requiere auth: si
  Roles/permisos: `ventas`
  Request esperado: venta con cliente, items, pago, caja/area/almacen
  Response esperado: `{ ok, id, codigo }`
  Estado: implementado
  Observaciones: transaccion, FEFO, `FOR UPDATE`.

- Metodo: GET
  Ruta: `/api/v1/ventas/:id`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/sales.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: `id`
  Response esperado: detalle venta
  Estado: implementado
  Observaciones: detalle venta.

- Metodo: PATCH
  Ruta: `/api/v1/ventas/:id/anular`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/sales.routes.ts`
  Requiere auth: si
  Roles/permisos: `ventas` y admin/super
  Request esperado: `{ motivo }`
  Response esperado: `{ ok, codigo, message }`
  Estado: implementado
  Observaciones: debe restaurar stock/lotes pendiente por confirmar completo.

### Compras

- Metodo: GET
  Ruta: `/api/v1/compras`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/purchases.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query filtros pendiente por confirmar
  Response esperado: lista compras
  Estado: implementado
  Observaciones: historial compras.

- Metodo: POST
  Ruta: `/api/v1/compras`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/purchases.routes.ts`
  Requiere auth: si
  Roles/permisos: `compras`
  Request esperado: `{ proveedorId, tipoComprobante, numeroDocumento, notas, almacenId, items }`
  Response esperado: `{ ok, id, codigo, total }`
  Estado: implementado
  Observaciones: crea lotes, kardex y stock.

### Caja

- Metodo: GET
  Ruta: `/api/v1/caja`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/caja.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: estado/lista caja
  Estado: implementado
  Observaciones: apertura/cierre.

- Metodo: POST
  Ruta: `/api/v1/caja`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/caja.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: action `abrir` o `cerrar`
  Response esperado: `{ ok, id? }`
  Estado: implementado
  Observaciones: ventas-caja pendiente por confirmar.

### Proveedores

- Metodo: GET
  Ruta: `/api/v1/proveedores`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/providers.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: lista proveedores
  Estado: implementado
  Observaciones: usado en compras/productos.

- Metodo: POST
  Ruta: `/api/v1/proveedores`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/providers.routes.ts`
  Requiere auth: si
  Roles/permisos: `proveedores`
  Request esperado: datos proveedor pendiente por confirmar
  Response esperado: `{ ok, id? }` pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: validar RUC/duplicados.

### Pacientes / clinico

- Metodo: GET
  Ruta: `/api/v1/pacientes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/patients.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: lista pacientes
  Estado: implementado
  Observaciones: cliente clinico.

- Metodo: POST
  Ruta: `/api/v1/pacientes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/patients.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: datos paciente pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: pendiente validar contrato.

- Metodo: GET
  Ruta: `/api/v1/medicos`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/doctors.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: lista medicos
  Estado: implementado
  Observaciones: modulo clinico.

- Metodo: POST
  Ruta: `/api/v1/medicos`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/doctors.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: datos medico pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: indice CMP detectado.

- Metodo: GET
  Ruta: `/api/v1/historial`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/histories.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: historial
  Estado: implementado
  Observaciones: modulo clinico.

- Metodo: POST
  Ruta: `/api/v1/historial`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/histories.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: datos historial pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: modulo clinico.

- Metodo: GET
  Ruta: `/api/v1/recetas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/prescriptions.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: recetas
  Estado: implementado
  Observaciones: modulo clinico.

- Metodo: POST
  Ruta: `/api/v1/recetas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/prescriptions.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: receta pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: usa detalle receta.

- Metodo: GET
  Ruta: `/api/v1/citas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/appointments.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: citas
  Estado: implementado
  Observaciones: modulo clinico.

- Metodo: POST
  Ruta: `/api/v1/citas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/appointments.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: cita pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: modulo clinico.

### Servicios

- Metodo: GET
  Ruta: `/api/v1/servicios`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/services.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: servicios
  Estado: implementado
  Observaciones: puede venderse como item no producto.

- Metodo: POST
  Ruta: `/api/v1/servicios`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/services.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: servicio pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: validar permisos.

### Locales / almacenes / traslados

- Metodo: GET
  Ruta: `/api/v1/locales`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/locales.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: locales
  Estado: implementado
  Observaciones: base multi-local.

- Metodo: POST
  Ruta: `/api/v1/locales`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/locales.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: local pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: validar permisos.

- Metodo: GET
  Ruta: `/api/v1/almacenes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/almacenes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: almacenes
  Estado: implementado
  Observaciones: stock por almacen.

- Metodo: POST
  Ruta: `/api/v1/almacenes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/almacenes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: almacen pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: validar permisos.

- Metodo: GET
  Ruta: `/api/v1/almacenes/stock`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/almacenes.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: stock por almacen
  Estado: implementado
  Observaciones: usa vistas/tablas stock.

- Metodo: GET
  Ruta: `/api/v1/traslados-almacen`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/traslados-almacen.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: traslados
  Estado: implementado
  Observaciones: movimientos entre almacenes.

- Metodo: POST
  Ruta: `/api/v1/traslados-almacen`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/traslados-almacen.routes.ts`
  Requiere auth: si
  Roles/permisos: `traslados-almacen`, `transferencias` o `almacenes`
  Request esperado: traslado pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: validar transaccion y lotes.

- Metodo: POST
  Ruta: `/api/v1/traslados-almacen/devolucion-cliente`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/traslados-almacen.routes.ts`
  Requiere auth: si
  Roles/permisos: `devoluciones`, `traslados-almacen` o `almacenes`
  Request esperado: devolucion cliente pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: devoluciones.

- Metodo: POST
  Ruta: `/api/v1/traslados-almacen/devolucion-proveedor`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/traslados-almacen.routes.ts`
  Requiere auth: si
  Roles/permisos: `devoluciones`, `traslados-almacen` o `almacenes`
  Request esperado: devolucion proveedor pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: devoluciones.

### Consistencia

- Metodo: GET
  Ruta: `/api/v1/consistencia/stock`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: inconsistencias stock
  Estado: implementado
  Observaciones: auditoria operativa.

- Metodo: GET
  Ruta: `/api/v1/consistencia/lotes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: inconsistencias lotes
  Estado: implementado
  Observaciones: auditoria operativa.

- Metodo: GET
  Ruta: `/api/v1/consistencia/kardex`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: inconsistencias kardex
  Estado: implementado
  Observaciones: auditoria operativa.

- Metodo: GET
  Ruta: `/api/v1/consistencia/resumen`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: resumen consistencia
  Estado: implementado
  Observaciones: auditoria operativa.

- Metodo: POST
  Ruta: `/api/v1/consistencia/reconciliar`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: `consistencia` o `auditoria`
  Request esperado: reconciliacion pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: accion correctiva sensible.

- Metodo: POST
  Ruta: `/api/v1/consistencia/marcar-vencidos`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: `consistencia` o `auditoria`
  Request esperado: pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: accion sobre lotes vencidos.

- Metodo: GET
  Ruta: `/api/v1/consistencia/alertas`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/consistencia.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: alertas
  Estado: implementado
  Observaciones: visible en `/panel/alertas`.

### Otros modulos

- Metodo: GET
  Ruta: `/api/v1/dashboard`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/dashboard.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: pendiente por confirmar
  Response esperado: metricas dashboard
  Estado: implementado
  Observaciones: resumen inicial.

- Metodo: GET
  Ruta: `/api/v1/reportes`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/reports.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query reporte pendiente por confirmar
  Response esperado: reportes
  Estado: implementado parcialmente
  Observaciones: alcance exacto pendiente por confirmar.

- Metodo: GET
  Ruta: `/api/v1/auditoria`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/audit.routes.ts`
  Requiere auth: si
  Roles/permisos: no granular confirmado
  Request esperado: query pendiente por confirmar
  Response esperado: eventos auditoria
  Estado: implementado
  Observaciones: usa `bot_auditoria`.

- Metodo: GET
  Ruta: `/api/v1/perfil`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/profile.routes.ts`
  Requiere auth: si
  Roles/permisos: usuario autenticado
  Request esperado: no aplica
  Response esperado: perfil usuario
  Estado: implementado
  Observaciones: datos personales.

- Metodo: POST
  Ruta: `/api/v1/perfil`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/profile.routes.ts`
  Requiere auth: si
  Roles/permisos: usuario autenticado
  Request esperado: action `actualizar` o `cambiarClave`
  Response esperado: pendiente por confirmar
  Estado: implementado
  Observaciones: validar password y campos.

- Metodo: GET
  Ruta: `/api/v1/system/schema-status`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/system.routes.ts`
  Requiere auth: pendiente por confirmar
  Roles/permisos: pendiente por confirmar
  Request esperado: no aplica
  Response esperado: estado schema
  Estado: implementado
  Observaciones: diagnostico.

- Metodo: GET
  Ruta: `/health/live`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`
  Requiere auth: no
  Roles/permisos: no aplica
  Request esperado: no aplica
  Response esperado: health
  Estado: implementado
  Observaciones: healthcheck.

- Metodo: GET
  Ruta: `/health/ready`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`
  Requiere auth: no
  Roles/permisos: no aplica
  Request esperado: no aplica
  Response esperado: health readiness
  Estado: implementado
  Observaciones: revisa disponibilidad.

- Metodo: GET
  Ruta: `/health`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`
  Requiere auth: no
  Roles/permisos: no aplica
  Request esperado: no aplica
  Response esperado: health
  Estado: implementado
  Observaciones: health simple.

- Metodo: GET/POST
  Ruta: `/api/v1/deudores`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/deudores.routes.ts`
  Requiere auth: si
  Roles/permisos: pendiente por confirmar
  Request esperado: pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: modulo deuda.

- Metodo: GET/POST
  Ruta: `/api/v1/transferencias`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/transfers.routes.ts`
  Requiere auth: si
  Roles/permisos: pendiente por confirmar
  Request esperado: pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: distinto de traslados-almacen.

- Metodo: GET/POST
  Ruta: `/api/v1/alquileres`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/rentals.routes.ts`
  Requiere auth: si
  Roles/permisos: pendiente por confirmar
  Request esperado: pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: modulo alquileres.

- Metodo: GET/POST
  Ruta: `/api/v1/inventario-var`
  Archivo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/misc-inventory.routes.ts`
  Requiere auth: si
  Roles/permisos: pendiente por confirmar
  Request esperado: pendiente por confirmar
  Response esperado: pendiente por confirmar
  Estado: implementado parcialmente
  Observaciones: modulo inventario VAR.

## 11. Estado tecnico de calidad

Dependencias:

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/node_modules` existe; no se ejecuto `npm install`.
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/node_modules` existe; no se ejecuto `npm install`.

### Backend

- Comando: `npm run typecheck`
  Resultado: no ejecutado.
  Motivo: no existe script `typecheck` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/package.json`.
  Bloquea continuar: no, porque `npm run build` ejecuta `tsc`.

- Comando: `npm run build`
  Resultado: OK.
  Errores: no encontrados.
  Warnings importantes: no detectados.
  Bloquea continuar: no.

- Comando: `npm test`
  Resultado: OK.
  Resultado exacto: 9 archivos de test, 81 tests pasados.
  Errores: no encontrados.
  Warnings importantes: no detectados.
  Bloquea continuar: no.

- Comando: `npm run lint`
  Resultado: FAIL.
  Error: ESLint 9.39.4 no encontro `eslint.config.js`, `eslint.config.mjs` o `eslint.config.cjs`.
  Archivo relevante: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/package.json`.
  Bloquea continuar: si se exige lint verde para CI/Fase 01; no bloquea build/tests.

### Frontend

- Comando: `npm run typecheck`
  Resultado: no ejecutado.
  Motivo: no existe script `typecheck` en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/package.json`.
  Bloquea continuar: no, porque `npm run build` ejecuta `tsc -b`.

- Comando: `npm run build`
  Resultado: OK.
  Errores: no encontrados.
  Warnings importantes: chunk JS grande, `676.49 kB` gzip `184.00 kB`.
  Bloquea continuar: no.

- Comando: `npm test`
  Resultado: OK.
  Resultado exacto: 4 archivos de test, 49 tests pasados.
  Warnings importantes: warnings React `act(...)` en tests POS.
  Bloquea continuar: no.

- Comando: `npm run lint`
  Resultado: FAIL.
  Errores detectados:
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`: `_token` definido pero no usado.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`: usos de `any`.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/ajustes-page.tsx`: `error` definido pero no usado.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/inventory-page.tsx`: unused expression.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/traslados-almacen-page.tsx`: usos de `any`.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pos/components/PaymentPanel.tsx`: uso de `any`.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pos/utils/posUtils.ts`: uso de `any`.
  - `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/vitest.config.ts`: uso de `any`.
  Bloquea continuar: si se exige lint verde para CI/Fase 01; no bloquea build/tests.

## 12. Variables de entorno

Fuentes auditadas:

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/.env.example`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/.env.example`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/db.ts`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/vite.config.ts`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`

No se exponen valores reales de `.env`.

- Nombre: `NODE_ENV`
  Donde se usa: backend config/server.
  Para que sirve: ambiente runtime.
  Obligatoria u opcional: opcional en dev; importante en prod.
  Observacion: prod activa validaciones estrictas.

- Nombre: `PORT`
  Donde se usa: backend.
  Para que sirve: puerto Fastify.
  Obligatoria u opcional: opcional.
  Observacion: start muestra puerto 3000.

- Nombre: `HOST`
  Donde se usa: backend.
  Para que sirve: host de escucha.
  Obligatoria u opcional: opcional.
  Observacion: pendiente confirmar default exacto.

- Nombre: `LOG_LEVEL`
  Donde se usa: backend.
  Para que sirve: nivel logs.
  Obligatoria u opcional: opcional.
  Observacion: util para debug.

- Nombre: `TRUST_PROXY`
  Donde se usa: backend.
  Para que sirve: confiar proxy reverso.
  Obligatoria u opcional: opcional.
  Observacion: importante si se publica detras de proxy.

- Nombre: `BOTICA_DB_HOST`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/db.ts`, `start.sh`.
  Para que sirve: host PostgreSQL.
  Obligatoria u opcional: obligatoria salvo default/dev.
  Observacion: default local.

- Nombre: `BOTICA_DB_PORT`
  Donde se usa: DB backend/scripts.
  Para que sirve: puerto PostgreSQL.
  Obligatoria u opcional: obligatoria salvo default.
  Observacion: default 5432.

- Nombre: `BOTICA_DB_NAME`
  Donde se usa: DB backend/scripts.
  Para que sirve: nombre base de datos.
  Obligatoria u opcional: obligatoria salvo default.
  Observacion: `botica_db`.

- Nombre: `BOTICA_DB_USER`
  Donde se usa: DB backend/scripts.
  Para que sirve: usuario PostgreSQL.
  Obligatoria u opcional: obligatoria salvo default.
  Observacion: puede default al usuario del sistema.

- Nombre: `BOTICA_DB_PASS`
  Donde se usa: DB backend/scripts.
  Para que sirve: password PostgreSQL.
  Obligatoria u opcional: depende de entorno.
  Observacion: no exponer valor real.

- Nombre: `DB_HOST`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/plugins/db.ts`.
  Para que sirve: alias DB host.
  Obligatoria u opcional: fallback.
  Observacion: coexiste con `BOTICA_DB_HOST`.

- Nombre: `DB_PORT`
  Donde se usa: DB plugin.
  Para que sirve: alias DB port.
  Obligatoria u opcional: fallback.
  Observacion: coexiste con `BOTICA_DB_PORT`.

- Nombre: `DB_NAME`
  Donde se usa: DB plugin.
  Para que sirve: alias DB name.
  Obligatoria u opcional: fallback.
  Observacion: coexiste con `BOTICA_DB_NAME`.

- Nombre: `DB_USER`
  Donde se usa: DB plugin.
  Para que sirve: alias DB user.
  Obligatoria u opcional: fallback.
  Observacion: coexiste con `BOTICA_DB_USER`.

- Nombre: `DB_PASSWORD`
  Donde se usa: DB plugin.
  Para que sirve: alias DB password.
  Obligatoria u opcional: fallback.
  Observacion: coexiste con `BOTICA_DB_PASS`.

- Nombre: `JWT_SECRET`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`.
  Para que sirve: firmar/verificar JWT local.
  Obligatoria u opcional: obligatoria en produccion; fallback dev.
  Observacion: prod exige longitud minima 32.

- Nombre: `CLERK_JWKS_URL`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/auth.routes.ts`.
  Para que sirve: verificar JWT Clerk.
  Obligatoria u opcional: obligatoria solo si Clerk activo.
  Observacion: si falta, sync Clerk no funciona.

- Nombre: `CLERK_JWT_ISSUER`
  Donde se usa: auth Clerk backend.
  Para que sirve: validar issuer JWT Clerk.
  Obligatoria u opcional: obligatoria si Clerk activo.
  Observacion: pendiente confirmar validacion exacta.

- Nombre: `CORS_ORIGIN`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/server.ts`.
  Para que sirve: origenes permitidos.
  Obligatoria u opcional: obligatoria en produccion.
  Observacion: dev acepta defaults.

- Nombre: `SENTRY_DSN`
  Donde se usa: backend/frontend examples.
  Para que sirve: monitoreo errores.
  Obligatoria u opcional: opcional.
  Observacion: integracion real pendiente por confirmar.

- Nombre: `SENTRY_ENVIRONMENT`
  Donde se usa: backend example.
  Para que sirve: ambiente Sentry.
  Obligatoria u opcional: opcional.
  Observacion: depende de Sentry activo.

- Nombre: `VITE_API_URL`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/.env.example`.
  Para que sirve: URL API esperada.
  Obligatoria u opcional: dudosa.
  Observacion: `frontend/src/lib/api.ts` usa `/api/v1` relativo, por tanto uso real pendiente por confirmar.

- Nombre: `VITE_CLERK_PUBLISHABLE_KEY`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/clerk-provider.tsx`, `.env.example`.
  Para que sirve: activar Clerk en frontend.
  Obligatoria u opcional: opcional si login local basta.
  Observacion: sin key no debe activarse Clerk.

- Nombre: `VITE_SENTRY_DSN`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/.env.example`.
  Para que sirve: Sentry frontend.
  Obligatoria u opcional: opcional.
  Observacion: uso real pendiente por confirmar.

- Nombre: `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`
  Donde se usa: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/vite.config.ts`.
  Para que sirve: permitir hosts extra en Vite.
  Obligatoria u opcional: opcional.
  Observacion: util con Cloudflare/tuneles.

## 13. Codigo legacy o dudoso

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/_draft`
  Que parece ser: borradores de rutas/servicios con Supabase.
  Estado: legacy/dudoso.
  Riesgo de eliminarlo: medio; podria contener logica pensada para migrar.
  Recomendacion: no eliminar hasta comparar con rutas activas y registrar decision.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/supabase`
  Que parece ser: SQL/RPC Supabase antiguo.
  Estado: legacy/dudoso.
  Riesgo de eliminarlo: medio.
  Recomendacion: archivar o mover a docs/legacy si no se usa.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/README.md`
  Que parece ser: README backend anterior.
  Estado: desactualizado.
  Riesgo de eliminarlo: bajo, pero mejor actualizar.
  Recomendacion: reescribir para Fastify + PostgreSQL real.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/docs/context/contexto_botica.md`
  Que parece ser: contexto anterior con PHP/backend legacy.
  Estado: legacy.
  Riesgo de eliminarlo: bajo/medio por memoria historica.
  Recomendacion: mantener como historico o marcar obsoleto.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/docs/migrations/schema_farmacia_completo.sql`
  Que parece ser: schema antiguo sin prefijo `bot_` completo.
  Estado: legacy/dudoso.
  Riesgo de eliminarlo: medio.
  Recomendacion: no usar como fuente Fase 01 sin validar.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/docs/migrations/fix_database.sql`
  Que parece ser: fixes antiguos/legacy.
  Estado: legacy/dudoso.
  Riesgo de eliminarlo: medio.
  Recomendacion: comparar con `ops/migrations`.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/start.sh`
  Que parece ser: script de arranque local.
  Estado: activo con referencias legacy.
  Riesgo de eliminarlo: alto.
  Recomendacion: corregir referencias SQL/PHP despues, no borrar.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/vite.config.ts`
  Que parece ser: proxy activo a Fastify y proxy legacy `/api` a PHP.
  Estado: activo con legacy.
  Riesgo de eliminarlo: medio.
  Recomendacion: mantener `/api/v1`; revisar si `/api` legacy aun se necesita.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/mcp-server`
  Que parece ser: servidor MCP con acceso directo a DB.
  Estado: activo/dudoso.
  Riesgo de eliminarlo: medio.
  Recomendacion: auditar herramientas que escriben DB porque pueden saltar auth/auditoria/transacciones del API.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/dist`
  Que parece ser: build generado.
  Estado: generado.
  Riesgo de eliminarlo: bajo si se regenera, pero no tocar sin revisar versionado.
  Recomendacion: no editar manualmente.

- Ruta: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/dist`
  Que parece ser: build generado.
  Estado: generado.
  Riesgo de eliminarlo: bajo si se regenera, pero no tocar sin revisar versionado.
  Recomendacion: no editar manualmente.

- Ruta: DB tabla `kardex`
  Que parece ser: tabla legacy distinta de `bot_kardex`.
  Estado: legacy/dudoso.
  Riesgo de eliminarlo: alto sin confirmar datos.
  Recomendacion: revisar referencias antes de migrar/eliminar.

- Ruta: DB tabla `tipos_movimiento`
  Que parece ser: catalogo legacy de movimientos.
  Estado: legacy/dudoso.
  Riesgo de eliminarlo: alto sin confirmar datos.
  Recomendacion: revisar referencias antes de migrar/eliminar.

- Angular antiguo: no encontrado.
- PHP antiguo: no se encontraron archivos PHP en auditoria, pero si referencias legacy a backend PHP.
- React antiguo no usado: no confirmado.
- Archivos duplicados: migraciones `006_*` duplican numeracion en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/ops/migrations`; requiere ordenamiento.

## 14. Que falta para continuar desarrollo

### Bloqueadores tecnicos

- Corregir lint backend: falta `eslint.config.*` compatible con ESLint 9.
- Corregir lint frontend: 10 errores actuales en API/pages/POS/config.
- Corregir mismatch de ajustes: frontend llama `POST /api/v1/ajustes`, backend expone `POST /api/v1/ajustes/ajustes`.
- Confirmar/aplicar migracion Clerk `014_usuarios_clerk_link.sql` o excluir Clerk de Fase 01.
- Revisar `start.sh` contra ubicacion real de SQL en `docs/migrations` y `ops/migrations`.

### Pendientes funcionales criticos

- Validar flujo venta completo con DB real: caja abierta, FEFO, descuento lote, kardex y anulacion.
- Validar flujo compra completo: proveedor, lote obligatorio, stock, kardex y transaccion.
- Definir regla oficial de stock: `bot_productos.nstock` vs suma de `bot_lotes.ncantidad`.
- Cerrar permisos backend por modulo critico: ventas, compras, inventario, caja, usuarios, consistencia.
- Confirmar estado de caja: impedir ventas si caja no esta abierta, si ese es requerimiento de negocio.
- Confirmar migraciones base para instalacion limpia.

### Pendientes funcionales no criticos

- Reportes Fase 01: definir cuales son obligatorios.
- Modulos clinicos: pacientes, medicos, historial, recetas, citas.
- Alquileres, deudores, transferencias e inventario VAR.
- Clerk como login externo si no es requerido de inmediato.
- Sentry/observabilidad.

### Limpieza/refactor

- Mover `_draft` y Supabase legacy a docs/legacy o eliminar con decision.
- Actualizar README backend para reflejar Fastify + PostgreSQL real.
- Separar rutas grandes en servicios/repositorios solo despues de estabilizar Fase 01.
- Normalizar migraciones duplicadas y documentar orden.
- Revisar `mcp-server` para no saltar reglas del backend.
- Evaluar code splitting frontend por warning de chunk grande.

## 15. Plan recomendado para continuar

### Paso 1: Corregir contratos rotos de Fase 01

- Objetivo: alinear frontend/backend en endpoints usados por inventario, empezando por ajustes.
- Archivos a tocar: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/ajustes.routes.ts`, tests relacionados si existen.
- Riesgo: bajo/medio; puede romper compatibilidad si alguien ya usa `/api/v1/ajustes/ajustes`.
- Resultado esperado: ajuste de inventario responde desde la ruta que el frontend llama o se mantiene compatibilidad con ambas.

### Paso 2: Dejar validacion tecnica base en verde

- Objetivo: que build, tests y lint sean confiables para trabajar.
- Archivos a tocar: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/package.json`, posible `eslint.config.*`, errores frontend listados en seccion 11.
- Riesgo: bajo; cambios pequenos pero pueden tocar muchos tipos.
- Resultado esperado: backend build/test/lint OK; frontend build/test/lint OK.

### Paso 3: Validar migraciones y schema real

- Objetivo: asegurar que una DB limpia tenga todas las columnas/tablas que el codigo usa.
- Archivos a tocar: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/ops/migrations`, `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/start.sh`, docs de setup.
- Riesgo: medio/alto por datos reales.
- Resultado esperado: `bot_usuarios.cclerk_user_id` decidido/aplicado, migraciones ordenadas, bootstrap reproducible.

### Paso 4: Cerrar flujo ventas + inventario

- Objetivo: garantizar venta con FEFO, descuento lote, kardex, caja y anulacion.
- Archivos a tocar: `sales.routes.ts`, `lotes.routes.ts`, `kardex.routes.ts`, `caja.routes.ts`, POS frontend y tests.
- Riesgo: alto por stock/dinero.
- Resultado esperado: pruebas integradas cubren venta normal, stock insuficiente, lote vencido y anulacion.

### Paso 5: Cerrar flujo compras

- Objetivo: garantizar ingreso de stock por compra con lote/vencimiento y proveedor.
- Archivos a tocar: `purchases.routes.ts`, `providers.routes.ts`, paginas compras/inventario.
- Riesgo: alto por impacto en stock y costos.
- Resultado esperado: compra crea lote, actualiza stock/kardex y revierte completo ante error.

### Paso 6: Endurecer permisos Fase 01

- Objetivo: evitar endpoints sensibles solo con auth generica.
- Archivos a tocar: rutas backend y `auth.ts`; frontend access guards si cambia matriz.
- Riesgo: medio; puede bloquear usuarios existentes.
- Resultado esperado: matriz permisos documentada y aplicada en backend.

### Paso 7: Limpieza legacy controlada

- Objetivo: reducir confusion sin perder informacion historica.
- Archivos a tocar: `_draft`, `supabase`, `docs`, README.
- Riesgo: medio.
- Resultado esperado: carpetas legacy marcadas/archivadas y docs actuales claras.

## 16. Proxima tarea recomendada para Codex

# Proxima tarea recomendada

## Objetivo

Corregir el contrato roto de ajustes de inventario entre frontend y backend para que la pantalla de ajustes pueda llamar un endpoint real y validable.

## Alcance

- Que si debe modificar:
  - Alinear `apiPostAjuste` con la ruta backend real o agregar ruta backend compatible `POST /api/v1/ajustes`.
  - Mantener compatibilidad con `POST /api/v1/ajustes/ajustes` si es barato y seguro.
  - Agregar o ajustar tests minimos si ya existe estructura cercana.

- Que no debe modificar:
  - No refactorizar inventario completo.
  - No tocar migraciones.
  - No cambiar reglas de stock/FEFO.
  - No limpiar legacy.

## Archivos probables

- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/lib/api.ts`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/pages/ajustes-page.tsx`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/ajustes.routes.ts`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/backend-fastify/src/routes/*.test.ts`
- `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/frontend/src/**/*.test.tsx`

## Criterios de aceptacion

- `apiPostAjuste` llama una ruta existente.
- Backend responde a `POST /api/v1/ajustes`.
- Si se conserva compatibilidad, `POST /api/v1/ajustes/ajustes` tambien sigue funcionando.
- No se rompen build/tests existentes.
- El documento o comentario de test deja claro el contrato oficial.

## Comandos de validacion

- `cd /Volumes/MAC/MAC\ Ext/Desktop/BoticaElPueblo/backend-fastify && npm run build`
- `cd /Volumes/MAC/MAC\ Ext/Desktop/BoticaElPueblo/backend-fastify && npm test`
- `cd /Volumes/MAC/MAC\ Ext/Desktop/BoticaElPueblo/frontend && npm run build`
- `cd /Volumes/MAC/MAC\ Ext/Desktop/BoticaElPueblo/frontend && npm test`
- `cd /Volumes/MAC/MAC\ Ext/Desktop/BoticaElPueblo/frontend && npm run lint`
- `cd /Volumes/MAC/MAC\ Ext/Desktop/BoticaElPueblo/backend-fastify && npm run lint`

## Riesgos

- El lint ya falla por errores previos; no mezclar esos arreglos salvo que esten directamente relacionados.
- Ajustes toca stock; no cambiar logica de negocio sin pruebas.
- Si se cambia solo frontend o solo backend, el contrato puede seguir ambiguo.

## Prompt sugerido para ejecutar esa tarea

```text
[$caveman] Corrige solo el mismatch de ajustes de inventario. Hoy frontend llama POST /api/v1/ajustes desde frontend/src/lib/api.ts, pero backend expone POST /api/v1/ajustes/ajustes en backend-fastify/src/routes/ajustes.routes.ts. Alinea el contrato para que POST /api/v1/ajustes sea la ruta oficial y conserva compatibilidad con /api/v1/ajustes/ajustes si es seguro. Agrega o ajusta tests minimos si existe estructura cercana. No refactorices inventario, no cambies reglas de stock/FEFO, no toques migraciones. Valida backend build/test y frontend build/test; corre lint y documenta si quedan fallos preexistentes.
```

## 17. Jira secundario

EPIC: Estabilizacion tecnica Fase 01

- Tarea: Corregir contrato ajustes inventario.
  - Estado sugerido: pendiente.
  - Archivos relacionados: `frontend/src/lib/api.ts`, `backend-fastify/src/routes/ajustes.routes.ts`.
  - Pendiente: definir ruta oficial y tests.

- Tarea: Dejar lint backend operativo.
  - Estado sugerido: pendiente.
  - Archivos relacionados: `backend-fastify/package.json`, `eslint.config.*`.
  - Pendiente: config ESLint 9.

- Tarea: Dejar lint frontend verde.
  - Estado sugerido: pendiente.
  - Archivos relacionados: archivos listados en seccion 11.
  - Pendiente: corregir 10 errores.

EPIC: Inventario y lotes

- Tarea: Validar consistencia stock producto vs lotes.
  - Estado sugerido: pendiente.
  - Archivos relacionados: `inventory.routes.ts`, `lotes.routes.ts`, `consistencia.routes.ts`.
  - Pendiente: pruebas integradas.

- Tarea: Validar ajustes y kardex.
  - Estado sugerido: parcial.
  - Archivos relacionados: `ajustes.routes.ts`, `kardex.routes.ts`.
  - Pendiente: contrato y permisos.

EPIC: Ventas

- Tarea: Cerrar flujo POS venta con FEFO.
  - Estado sugerido: parcial.
  - Archivos relacionados: `sales.routes.ts`, `frontend/src/pos`.
  - Pendiente: pruebas E2E/integracion.

- Tarea: Anulacion de ventas segura.
  - Estado sugerido: parcial.
  - Archivos relacionados: `sales.routes.ts`.
  - Pendiente: validar restitucion de stock/lotes/caja.

EPIC: Compras

- Tarea: Compra crea lotes y kardex.
  - Estado sugerido: parcial.
  - Archivos relacionados: `purchases.routes.ts`, `providers.routes.ts`.
  - Pendiente: pruebas transaccionales.

EPIC: Seguridad

- Tarea: Definir matriz permisos Fase 01.
  - Estado sugerido: parcial.
  - Archivos relacionados: `auth.ts`, rutas backend, `access-guards.tsx`.
  - Pendiente: permisos granulares por endpoint.

- Tarea: Decidir Clerk Fase 01.
  - Estado sugerido: parcial.
  - Archivos relacionados: `auth.routes.ts`, `users.routes.ts`, `014_usuarios_clerk_link.sql`.
  - Pendiente: aplicar migracion o dejar fuera del alcance.

Estado general: prototipo funcional avanzado con backend/frontend compilando y tests pasando, pero aun con contratos rotos, lint fallando y migraciones/legacy por ordenar.
Porcentaje estimado de avance: 70% para una Fase 01 interna; 55% para una Fase 01 robusta con validacion tecnica completa.
Bloqueadores: lint backend/frontend, endpoint ajustes, migracion Clerk/schema, validacion flujo venta-compra-stock-caja.
Siguiente mejor paso: corregir primero el contrato de ajustes de inventario y luego dejar lint/build/test como gate obligatorio antes de ampliar funcionalidades.
