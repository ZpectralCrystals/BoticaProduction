# Contexto actual del proyecto

Auditoria tecnica realizada el 2026-05-07 sobre el workspace `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo`.

Fuentes revisadas: codigo fuente, `package.json`, scripts, docs, migraciones SQL, configuraciones, tests y esquema PostgreSQL local `botica_db`. No se modifico codigo fuente; solo se crea este documento.

## 1. Resumen general

Botica El Pueblo es un ERP para operacion de farmacia/botica con modulos de ventas POS, inventario, lotes FEFO, compras, caja, proveedores, clientes/pacientes, medicos, reportes, usuarios, auditoria, almacenes/locales, traslados, devoluciones, consistencia de stock y alertas.

La aplicacion principal actual es:

- Frontend web React/Vite en `/frontend`.
- Backend API REST Fastify/TypeScript en `/backend-fastify`.
- Base de datos PostgreSQL local `botica_db`, con tablas principales prefijadas `bot_*`.
- Scripts operativos en `/scripts`, `/ops` y `start.sh`.
- Documentacion historica y tecnica en `/docs`.
- Servidor MCP auxiliar en `/mcp-server`, conectado directo a PostgreSQL.

Estado general detectado: sistema funcional en desarrollo local, con flujo central ventas/inventario/compras bastante avanzado, pero con riesgos por documentacion legacy, rutas puntuales desalineadas, migraciones no automatizadas de forma clara y validaciones/lint pendientes.

## 2. Stack tecnologico detectado

### Frontend

- Framework/libreria: React `^19.2.4`.
- Build/dev server: Vite `^8.0.4`.
- Lenguaje: TypeScript.
- UI framework: Tailwind CSS `^4.2.2`, componentes propios estilo shadcn en `/frontend/src/components/ui`.
- Iconos: `lucide-react`.
- Notificaciones: `sonner`.
- Manejo de estado: React Context (`AuthProvider`, `AppDataProvider`, `ClerkBridgeProvider`) y hooks del POS.
- Rutas: `react-router-dom` `^7.14.0`, definidas en `/frontend/src/app/router.tsx`.
- Autenticacion: JWT local como modo oficial actual; Clerk instalado y envuelto de forma condicional.
- Consumo de APIs: `fetch` en `/frontend/src/lib/api.ts`, usando rutas relativas `/api/v1` y proxy Vite hacia Fastify.

### Backend

- Framework: Fastify `^5.0.0`.
- Lenguaje: TypeScript, Node `>=20`.
- Arquitectura: servidor Fastify monolitico por modulos; rutas en `/backend-fastify/src/routes`, plugins en `/backend-fastify/src/plugins`.
- ORM/query builder: mezcla de SQL crudo con `pg` y Drizzle ORM parcial. Drizzle se usa en partes de inventario; SQL crudo domina ventas, compras, caja, usuarios, consistencia y otros modulos.
- Base de datos: PostgreSQL.
- Autenticacion: JWT local con `@fastify/jwt`, cookie `botica_token`, bearer token opcional, password hash con `bcryptjs`.
- Validaciones: validaciones manuales por ruta; Zod instalado, usado en drafts y algunas configuraciones, pero no es patron uniforme activo.
- Testing: Vitest en backend, tests en `/backend-fastify/src/__tests__`.
- Seguridad/plugs: CORS, cookies, JWT, Helmet, rate-limit global, Swagger solo en no-produccion, error handler custom.

### Base de datos

- Motor: PostgreSQL local, documentado como PostgreSQL 15 en README.
- Base detectada: `botica_db`.
- Tablas activas reales consultadas: `bot_almacenes`, `bot_alquileres`, `bot_auditoria`, `bot_caja`, `bot_citas`, `bot_compras`, `bot_compras_det`, `bot_deudores`, `bot_historial`, `bot_inventario_var`, `bot_kardex`, `bot_locales`, `bot_lotes`, `bot_medicos`, `bot_movimientos_almacen`, `bot_pacientes`, `bot_permisos`, `bot_productos`, `bot_proveedores`, `bot_recetas`, `bot_recetas_det`, `bot_servicios`, `bot_transferencias`, `bot_transferencias_det`, `bot_usuarios`, `bot_ventas`, `bot_ventas_det`.
- Tablas legacy/paralelas detectadas: `kardex`, `tipos_movimiento`.
- Vistas reales detectadas: `vw_bot_lotes_fefo`, `vw_stock_por_almacen`.
- Migraciones principales: `/ops/migrations/*.sql`.
- SQL legacy/Supabase: `/docs/migrations/schema_farmacia_completo.sql`, `/docs/migrations/fix_database.sql`, `/backend-fastify/supabase/*.sql`.
- Seeds: locales y almacenes default en `/ops/migrations/010_locales_almacenes.sql`; tipos de movimiento en `/docs/migrations/fix_database.sql`; superusuario documentado en `README.md` y `start.sh`.

### Herramientas adicionales

- Scripts:
  - `/start.sh`: arranque local completo.
  - `/scripts/backup-db.sh`: backup PostgreSQL con gzip y rotacion.
  - `/ops/backup_postgres.sh`: backup PostgreSQL alternativo.
  - `/scripts/cron-reconciliacion.sh`: job API para reconciliar stock.
  - `/scripts/cron-vencimientos.sh`: job API para marcar lotes vencidos.
  - `/scripts/check-schema.js`: wrapper raiz para schema check backend.
  - `/backend-fastify/check-schema.js`: verificacion CLI del esquema requerido.
- Docker: no encontrado.
- CI/CD: no encontrado `.github`, workflows, YAML de pipeline o Docker.
- Variables de entorno: `.env.example` en backend y frontend; variables adicionales en scripts.
- Config importante:
  - `/frontend/vite.config.ts`: proxy `/api/v1` a Fastify `127.0.0.1:3000`; proxy `/api` a backend PHP legacy `127.0.0.1:8081`.
  - `/backend-fastify/drizzle.config.ts`: Drizzle usa `BOTICA_DB_*`/`DB_*`.
  - `/backend-fastify/vitest.config.ts`, `/frontend/vitest.config.ts`: tests con Vitest.
  - `/frontend/eslint.config.js`: ESLint flat config.
  - Backend no tiene `eslint.config.*`, aunque `package.json` define `npm run lint`.

## 3. Estructura de carpetas

- `/frontend`: aplicacion web principal React/Vite. Contiene paginas, router, contexts, cliente API, componentes UI, POS y tests frontend.
- `/backend-fastify`: API principal Fastify/TypeScript. Contiene server, plugins, rutas REST, Drizzle schema, tests, build `dist`, drafts legacy y SQL Supabase.
- `/backend-fastify/src/routes`: rutas backend agrupadas por modulo.
- `/backend-fastify/src/plugins`: DB `pg`, Drizzle, auth JWT/permisos y error handler.
- `/backend-fastify/src/db`: schema Drizzle parcial sobre tablas `bot_*`.
- `/backend-fastify/src/__tests__`: tests Vitest backend con mocks.
- `/backend-fastify/_draft`: codigo no activo/draft basado en Supabase, servicios y rutas clinicas/kardex viejas.
- `/backend-fastify/supabase`: SQL/RPC legacy o referencia para Supabase; no activo en server actual.
- `/docs`: documentacion historica, auditorias, checklists, arquitectura, reportes y migraciones antiguas.
- `/docs/migrations`: SQL completo antiguo estilo Supabase y fix rapido; no coincide plenamente con schema `bot_*` activo.
- `/ops/migrations`: migraciones incrementales activas para schema `bot_*`.
- `/scripts`: scripts operativos de backup, cron y schema check.
- `/ops`: backup PostgreSQL y migraciones SQL.
- `/mcp-server`: MCP server TypeScript para consultar/operar PostgreSQL directamente.
- `start.sh`: arranque local todo-en-uno.
- `/backend`: no encontrado. `start.sh` referencia esta carpeta solo si `BOTICA_ENABLE_PHP_LEGACY=1`; actualmente no existe en repo.

## 4. Estado actual de funcionalidades

### Usuarios y login

- Estado: implementado parcialmente.
- Archivos principales: `/backend-fastify/src/routes/auth.routes.ts`, `/backend-fastify/src/routes/users.routes.ts`, `/backend-fastify/src/plugins/auth.ts`, `/frontend/src/pages/login-page.tsx`, `/frontend/src/pages/usuarios-page.tsx`, `/frontend/src/context/auth-context.tsx`.
- Rutas frontend: `/`, `/panel/usuarios`, `/panel/perfil`, `/auth/clerk`, `/login/clerk`.
- Endpoints backend: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `POST /api/v1/auth/clerk-sync`, `GET/POST /api/v1/usuarios`, `GET/POST/DELETE /api/v1/usuarios/:id/clerk-link`.
- Tablas relacionadas: `bot_usuarios`, `bot_permisos`, `bot_auditoria`.
- Observaciones tecnicas: login local usa DNI + clave bcrypt. Usuario autenticado se reconstruye desde `bot_usuarios` y permisos desde `bot_permisos`.
- Riesgos o pendientes: codigo de usuarios y Clerk consulta `bot_usuarios.cclerk_user_id`, pero la DB local consultada no tiene esa columna. Migracion `/ops/migrations/014_usuarios_clerk_link.sql` existe, pero parece pendiente de aplicar en DB local.

### Roles y permisos

- Estado: implementado parcialmente.
- Archivos principales: `/backend-fastify/src/plugins/auth.ts`, `/backend-fastify/src/routes/users.routes.ts`, `/frontend/src/app/access-guards.tsx`, `/frontend/src/lib/app-sections.ts`.
- Rutas frontend relacionadas: todas bajo `/panel/*` usan `RequireSection`.
- Endpoints backend relacionados: algunos endpoints mutadores usan `requireAnyPermission`; otros solo `requireAuth`.
- Tablas relacionadas: `bot_usuarios`, `bot_permisos`.
- Observaciones tecnicas: `lsuper` y `ladmin` tienen acceso amplio. Frontend bloquea por seccion. Backend aplica permisos finos en ventas, compras, proveedores, inventario, consistencia, traslados/devoluciones y usuarios por chequeo admin/super.
- Riesgos o pendientes: varios modulos quedan protegidos solo por sesion, no por permiso por modulo en backend.

### Productos

- Estado: implementado.
- Archivos principales: `/backend-fastify/src/routes/inventory.routes.ts`, `/backend-fastify/src/db/schema.ts`, `/frontend/src/pages/inventory-page.tsx`, `/frontend/src/lib/api.ts`.
- Rutas frontend relacionadas: `/panel/inventario`.
- Endpoints backend relacionados: `GET /api/v1/inventario`, `POST /api/v1/inventario`, `GET /api/v1/inventario/search`, `GET /api/v1/inventario/distribucion`.
- Tablas relacionadas: `bot_productos`, `bot_proveedores`, `bot_lotes`, `vw_stock_por_almacen`.
- Observaciones tecnicas: alta/edicion producto usa Drizzle parcial. Reposicion directa `action=restock` fue eliminada y responde `410`; ingreso de stock debe hacerse por compras.
- Riesgos o pendientes: codigo de producto se genera con conteo total; puede colisionar si hay concurrencia o categorias similares.

### Inventario

- Estado: implementado.
- Archivos principales: `/backend-fastify/src/routes/inventory.routes.ts`, `/backend-fastify/src/routes/lotes.routes.ts`, `/backend-fastify/src/routes/kardex.routes.ts`, `/backend-fastify/src/routes/consistencia.routes.ts`, `/frontend/src/pages/inventory-page.tsx`, `/frontend/src/pages/consistencia-page.tsx`, `/frontend/src/pages/alertas-page.tsx`.
- Rutas frontend relacionadas: `/panel/inventario`, `/panel/consistencia`, `/panel/alertas`, `/panel/ajustes`.
- Endpoints backend relacionados: `/api/v1/inventario`, `/api/v1/lotes`, `/api/v1/kardex`, `/api/v1/consistencia/*`.
- Tablas relacionadas: `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_movimientos_almacen`, `bot_almacenes`, `bot_locales`.
- Observaciones tecnicas: stock total queda en `bot_productos.nstock`; lotes por almacen en `bot_lotes`; consistencia compara ambos.
- Riesgos o pendientes: endpoint frontend `apiPostAjuste()` llama `POST /api/v1/ajustes`, pero backend registra `POST /api/v1/ajustes/ajustes` por combinacion de prefix y ruta interna. Modulo ajustes parece desalineado.

### Proveedores

- Estado: implementado.
- Archivos principales: `/backend-fastify/src/routes/providers.routes.ts`, `/frontend/src/pages/proveedores-page.tsx`.
- Rutas frontend relacionadas: `/panel/proveedores`.
- Endpoints backend relacionados: `GET /api/v1/proveedores`, `POST /api/v1/proveedores`.
- Tablas relacionadas: `bot_proveedores`, `bot_productos`, `bot_compras`, `bot_auditoria`.
- Observaciones tecnicas: migracion `/ops/migrations/013_proveedores_ruc_unico_y_auditoria.sql` agrega validacion de estado, vistas de invalidos/duplicados e indice unico condicional si no hay duplicados.
- Riesgos o pendientes: validacion SUNAT aparece documentada como pendiente en `/docs/reports/PROVEEDORES_VALIDACION_PENDIENTE_SUNAT.md`.

### Clientes

- Estado: implementado parcialmente.
- Archivos principales: `/backend-fastify/src/routes/patients.routes.ts`, `/backend-fastify/src/routes/sales.routes.ts`, `/frontend/src/pages/patients-page.tsx`.
- Rutas frontend relacionadas: `/panel/pacientes`, ventas POS.
- Endpoints backend relacionados: `GET/POST /api/v1/pacientes`, `POST /api/v1/ventas`.
- Tablas relacionadas: `bot_pacientes`, `bot_ventas.ncliente_clinico_id`.
- Observaciones tecnicas: clientes clinicos se unifican con pacientes mediante `bot_pacientes`; ventas genericas usan consumidor final y DNI fallback `99999999` o paciente generico `00000000`.
- Riesgos o pendientes: terminologia cliente/paciente coexiste; migracion `/ops/migrations/007_unify_customers_and_patients.sql` y `/ops/migrations/008_rename_sales_clinical_customer_link.sql` explican transicion.

### Ventas

- Estado: implementado.
- Archivos principales: `/backend-fastify/src/routes/sales.routes.ts`, `/frontend/src/pages/sales-page.tsx`, `/frontend/src/pos/*`.
- Rutas frontend relacionadas: `/panel/ventas`.
- Endpoints backend relacionados: `GET /api/v1/ventas`, `POST /api/v1/ventas`, `PATCH /api/v1/ventas/:id/anular`, `GET /api/v1/ventas/:id`.
- Tablas relacionadas: `bot_ventas`, `bot_ventas_det`, `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_movimientos_almacen`, `bot_pacientes`, `bot_auditoria`.
- Observaciones tecnicas: venta usa transaccion SQL, bloqueo `FOR UPDATE`, valida stock producto, consume lotes FEFO por vencimiento y almacen, registra kardex y movimiento de almacen.
- Riesgos o pendientes: `GET /api/v1/ventas/:id` hace `JOIN bot_productos`; si detalle es servicio sin producto, puede no devolver esa linea. Pendiente confirmar impacto.

### Caja

- Estado: implementado.
- Archivos principales: `/backend-fastify/src/routes/caja.routes.ts`, `/frontend/src/pages/caja-page.tsx`.
- Rutas frontend relacionadas: `/panel/caja`.
- Endpoints backend relacionados: `GET /api/v1/caja`, `POST /api/v1/caja`.
- Tablas relacionadas: `bot_caja`, `bot_ventas`, `bot_usuarios`, `bot_auditoria`.
- Observaciones tecnicas: POST usa acciones abrir/cerrar; consulta ventas del dia y estado de caja.
- Riesgos o pendientes: proteccion backend solo `requireAuth`; permisos finos dependen mas del frontend.

### Compras

- Estado: implementado.
- Archivos principales: `/backend-fastify/src/routes/purchases.routes.ts`, `/frontend/src/pages/compras-page.tsx`.
- Rutas frontend relacionadas: `/panel/compras`.
- Endpoints backend relacionados: `GET /api/v1/compras`, `POST /api/v1/compras`.
- Tablas relacionadas: `bot_compras`, `bot_compras_det`, `bot_productos`, `bot_proveedores`, `bot_lotes`, `bot_kardex`, `bot_movimientos_almacen`, `bot_almacenes`, `bot_auditoria`.
- Observaciones tecnicas: compra requiere proveedor, factura, numero documento, almacen destino, items, lote y vencimiento por item. Inserta cabecera/detalle, sube stock, registra kardex y upsert de lotes.
- Riesgos o pendientes: solo permite `FACTURA` por migracion y validacion actual.

### Reportes

- Estado: implementado parcialmente.
- Archivos principales: `/backend-fastify/src/routes/reports.routes.ts`, `/frontend/src/pages/reportes-page.tsx`.
- Rutas frontend relacionadas: `/panel/reportes`.
- Endpoints backend relacionados: `GET /api/v1/reportes`.
- Tablas relacionadas: `bot_productos`, `bot_ventas`, `bot_compras`, otras segun tipo.
- Observaciones tecnicas: endpoint unico con query `tipo`.
- Riesgos o pendientes: cobertura de tests no detectada para reportes.

### Autenticacion externa

- Estado: implementado parcialmente.
- Archivos principales: `/frontend/src/lib/clerk-provider.tsx`, `/frontend/src/context/auth-bridge.tsx`, `/frontend/src/pages/clerk-test-page.tsx`, `/frontend/src/pages/clerk-login-page.tsx`, `/backend-fastify/src/routes/auth.routes.ts`, `/backend-fastify/src/routes/users.routes.ts`.
- Rutas frontend relacionadas: `/auth/clerk`, `/login/clerk`.
- Endpoints backend relacionados: `POST /api/v1/auth/clerk-sync`, `GET/POST/DELETE /api/v1/usuarios/:id/clerk-link`.
- Tablas relacionadas: `bot_usuarios.cclerk_user_id` esperado por codigo.
- Observaciones tecnicas: backend verifica JWT Clerk RS256 con JWKS remoto y opcional issuer.
- Riesgos o pendientes: columna `cclerk_user_id` no existe en DB local consultada. Requiere aplicar migracion 014 antes de activar Clerk real.

### Integracion con Clerk

- Estado: implementado parcialmente.
- Archivos principales: ver modulo anterior.
- Observaciones tecnicas: frontend no crashea si `VITE_CLERK_PUBLISHABLE_KEY` falta; `AuthBridge` declara modo oficial `local`.
- Riesgos o pendientes: dependencia backend en `CLERK_JWKS_URL` y `CLERK_JWT_ISSUER`; sin JWKS, `clerk-sync` rechaza token.

### Integracion con Supabase

- Estado: legacy/no activo.
- Archivos principales: `/backend-fastify/supabase/*.sql`, `/backend-fastify/_draft/*.ts`, `/docs/migrations/schema_farmacia_completo.sql`, `/backend-fastify/README.md`.
- Observaciones tecnicas: backend actual no instala `@supabase/supabase-js` ni registra plugin Supabase. README backend aun dice "Fastify + Supabase" y parece desactualizado.
- Riesgos o pendientes: no usar drafts Supabase sin migrarlos; imports fallarian porque la dependencia no esta en `package.json`.

### Otros modulos detectados

- Medicos: implementado (`/backend-fastify/src/routes/doctors.routes.ts`, `/frontend/src/pages/medicos-page.tsx`, `bot_medicos`).
- Procedimientos/servicios: implementado parcial (`/backend-fastify/src/routes/services.routes.ts`, `/frontend/src/pages/procedures-page.tsx`, `bot_servicios`).
- Pacientes/historial/recetas: implementado parcial (`patients.routes.ts`, `histories.routes.ts`, `prescriptions.routes.ts`, tablas clinicas `bot_pacientes`, `bot_historial`, `bot_recetas`, `bot_recetas_det`).
- Transferencias: implementado legacy/simple (`transfers.routes.ts`, `bot_transferencias`, `bot_transferencias_det`) y traslado real por almacenes (`traslados-almacen.routes.ts`, `bot_movimientos_almacen`).
- Traslados/devoluciones: implementado (`/panel/traslados-almacen`, `/panel/devoluciones`, `traslados-almacen.routes.ts`).
- Alquileres: implementado (`rentals.routes.ts`, `bot_alquileres`).
- Deudores: implementado (`debtors.routes.ts`, `bot_deudores`).
- Inventario variado: implementado (`misc-inventory.routes.ts`, `bot_inventario_var`).
- Auditoria: implementado (`audit.routes.ts`, `bot_auditoria`).
- Locales/almacenes: implementado (`locales.routes.ts`, `almacenes.routes.ts`, `bot_locales`, `bot_almacenes`).
- MCP server: implementado como auxiliar, pero tiene herramientas que pueden escribir directo en DB y no pasan por permisos Fastify.

## 5. Flujo de autenticacion actual

1. Usuario abre `/`.
2. `LoginPage` usa `AuthProvider.signIn()`.
3. Frontend llama `apiLogin(dni, clave)` en `/frontend/src/lib/api.ts`.
4. API envia `POST /api/v1/auth/login` con `{ dni, clave }`.
5. Backend valida DNI de 8 digitos y clave no vacia en `/backend-fastify/src/routes/auth.routes.ts`.
6. Backend busca usuario activo en `bot_usuarios` por `cnrodni`.
7. Backend compara clave con `bcrypt.compare(clave, row.cclave.trim())`.
8. Backend arma usuario con `buildAuthUser()` desde `/backend-fastify/src/plugins/auth.ts`, cargando permisos desde `bot_permisos`.
9. Backend firma JWT con `reply.jwtSign(user)`.
10. Backend guarda cookie httpOnly `botica_token` y tambien devuelve `token`.
11. Frontend guarda token en `localStorage` bajo `botica_fastify_token`.
12. Cliente API manda `credentials: 'include'` y header `Authorization: Bearer <token>` si existe.
13. `RequireAuth` protege `/panel`; `RequireSection` protege secciones frontend.
14. Backend protege rutas con `fastify.requireAuth`, que acepta cookie `botica_token` o bearer token.
15. Logout usa `POST /api/v1/auth/logout`, limpia cookie y frontend remueve `botica_fastify_token`.

Roles/permisos:

- `lsuper`: acceso total; frontend y backend lo tratan como superusuario.
- `ladmin`: acceso administrativo amplio; puede gestionar usuarios salvo otorgar admin si no es super.
- `bot_permisos.cseccion`: secciones permitidas; frontend usa `AppSection`.
- Backend tiene helper `requireAnyPermission()`, pero no todos los endpoints lo usan.

JWT local:

- Existe y es modo oficial actual.
- `JWT_SECRET` es obligatorio en produccion y debe medir al menos 32 caracteres.
- En desarrollo puede usar fallback `botica-fastify-local-secret`.

Clerk:

- Coexiste como integracion parcial.
- Frontend activa `ClerkProvider` solo si `VITE_CLERK_PUBLISHABLE_KEY` existe.
- Backend verifica token Clerk en `POST /api/v1/auth/clerk-sync`.
- Backend espera `bot_usuarios.cclerk_user_id`.
- DB local no tiene `cclerk_user_id`; pendiente aplicar migracion 014.

## 6. Flujo de ventas e inventario

Registro de venta:

- Frontend POS vive en `/frontend/src/pos` y pagina `/frontend/src/pages/sales-page.tsx`.
- Cliente API usa `apiPOSCrearVenta()` o `apiAddSale()` hacia `POST /api/v1/ventas`.
- Backend `/backend-fastify/src/routes/sales.routes.ts` requiere auth y permiso `ventas`.
- Se resuelve `almacenId`: usa el enviado o primer `bot_almacenes` activo con `bpermite_venta = TRUE`.
- Inicia transaccion con `BEGIN`.
- Genera codigo `VTA-YYYYMMDD-XXXX`.
- Inserta cabecera en `bot_ventas`.
- Por cada item producto:
  - bloquea producto con `SELECT ... FROM bot_productos ... FOR UPDATE`;
  - valida `nstock >= cantidad`;
  - busca lotes activos/vigentes del producto en almacen, ordenados por `dfechavencimiento ASC, tcreado ASC`;
  - consume FEFO, incluso multiples lotes por item si hace falta;
  - inserta detalle en `bot_ventas_det` con lote primario;
  - descuenta `bot_productos.nstock`;
  - actualiza `bot_lotes.ncantidad` y `cestado`;
  - registra `bot_kardex`;
  - registra `bot_movimientos_almacen`.
- Inserta auditoria `VENTA`.
- Confirma `COMMIT`.

Descuento inventario:

- Con lotes: `bot_lotes` baja por FEFO y `bot_productos.nstock` baja como total agregado.
- Sin lotes: valida vencimiento `bot_productos.tvencimien` y registra kardex a nivel producto.
- FEFO: si existen lotes, usa First Expired First Out por fecha de vencimiento ascendente.
- Lotes: `bot_lotes` contiene `nproducto_id`, `nalmacen_id`, `ccodigo_lote`, `dfechavencimiento`, `ncantidad`, `cestado`, `nversion`.
- Stock: stock total en `bot_productos.nstock`; stock por almacen/lote en `bot_lotes`; vista `vw_stock_por_almacen`.

Validaciones:

- Total > 0.
- Usuario autenticado.
- Permiso `ventas`.
- Almacen existe, activo y permite venta.
- Producto activo.
- Stock producto suficiente.
- Lotes vigentes suficientes si existen.
- Producto vencido bloqueado si no hay lotes y `tvencimien` vencida.

SQL/ORM:

- Ventas usa SQL crudo con transacciones `pg`.
- Inventario alta/edicion/busqueda simple usa Drizzle parcial.
- Compras usa SQL crudo por compatibilidad de tests.

Anulacion:

- `PATCH /api/v1/ventas/:id/anular`.
- Requiere permiso `ventas` y ademas `admin` o `super`.
- Bloquea venta, marca `cestado = 'C'`.
- Revierte `bot_productos.nstock`.
- Restaura lotes consumidos segun `bot_kardex`.
- Registra kardex `ANULACION_VENTA`, movimiento `DEVOLUCION_CLIENTE` y auditoria.

## 7. API backend

Prefijo general: `/api/v1`. Health fuera de prefijo: `/health`, `/health/live`, `/health/ready`.

### Auth

- `POST /api/v1/auth/login` - `/backend-fastify/src/routes/auth.routes.ts`; login DNI/clave; no requiere sesion; rate limit local.
- `POST /api/v1/auth/logout` - limpia cookie; no requiere sesion estricta.
- `GET /api/v1/auth/session` - valida cookie/bearer y devuelve usuario.
- `POST /api/v1/auth/clerk-sync` - verifica JWT Clerk y crea sesion local; requiere `CLERK_JWKS_URL`; depende de `bot_usuarios.cclerk_user_id`.

### Usuarios

- `GET /api/v1/usuarios` - lista usuarios y permisos; requiere auth y admin/super.
- `POST /api/v1/usuarios` - acciones `crear`, `actualizar`, `activar`, `desactivar`, `resetClave`; requiere auth y admin/super.
- `GET /api/v1/usuarios/:id/clerk-link` - estado vinculo Clerk; requiere admin/super.
- `POST /api/v1/usuarios/:id/clerk-link` - vincula `clerkUserId`; requiere admin/super.
- `DELETE /api/v1/usuarios/:id/clerk-link` - desvincula Clerk; requiere admin/super.

### Productos / Inventario

- `GET /api/v1/inventario` - lista productos activos con lotes agregados; requiere auth.
- `POST /api/v1/inventario` - crea/actualiza producto; requiere permisos `inventario` o `almacenes`.
- `GET /api/v1/inventario/search` - busqueda POS/productos; requiere auth.
- `GET /api/v1/inventario/distribucion` - stock por producto/almacen/lote; requiere auth.
- `GET /api/v1/lotes` - lista lotes filtrados; requiere auth.
- `GET /api/v1/lotes/disponibles/:productoId` - lotes disponibles; requiere auth.
- `GET /api/v1/lotes/fefo/:productoId` - lote FEFO sugerido; requiere auth.
- `GET /api/v1/lotes/consistencia` - consistencia producto/lotes; requiere auth.
- `GET /api/v1/kardex` - lista movimientos; requiere auth.
- `GET /api/v1/kardex/:id` - detalle movimiento; requiere auth.
- `POST /api/v1/kardex/ajuste` - ajuste kardex; requiere auth.
- `GET /api/v1/kardex/resumen/:productoId` - resumen kardex; requiere auth.
- `POST /api/v1/ajustes/ajustes` - ajuste lote/producto; requiere auth. Nota: frontend llama `/api/v1/ajustes`, desalineado.

### Ventas

- `GET /api/v1/ventas` - lista ventas; requiere auth.
- `POST /api/v1/ventas` - crea venta POS con FEFO; requiere permiso `ventas`.
- `PATCH /api/v1/ventas/:id/anular` - anula venta y revierte stock; requiere permiso `ventas` y admin/super.
- `GET /api/v1/ventas/:id` - detalle venta; requiere auth.

### Caja

- `GET /api/v1/caja` - estado caja, ventas y resumen; requiere auth.
- `POST /api/v1/caja` - acciones abrir/cerrar; requiere auth.

### Compras

- `GET /api/v1/compras` - lista compras y detalles; requiere auth.
- `POST /api/v1/compras` - registra compra con lote y almacen destino; requiere permiso `compras`.

### Proveedores

- `GET /api/v1/proveedores` - lista/busca proveedores; requiere auth.
- `POST /api/v1/proveedores` - crea/actualiza/desactiva proveedor; requiere permiso `proveedores`.

### Pacientes / Clinica

- `GET /api/v1/pacientes` - lista pacientes; requiere auth.
- `POST /api/v1/pacientes` - crea paciente; requiere auth.
- `GET /api/v1/historial` - historial por paciente; requiere auth.
- `POST /api/v1/historial` - crea historial; requiere auth.
- `GET /api/v1/recetas` - lista recetas; requiere auth.
- `POST /api/v1/recetas` - crea receta; requiere auth.
- `GET /api/v1/citas` - lista citas; requiere auth.
- `POST /api/v1/citas` - crea cita; requiere auth.
- `GET /api/v1/medicos` - lista medicos; requiere auth.
- `POST /api/v1/medicos` - crea/actualiza/fusiona medicos; requiere auth.

### Servicios / Procedimientos

- `GET /api/v1/servicios` - lista servicios; requiere auth.
- `POST /api/v1/servicios` - crea/actualiza servicio; requiere auth.

### Locales / Almacenes / Movimientos

- `GET /api/v1/locales` - lista locales; requiere auth.
- `POST /api/v1/locales` - crea/actualiza local; requiere auth.
- `GET /api/v1/almacenes` - lista almacenes; requiere auth.
- `POST /api/v1/almacenes` - crea/actualiza almacen; requiere auth.
- `GET /api/v1/almacenes/stock` - stock por almacen; requiere auth.
- `POST /api/v1/traslados-almacen` - traslado entre almacenes; requiere permisos `traslados-almacen`, `transferencias` o `almacenes`.
- `GET /api/v1/traslados-almacen` - lista movimientos; requiere auth.
- `POST /api/v1/traslados-almacen/devolucion-cliente` - devolucion cliente; requiere permisos `devoluciones`, `traslados-almacen` o `almacenes`.
- `POST /api/v1/traslados-almacen/devolucion-proveedor` - devolucion proveedor; requiere permisos `devoluciones`, `traslados-almacen` o `almacenes`.
- `GET /api/v1/transferencias` - lista transferencias legacy/simple; requiere auth.
- `POST /api/v1/transferencias` - crea transferencia legacy/simple; requiere auth.

### Consistencia / Alertas

- `GET /api/v1/consistencia/stock` - compara `bot_productos.nstock` vs lotes; requiere auth.
- `GET /api/v1/consistencia/lotes` - lotes vencidos/sin almacen/inconsistentes; requiere auth.
- `GET /api/v1/consistencia/kardex` - revision kardex; requiere auth.
- `GET /api/v1/consistencia/resumen` - resumen general; requiere auth.
- `POST /api/v1/consistencia/reconciliar` - corrige stock desde lotes; requiere permisos `consistencia` o `auditoria`.
- `POST /api/v1/consistencia/marcar-vencidos` - marca lotes vencidos; requiere permisos `consistencia` o `auditoria`.
- `GET /api/v1/consistencia/alertas` - alertas de vencimiento/cuarentena/baja/stock fantasma; requiere auth.
- `GET /api/v1/system/schema-status` - schema check backend; requiere auth.

### Otros

- `GET /api/v1/dashboard` - metricas; requiere auth.
- `GET /api/v1/reportes` - reportes por `tipo`; requiere auth.
- `GET /api/v1/auditoria` - auditoria paginada/filtrada; requiere auth.
- `GET /api/v1/perfil` - datos usuario; requiere auth.
- `POST /api/v1/perfil` - actualizar perfil/cambiar clave; requiere auth.
- `GET /api/v1/alquileres` / `POST /api/v1/alquileres` - alquileres; requiere auth.
- `GET /api/v1/deudores` / `POST /api/v1/deudores` - deudores y abonos; requiere auth.
- `GET /api/v1/inventario-var` / `POST /api/v1/inventario-var` - inventario variado; requiere auth.

## 8. Frontend

- Framework: React 19 + Vite 8 + TypeScript.
- Sistema de rutas: `createBrowserRouter` en `/frontend/src/app/router.tsx`.
- Layout principal: `/frontend/src/components/layout/app-shell.tsx`.
- Guards: `/frontend/src/app/access-guards.tsx`.
- Providers: `/frontend/src/lib/providers.tsx` monta `ClerkBridgeProvider`, `AuthProvider`, `AppDataProvider` y `Toaster`.
- Clerk wrapper: `/frontend/src/lib/clerk-provider.tsx`.
- Componentes comunes:
  - UI: `button`, `input`, `select`, `card`, `dialog`, `table`, `badge`, etc.
  - Shared: `page-header`, `metric-card`, `brand-logo`, `login-card`, `auth-cta`, `app-error-boundary`.
  - Clerk: `ClerkSignInButton`, `ClerkStatusBadge`, `ClerkUserCard`.
- Paginas principales:
  - `dashboard-page`, `inventory-page`, `sales-page`, `caja-page`, `compras-page`, `proveedores-page`, `patients-page`, `procedures-page`, `medicos-page`, `reportes-page`, `transferencias-page`, `alquileres-page`, `deudores-page`, `inventario-var-page`, `auditoria-page`, `usuarios-page`, `perfil-page`, `locales-page`, `almacenes-page`, `traslados-almacen-page`, `devoluciones-page`, `consistencia-page`, `alertas-page`.
- Servicios/API client: `/frontend/src/lib/api.ts` centraliza funciones `api*`.
- Estado:
  - Auth: `/frontend/src/context/auth-context.tsx`.
  - App data: `/frontend/src/context/app-data-context.tsx`.
  - POS: `/frontend/src/pos/hooks/usePOS.ts`.
- Loading/errores:
  - `RequireAuth` muestra "Verificando sesion...".
  - Cliente API convierte errores HTTP en `Error`.
  - Sonner se usa para feedback en UI.
  - `AppErrorBoundary` cubre errores de render.
- Tests frontend:
  - `/frontend/src/pos/utils/posUtils.test.ts`
  - `/frontend/src/pos/hooks/usePOS.test.ts`
  - `/frontend/src/pos/components/Cart.test.tsx`
  - `/frontend/src/pages/compras-page.test.tsx`

## 9. Backend

- Entry point: `/backend-fastify/src/server.ts`.
- Plugins:
  - `/backend-fastify/src/plugins/db.ts`: pool `pg`.
  - `/backend-fastify/src/plugins/drizzle.ts`: Drizzle sobre pool existente.
  - `/backend-fastify/src/plugins/auth.ts`: `requireAuth`, `buildAuthUser`, permisos.
  - `/backend-fastify/src/plugins/error-handler.ts`: `AppError`, `ValidationError`, handler central.
- Rutas: archivos `*.routes.ts` en `/backend-fastify/src/routes`.
- Controladores/servicios: no hay capa controller/service uniforme activa; la mayoria de logica esta dentro de rutas. `/backend-fastify/src/services` no contiene archivos activos detectados; `_draft` contiene servicios legacy.
- Repositorios: no hay capa repositorio separada.
- Middlewares: Fastify hooks/plugins y `preHandler`.
- Validaciones: manuales con checks por ruta; Zod no estandarizado en rutas activas.
- Manejo de errores: error handler custom para `AppError`, Zod, errores DB `42703`/`42P01`, errores PGRST/SQL y 500 generico.
- Acceso DB: `fastify.db.query` SQL crudo; `fastify.drizzle` parcial.
- Tests: Vitest con app mock y clientes mock en `/backend-fastify/src/__tests__/helpers/buildTestApp.ts`.

## 10. Base de datos

Tablas principales reales:

- `bot_usuarios`: DNI, nombre, clave bcrypt, rol, estado, flags `lsuper`/`ladmin`, contacto. DB local no tiene `cclerk_user_id`.
- `bot_permisos`: permisos por usuario y seccion, unique `(nusuario_id, cseccion)`.
- `bot_productos`: catalogo, precios, stock total, proveedor, vencimiento, receta, estado.
- `bot_lotes`: stock por lote y almacen, vencimiento, estado, version.
- `bot_kardex`: movimientos de stock por producto/lote/almacen/ref.
- `bot_movimientos_almacen`: movimientos fisicos por origen/destino/lote.
- `bot_ventas`, `bot_ventas_det`: ventas y detalle producto/servicio/lote.
- `bot_compras`, `bot_compras_det`: compras y detalle.
- `bot_proveedores`: proveedores.
- `bot_pacientes`, `bot_historial`, `bot_recetas`, `bot_recetas_det`, `bot_citas`, `bot_medicos`: modulo clinico.
- `bot_caja`: apertura/cierre caja.
- `bot_locales`, `bot_almacenes`: estructura multi-local/multi-almacen.
- `bot_auditoria`: auditoria.
- `bot_servicios`, `bot_transferencias`, `bot_transferencias_det`, `bot_alquileres`, `bot_deudores`, `bot_inventario_var`: modulos complementarios.

Relaciones importantes reales:

- `bot_permisos.nusuario_id -> bot_usuarios.nid`
- `bot_auditoria.nusuario_id -> bot_usuarios.nid`
- `bot_ventas.nusuario_id -> bot_usuarios.nid`
- `bot_ventas.ncliente_clinico_id -> bot_pacientes.nid`
- `bot_ventas.nalmacen_id -> bot_almacenes.nid`
- `bot_ventas_det.nventa_id -> bot_ventas.nid`
- `bot_ventas_det.nproducto_id -> bot_productos.nid`
- `bot_ventas_det.nlote_id -> bot_lotes.nid`
- `bot_ventas_det.nservicio_id -> bot_servicios.nid`
- `bot_compras.nproveedor_id -> bot_proveedores.nid`
- `bot_compras.nalmacen_id -> bot_almacenes.nid`
- `bot_compras_det.ncompra_id -> bot_compras.nid`
- `bot_compras_det.nproducto_id -> bot_productos.nid`
- `bot_lotes.nproducto_id -> bot_productos.nid`
- `bot_lotes.ncompra_id -> bot_compras.nid`
- `bot_lotes.nalmacen_id -> bot_almacenes.nid`
- `bot_kardex.nproducto_id -> bot_productos.nid`
- `bot_kardex.nlote_id -> bot_lotes.nid`
- `bot_kardex.nalmacen_id -> bot_almacenes.nid`
- `bot_almacenes.nlocal_id -> bot_locales.nid`
- `bot_movimientos_almacen.nproducto_id -> bot_productos.nid`
- `bot_movimientos_almacen.nlote_id -> bot_lotes.nid`
- `bot_movimientos_almacen.nalmacen_origen_id/nalmacen_destino_id -> bot_almacenes.nid`

Indices relevantes reales:

- `bot_productos`: unique `ccodigo`, indexes `cestado`, `tvencimien`, check `nstock_no_negativo`.
- `bot_lotes`: `idx_bot_lotes_fefo (nproducto_id, dfechavencimiento)` parcial para activos con cantidad > 0; indices por compra, producto/estado, vencimiento y almacen.
- `bot_kardex`: indices por producto/fecha, lote, tipo, referencia, almacen.
- `bot_ventas`: unique `ccodigo`, indices fecha, estado, almacen, cliente clinico.
- `bot_compras`: unique `ccodigo`, indices fecha, tipo comprobante, almacen.
- `bot_permisos`: unique usuario/seccion.
- `bot_proveedores`: unique condicional `ux_bot_proveedores_cruc`.
- `bot_medicos`: unique condicional `ux_bot_medicos_ccmp`.
- `bot_servicios`: unique condicional por nombre/categoria activo.

Migraciones:

- Activas/incrementales: `/ops/migrations/002_nstock_constraint.sql` a `/ops/migrations/014_usuarios_clerk_link.sql`.
- Hay dos archivos con prefijo `006`: `006_migrar_stock_a_lotes.sql` y `006_deduplicate_entities.sql`; orden exacto pendiente por confirmar.
- `start.sh` intenta aplicar archivos raiz `schema_farmacia_completo.sql` y `fix_database.sql`, pero en repo esos archivos estan en `/docs/migrations`. Si una DB nueva no existe, esto puede fallar.

Seeds/datos iniciales:

- Locales/almacenes default: `/ops/migrations/010_locales_almacenes.sql`.
- Tipos movimiento legacy: `/docs/migrations/fix_database.sql`.
- Superusuario documentado: DNI `00000000` / clave `12345678`; fuente de seed exacta en migraciones `bot_*` no encontrada en esta auditoria.

Posibles inconsistencias detectadas:

- `bot_usuarios.cclerk_user_id` esperado por codigo, no presente en DB local.
- `kardex` y `tipos_movimiento` sin prefijo coexisten con `bot_kardex`.
- Docs Supabase y schema `productos/lotes/ventas` sin prefijo no representan backend actual `bot_*`.
- Drizzle schema no cubre todas las tablas/campos reales y tiene diferencias de nombres con DB local en algunos puntos historicos.

## 11. Tests y validaciones

Dependencias:

- `/frontend/node_modules` existe; no se ejecuto `npm install`.
- `/backend-fastify/node_modules` existe; no se ejecuto `npm install`.

Backend:

- `npm run typecheck`: falla porque no existe script `typecheck`.
- `npm run build`: OK. Ejecuta `tsc`.
- `npm test`: OK. 9 archivos, 81 tests pasados.
- `npm run lint`: falla. ESLint 9 no encuentra `eslint.config.(js|mjs|cjs)` en `/backend-fastify`.

Backend tests cubiertos detectados:

- `schema-check.test.ts`
- `catalogos-compras.test.ts`
- `users.test.ts`
- `sales.test.ts`
- `purchases.test.ts`
- `traslados-almacen.test.ts`
- `consistencia.test.ts`
- `providers.test.ts`
- `kardex.test.ts`

Frontend:

- `npm run typecheck`: falla porque no existe script `typecheck`.
- `npm run build`: OK. Ejecuta `tsc -b && vite build`.
- `npm test`: OK. 4 archivos, 49 tests pasados. Hay warnings React `act(...)` en `usePOS.test.ts`.
- `npm run lint`: falla con 10 errores.

Errores lint frontend actuales:

- `/frontend/src/lib/api.ts`: `_token` no usado; `any` en lineas relacionadas a consistencia.
- `/frontend/src/pages/ajustes-page.tsx`: variable `error` no usada.
- `/frontend/src/pages/inventory-page.tsx`: expresion sin asignacion/llamada.
- `/frontend/src/pages/traslados-almacen-page.tsx`: usos de `any`.
- `/frontend/src/pos/components/PaymentPanel.tsx`: uso de `any`.
- `/frontend/src/pos/utils/posUtils.ts`: uso de `any`.
- `/frontend/vitest.config.ts`: cast `any`.

Build frontend:

- OK, con warning Vite: chunk JS `676.49 kB` supera 500 kB; recomienda code-splitting/dynamic import o ajustar limite.

Modulos sin tests detectados o no evidentes:

- Frontend: muchas paginas fuera de POS/compras no tienen tests.
- Backend: caja, dashboard, reportes, auditoria, pacientes, medicos, perfil, locales, almacenes, alquileres, deudores, inventario-var, transferencias legacy, auth login real no tienen tests dedicados detectados.

## 12. Variables de entorno

No se listan valores secretos reales. Variables detectadas:

- `NODE_ENV`: entorno backend. Obligatoria en produccion para activar checks estrictos; usada en `/backend-fastify/src/server.ts`.
- `PORT`: puerto backend Fastify. Default `3000`; usado en server.
- `HOST`: host backend. Default `127.0.0.1`; usado en server.
- `LOG_LEVEL`: nivel logger. Default `info`; usado en server.
- `TRUST_PROXY`: habilita trust proxy. Relevante en produccion/proxy.
- `BOTICA_DB_HOST`: host PostgreSQL. Usada en backend, drizzle, scripts, start.
- `BOTICA_DB_PORT`: puerto PostgreSQL. Usada en backend, drizzle, scripts, start.
- `BOTICA_DB_NAME`: nombre DB. Usada en backend, drizzle, scripts, start.
- `BOTICA_DB_USER`: usuario DB. Usada en backend, drizzle, scripts, start.
- `BOTICA_DB_PASS`: password DB. Usada en backend, drizzle, scripts, start.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`: aliases backend/MCP.
- `JWT_SECRET`: secreto JWT. Obligatoria en produccion, minimo 32 chars; usada en server.
- `CLERK_JWKS_URL`: JWKS Clerk para validar tokens RS256. Obligatoria para `clerk-sync`.
- `CLERK_JWT_ISSUER`: issuer esperado Clerk. Opcional recomendado.
- `CORS_ORIGIN`: origenes permitidos backend. Obligatoria en produccion.
- `SENTRY_DSN`: observabilidad opcional.
- `SENTRY_ENVIRONMENT`: observabilidad opcional.
- `VITE_API_URL`: documentada en frontend `.env.example`, pero cliente actual usa ruta relativa `/api/v1`; pendiente confirmar uso real.
- `VITE_CLERK_PUBLISHABLE_KEY`: activa Clerk en frontend.
- `VITE_SENTRY_DSN`: observabilidad frontend opcional.
- `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`: hosts extra para Vite/proxy/tunnel.
- `BOTICA_BACKEND_PORT`: puerto PHP legacy en `start.sh`.
- `BOTICA_FASTIFY_PORT`: puerto Fastify en `start.sh`.
- `BOTICA_FRONTEND_PORT`: puerto Vite en `start.sh`.
- `BOTICA_ENABLE_PHP_LEGACY`: activa backend PHP legacy opcional. Carpeta `/backend` no encontrada.
- `BOTICA_CORS_ORIGIN`: usado por `start.sh` para exportar `CORS_ORIGIN`.
- `BOTICA_PG_BIN`: ruta binarios PostgreSQL para `start.sh`.
- `BOTICA_PG_DATA`: data dir PostgreSQL para `start.sh`.
- `BOTICA_FASTIFY_ENV_FILE`: `.env` backend alternativo para `start.sh`.
- `BOTICA_VERBOSE_STARTUP`: verbose de limpieza PostgreSQL en `start.sh`.
- `BOTICA_BACKUP_DIR`: directorio backups.
- `BACKUP_DIR`, `RETENTION_DAYS`, `VERIFY_BACKUP`: scripts backup.
- `API_BASE`: base URL para cron jobs.
- `DRY_RUN`: dry run en crons.
- `BOTICA_ADMIN_TOKEN`: token para crons.
- `BOTICA_JOB_DNI`, `BOTICA_JOB_CLAVE`: credenciales cron si no hay token.
- `BOTICA_NODE_BIN`, `BOTICA_NPM_BIN`: binarios para MCP run script.

## 13. Codigo legacy o pendiente de migrar

- `/backend-fastify/_draft`: legacy/draft Supabase. Contiene `clinical.service.ts`, `clinical.routes.ts`, `kardex.service.ts`, `kardex.routes.ts`, `schemas.index.ts`. Importa `@supabase/supabase-js`, no instalado. No activo en `server.ts`.
- `/backend-fastify/supabase`: SQL/RPC Supabase para funciones y vistas. No activo en backend Fastify actual.
- `/docs/migrations/schema_farmacia_completo.sql`: schema antiguo completo sin prefijo `bot_*`, con Supabase/RLS/auth.users. Sirve como referencia historica, no coincide con DB real activa.
- `/docs/migrations/fix_database.sql`: fix rapido crea tablas `kardex` y `tipos_movimiento` sin prefijo; puede explicar tablas legacy reales.
- `/backend-fastify/README.md`: desactualizado; describe Fastify + Supabase, endpoints antiguos y RPC, mientras backend actual usa `pg`/Drizzle y tablas `bot_*`.
- `start.sh`: referencia backend PHP legacy y archivos SQL raiz que no existen. PHP legacy esta deshabilitado por default y carpeta `/backend` no existe.
- `/docs/context/contexto_botica.md`: documento viejo menciona backend PHP procedural y estructura `/backend`; ya no refleja repo actual.
- `/mcp-server`: auxiliar activo posible, pero opera directo contra DB y algunas herramientas escriben stock sin pasar por API Fastify ni trazabilidad moderna completa. Riesgo de usarlo en produccion sin revisar.
- `/frontend/dist`, `/backend-fastify/dist`, `/mcp-server/dist`: builds generados; no son fuente principal.

Riesgo de eliminar:

- `_draft` y `supabase` parecen removibles solo despues de confirmar que nadie los usa como referencia de migracion.
- Docs legacy no deberian borrarse sin consolidar conocimiento historico.
- `mcp-server` no es legacy claro; es herramienta auxiliar, pero requiere revision de permisos/alcance.

## 14. Riesgos tecnicos actuales

- Clerk roto en DB local: codigo espera `bot_usuarios.cclerk_user_id`, pero columna no existe en DB consultada.
- Ruta ajustes desalineada: frontend llama `POST /api/v1/ajustes`; backend expone `POST /api/v1/ajustes/ajustes`.
- `start.sh` referencia `schema_farmacia_completo.sql` y `fix_database.sql` en raiz, pero existen en `/docs/migrations`; una DB nueva puede no inicializar.
- Backend lint no ejecuta por falta de `eslint.config.*`.
- Frontend lint falla con 10 errores.
- No existe script `typecheck` ni en backend ni en frontend, aunque el build ejecuta TypeScript.
- Documentacion backend esta parcialmente desactualizada y aun habla de Supabase activo.
- Varios endpoints mutadores no aplican permisos finos, solo `requireAuth`.
- Logica critica vive dentro de rutas grandes, especialmente ventas/compras/traslados; hay poca separacion servicio/repositorio.
- SQL crudo domina modulos criticos; algunas operaciones tienen transacciones, otras mutaciones simples no siempre.
- MCP server puede modificar DB directo, saltando auth/permisos/auditoria API.
- `bot_productos.nstock` y `bot_lotes` duplican fuente de stock; existe modulo consistencia, pero requiere ejecucion/monitoreo.
- Hay tablas legacy `kardex`/`tipos_movimiento` paralelas a `bot_kardex`.
- Frontend bundle principal grande >500 kB.
- Tests cubren flujo critico parcial, pero no todos los modulos de UI/backend.
- Migraciones no tienen runner unificado evidente; `/ops/migrations` existe, pero `start.sh` no aplica esa carpeta.

## 15. Pendientes recomendados

### Alta prioridad

- Aplicar o validar migracion `/ops/migrations/014_usuarios_clerk_link.sql` si se va a usar Clerk; o desactivar UI/endpoints Clerk hasta alinear DB.
- Corregir mismatch de ajustes: frontend `/api/v1/ajustes` vs backend `/api/v1/ajustes/ajustes`.
- Arreglar `start.sh` para usar SQL real en `/docs/migrations` o un runner de `/ops/migrations`, y evitar falla en DB nueva.
- Decidir fuente oficial de migraciones y documentar orden. Resolver doble `006`.
- Agregar config ESLint backend o corregir script.
- Corregir lint frontend antes de fase estable.

### Media prioridad

- Estandarizar permisos backend por modulo, no depender solo del frontend.
- Extraer logica de ventas/compras/traslados a servicios testeables.
- Agregar tests para auth real, caja, dashboard, reportes, pacientes, medicos, locales/almacenes y perfil.
- Consolidar Drizzle o documentar donde se mantiene SQL crudo.
- Actualizar `/backend-fastify/README.md` y docs legacy para evitar confusion Supabase/PHP.
- Revisar MCP server y limitarlo a solo lectura o agregar trazabilidad/permisos.

### Baja prioridad

- Code-splitting frontend para bajar bundle principal.
- Limpiar builds generados si no deben versionarse.
- Consolidar docs/reportes historicos en un indice unico.
- Revisar nombres mixtos cliente/paciente y normalizar UX/API.
- Agregar script `typecheck` explicito en frontend/backend.

## 16. Estado para Jira

EPIC: Seguridad

- Tarea: Login JWT local
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/auth.routes.ts`, `/backend-fastify/src/plugins/auth.ts`, `/frontend/src/context/auth-context.tsx`
  - Pendiente: ampliar tests auth real y revisar expiracion/rotacion JWT.

- Tarea: Permisos backend por modulo
  - Estado sugerido: parcial
  - Archivos relacionados: `/backend-fastify/src/plugins/auth.ts`, rutas en `/backend-fastify/src/routes`
  - Pendiente: aplicar permisos finos a todos los mutadores relevantes.

- Tarea: Clerk sync
  - Estado sugerido: parcial/bloqueado por DB local
  - Archivos relacionados: `/backend-fastify/src/routes/auth.routes.ts`, `/backend-fastify/src/routes/users.routes.ts`, `/frontend/src/context/auth-bridge.tsx`, `/ops/migrations/014_usuarios_clerk_link.sql`
  - Pendiente: aplicar columna `cclerk_user_id`, configurar JWKS, probar flujo real.

EPIC: Productos

- Tarea: CRUD productos
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/inventory.routes.ts`, `/frontend/src/pages/inventory-page.tsx`
  - Pendiente: revisar generacion de codigo y tests de UI.

- Tarea: Busqueda POS
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/inventory.routes.ts`, `/frontend/src/pos/components/ProductSearch.tsx`
  - Pendiente: validar performance con catalogo grande.

EPIC: Inventario

- Tarea: Lotes FEFO
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/lotes.routes.ts`, `/backend-fastify/src/routes/sales.routes.ts`, `/ops/migrations/004_bot_lotes.sql`, `/ops/migrations/005_fefo.sql`
  - Pendiente: monitorear consistencia `nstock` vs lotes.

- Tarea: Ajustes de inventario
  - Estado sugerido: parcial/bloqueado por ruta
  - Archivos relacionados: `/backend-fastify/src/routes/ajustes.routes.ts`, `/frontend/src/pages/ajustes-page.tsx`, `/frontend/src/lib/api.ts`
  - Pendiente: corregir endpoint real.

- Tarea: Reconciliacion/alertas
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/consistencia.routes.ts`, `/scripts/cron-reconciliacion.sh`, `/scripts/cron-vencimientos.sh`
  - Pendiente: definir cron productivo y credenciales tecnicas.

EPIC: Ventas

- Tarea: POS con FEFO
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/sales.routes.ts`, `/frontend/src/pos`, `/frontend/src/pages/sales-page.tsx`
  - Pendiente: probar con multiples lotes reales y servicios.

- Tarea: Anulacion de ventas
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/sales.routes.ts`, `/frontend/src/lib/api.ts`
  - Pendiente: test end-to-end contra DB real.

EPIC: Compras

- Tarea: Registro de compra con lote/almacen
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/purchases.routes.ts`, `/frontend/src/pages/compras-page.tsx`
  - Pendiente: extender si se requieren boletas/guias ademas de factura.

EPIC: Caja

- Tarea: Apertura/cierre caja
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/caja.routes.ts`, `/frontend/src/pages/caja-page.tsx`
  - Pendiente: permisos backend finos y tests.

EPIC: Proveedores

- Tarea: CRUD proveedores
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/providers.routes.ts`, `/frontend/src/pages/proveedores-page.tsx`, `/ops/migrations/013_proveedores_ruc_unico_y_auditoria.sql`
  - Pendiente: validacion SUNAT si es requisito.

EPIC: Clientes y Clinica

- Tarea: Pacientes/clientes
  - Estado sugerido: implementado parcialmente
  - Archivos relacionados: `/backend-fastify/src/routes/patients.routes.ts`, `/frontend/src/pages/patients-page.tsx`
  - Pendiente: confirmar modelo final cliente generico vs paciente clinico.

- Tarea: Historial y recetas
  - Estado sugerido: implementado parcialmente
  - Archivos relacionados: `/backend-fastify/src/routes/histories.routes.ts`, `/backend-fastify/src/routes/prescriptions.routes.ts`
  - Pendiente: pruebas y conexion completa al POS.

EPIC: Almacenes

- Tarea: Locales/almacenes
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/locales.routes.ts`, `/backend-fastify/src/routes/almacenes.routes.ts`, `/ops/migrations/010_locales_almacenes.sql`
  - Pendiente: tests y permisos finos.

- Tarea: Traslados/devoluciones
  - Estado sugerido: implementado
  - Archivos relacionados: `/backend-fastify/src/routes/traslados-almacen.routes.ts`, `/frontend/src/pages/traslados-almacen-page.tsx`, `/frontend/src/pages/devoluciones-page.tsx`
  - Pendiente: corregir lint y validar escenarios reales.

EPIC: Calidad

- Tarea: Lint backend
  - Estado sugerido: pendiente
  - Archivos relacionados: `/backend-fastify/package.json`
  - Pendiente: agregar `eslint.config.js` o ajustar script.

- Tarea: Lint frontend
  - Estado sugerido: pendiente
  - Archivos relacionados: `/frontend/src/lib/api.ts`, `/frontend/src/pages/ajustes-page.tsx`, `/frontend/src/pages/inventory-page.tsx`, `/frontend/src/pages/traslados-almacen-page.tsx`, `/frontend/src/pos/*`, `/frontend/vitest.config.ts`
  - Pendiente: resolver 10 errores.

- Tarea: Migraciones unificadas
  - Estado sugerido: pendiente
  - Archivos relacionados: `/ops/migrations`, `/start.sh`, `/docs/migrations`
  - Pendiente: runner unico, orden claro, DB nueva reproducible.

## 17. Recomendacion final

- Estado general: proyecto avanzado y usable en desarrollo local para Fase 01 de ERP farmaceutico, con nucleo ventas-compras-inventario-lotes bastante maduro. Aun no esta limpio para handoff productivo sin corregir migraciones/rutas/lint/documentacion.
- Porcentaje estimado de avance: 75%.
- Bloqueadores: Clerk espera columna no aplicada; ajustes frontend/backend desalineado; `start.sh` no inicializa DB nueva con rutas SQL reales; backend lint roto por config faltante; frontend lint con errores.
- Siguiente mejor paso: cerrar bloqueadores de consistencia tecnica antes de nuevas features: migraciones reales + fix ruta ajustes + lint/config + actualizar README backend.
