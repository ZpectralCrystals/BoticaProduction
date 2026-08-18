# Radiografia completa - Botica El Pueblo

Raiz auditada: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo`

Fecha de auditoria local: 2026-05-07, zona `America/Lima`.

Alcance: frontend, backend Fastify, rutas, plugins, esquema Drizzle, migraciones, scripts, POS, pruebas y base local `botica_db` disponible en PostgreSQL.

Nota de metodo: este documento describe el estado real observado. No se aplicaron migraciones, no se cambio codigo funcional y no se borraron archivos. El unico archivo creado es esta radiografia.

## 1. Resumen ejecutivo

Botica El Pueblo es un sistema de gestion para botica/farmacia. Cubre operaciones de inventario, compras, ventas POS, caja, proveedores, usuarios/permisos, lotes, vencimientos, kardex, almacenes/locales, traslados, devoluciones, pacientes/clientes, servicios/procedimientos, reportes, auditoria y algunas areas clinicas complementarias.

El sistema ya tiene una base funcional importante: Fastify expone rutas bajo `/api/v1`, React/Vite consume esas rutas, el POS descuenta stock con FEFO, compras crean/actualizan lotes, existe kardex, hay permisos por seccion, hay soporte parcial para Clerk, existen migraciones recientes para precios multiples, familias, categorias y componentes, y la base local contiene datos reales de prueba.

El avance no es homogeneo. Los modulos criticos de compras, ventas, lotes, kardex y consistencia estan mucho mas desarrollados que reportes, caja, servicios clinicos, historial, recetas, alquileres, deudores e inventario variable. Varios modulos existen como pantallas y endpoints basicos CRUD, pero no todos tienen validaciones, permisos estrictos, pruebas ni transacciones.

Lo que funciona mejor:

- Login local por DNI/clave en Fastify.
- Autenticacion JWT por cookie o Bearer token.
- Permisos por seccion desde `bot_permisos`.
- Inventario de productos con familias, categorias, componentes y precios multiples parcialmente conectado.
- Compras con proveedor, almacen destino, detalle, lote, stock, kardex y movimiento de almacen.
- Ventas POS con busqueda de productos, seleccion de precio comercial, validacion de precio en backend, descuento FEFO, kardex y anulacion.
- Consistencia de stock/lotes/kardex con endpoints de diagnostico y reconciliacion.
- Almacenes/locales y transferencias/devoluciones.

Lo incompleto o riesgoso:

- El arranque depende de un `start.sh` que aplica solo migraciones 014-017 y referencia archivos base/fix en la raiz que realmente estan en `docs/migrations`.
- Hay dos verificadores de esquema: el real en TypeScript verifica 14 tablas y 28 columnas; el CLI `backend-fastify/check-schema.js` esta desactualizado y solo verifica 10 tablas y 14 columnas.
- El wrapper `scripts/check-schema.js` apunta a `scripts/backend-fastify/check-schema.js`, ruta que no corresponde.
- El esquema Drizzle `backend-fastify/src/db/schema.ts` no coincide completamente con la base real para `bot_lotes`, `bot_kardex`, `bot_movimientos_almacen`, `bot_auditoria`, `bot_compras_det` y `bot_ventas_det`.
- Existe deuda legacy: Supabase, PHP proxy, tablas `kardex` y `tipos_movimiento`, rutas/paginas simples y archivos draft.
- La base local muestra desbalance: stock agregado activo de productos = 1610, stock activo por lotes = 1594.
- Hay 4 productos activos sin `nfamilia_id`.
- Hay 3 productos activos con `npreventa <= 0`, por lo que no son vendibles por POS bajo la validacion actual.
- Caja existe, pero las ventas no parecen exigir caja abierta ni enlazar una venta a una caja real.
- `frontend/src/pages/ajustes-page.tsx` usa `/api/v1/ajustes`, ruta cuyo SQL parece desalineado con el esquema real; existe una alternativa mas solida en `/api/v1/kardex/ajuste`.
- El MCP server puede escribir directo en PostgreSQL, saltandose API, auth, permisos, transacciones y auditoria del backend.

Estimacion:

- Estado general: funcional parcial con nucleos criticos avanzados y deuda tecnica significativa.
- Porcentaje aproximado de avance: 65% para operacion interna basica; 45-55% para uso productivo robusto.
- Nivel de riesgo: medio-alto.
- Siguiente paso recomendado: estabilizar arranque, verificacion de esquema y login antes de agregar nuevas funcionalidades.

Antes de seguir desarrollando conviene:

- Unificar fuente de verdad de migraciones y esquema.
- Corregir scripts de check/startup.
- Resolver desbalance producto-lotes.
- Alinear Drizzle con PostgreSQL o evitar Drizzle en tablas desalineadas.
- Validar end-to-end login, compras, ventas, anulacion, caja y consistencia.

## 2. Stack tecnologico real

### Frontend

- Framework: React 19.
- Lenguaje: TypeScript.
- Build tool: Vite 8.
- UI: componentes propios en `frontend/src/components/ui`, Tailwind CSS 4 via `@tailwindcss/vite`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`.
- Rutas: `react-router-dom` 7 en `frontend/src/app/router.tsx`.
- Estado global: React Context para autenticacion en `frontend/src/context/auth-context.tsx`; estado local por pagina/hooks.
- Autenticacion: token Fastify en localStorage `botica_fastify_token` y cookie `botica_token`; rutas protegidas por `RequireAuth` y `RequireSection`.
- Cliente API: `frontend/src/lib/api.ts`, base `/api/v1`, `credentials: include`, Bearer token opcional.
- Testing: Vitest + Testing Library + jsdom.
- Lint/build: ESLint 9, TypeScript project refs, `npm run build`, `npm run lint`.

Rutas frontend reales:

- `/`: login local.
- `/panel`: shell autenticado.
- `/panel/dashboard`
- `/panel/inventario`
- `/panel/ventas`
- `/panel/caja`
- `/panel/compras`
- `/panel/proveedores`
- `/panel/pacientes`
- `/panel/procedimientos`
- `/panel/medicos`
- `/panel/reportes`
- `/panel/transferencias`
- `/panel/alquileres`
- `/panel/deudores`
- `/panel/inventario-var`
- `/panel/auditoria`
- `/panel/usuarios`
- `/panel/perfil`
- `/panel/locales`
- `/panel/almacenes`
- `/panel/traslados-almacen`
- `/panel/devoluciones`
- `/panel/consistencia`
- `/panel/alertas`
- `/auth/clerk`
- `/login/clerk`

### Backend

- Framework: Fastify 5.
- Lenguaje: TypeScript.
- Runtime dev: `tsx watch src/server.ts`.
- Arquitectura actual: rutas Fastify por modulo, plugins de DB/auth/error-handler, SQL crudo predominante, Drizzle disponible pero no siempre alineado.
- Rutas: registradas en `backend-fastify/src/server.ts` bajo prefijo `/api/v1`.
- Plugins:
  - `backend-fastify/src/plugins/db.ts`: pool `pg`.
  - `backend-fastify/src/plugins/drizzle.ts`: Drizzle sobre pool existente.
  - `backend-fastify/src/plugins/auth.ts`: JWT, usuario autenticado, permisos.
  - `backend-fastify/src/plugins/error-handler.ts`: errores de aplicacion, errores Postgres y handler global.
- ORM/query builder: Drizzle ORM instalado y usado en algunas rutas; la logica critica usa SQL crudo.
- SQL crudo: muy usado en ventas, compras, inventario, kardex, consistencia, traslados y usuarios.
- Autenticacion: `@fastify/jwt`, cookie `botica_token`, Bearer token, bcrypt para clave local.
- Validaciones: mixtas; algunas rutas con validacion manual fuerte, otras CRUD simples.
- Testing: Vitest con mocks de Fastify/DB.
- Lint/build: `tsc`, ESLint 9.

### Base de datos

- Motor: PostgreSQL local.
- Nombre de base: `botica_db`.
- Usuario usado en auditoria: `$USER`.
- Tablas principales detectadas:
  - `bot_usuarios`
  - `bot_permisos`
  - `bot_productos`
  - `bot_familias_producto`
  - `bot_categorias_producto`
  - `bot_componentes_producto`
  - `bot_producto_componentes`
  - `bot_lotes`
  - `bot_kardex`
  - `bot_movimientos_almacen`
  - `bot_compras`
  - `bot_compras_det`
  - `bot_ventas`
  - `bot_ventas_det`
  - `bot_caja`
  - `bot_proveedores`
  - `bot_pacientes`
  - `bot_servicios`
  - `bot_almacenes`
  - `bot_locales`
  - `bot_auditoria`
- Migraciones:
  - `ops/migrations/002_nstock_constraint.sql`
  - `ops/migrations/003_bot_kardex.sql`
  - `ops/migrations/004_bot_lotes.sql`
  - `ops/migrations/005_fefo.sql`
  - `ops/migrations/006_deduplicate_entities.sql`
  - `ops/migrations/006_migrar_stock_a_lotes.sql`
  - `ops/migrations/007_unify_customers_and_patients.sql`
  - `ops/migrations/008_rename_sales_clinical_customer_link.sql`
  - `ops/migrations/009_deduplicate_services.sql`
  - `ops/migrations/010_locales_almacenes.sql`
  - `ops/migrations/011_compras_tipo_comprobante_factura.sql`
  - `ops/migrations/012_compras_almacen_destino.sql`
  - `ops/migrations/013_proveedores_ruc_unico_y_auditoria.sql`
  - `ops/migrations/014_usuarios_clerk_link.sql`
  - `ops/migrations/015_productos_precios_venta.sql`
  - `ops/migrations/016_productos_familias_categorias.sql`
  - `ops/migrations/017_productos_componentes.sql`
- Seeds: existen inserts iniciales en migraciones y scripts SQL, especialmente usuarios, locales, almacenes, productos y permisos.
- Vistas:
  - `vw_bot_lotes_fefo`
  - `vw_stock_por_almacen`
- Constraints:
  - Hay PKs, FKs, checks de estado/precios/stock y unique indexes parciales en tablas nuevas.
  - Faltan o estan incompletas en algunos modulos legacy/simples.
- Indices:
  - Existen indices para FEFO, producto/estado/vencimiento, familias/categorias/componentes y busquedas criticas.

### Herramientas adicionales

- `start.sh`: arranque local de PostgreSQL, DB, backend Fastify, frontend Vite y PHP legacy opcional.
- `scripts/backup-db.sh`: backup con `pg_dump` y retencion.
- `ops/backup_postgres.sh`: backup alternativo de PostgreSQL.
- `scripts/cron-reconciliacion.sh`: job de consistencia/reconciliacion.
- `scripts/cron-vencimientos.sh`: job de marcado de lotes vencidos.
- `scripts/check-schema.js`: wrapper de esquema, actualmente apunta a una ruta incorrecta.
- `backend-fastify/check-schema.js`: CLI de esquema, desactualizado frente al verificador TypeScript usado por Fastify.
- MCP server: `mcp-server/`, con herramientas de consulta y escritura directa sobre PostgreSQL.
- Cron jobs: scripts manuales listos, no se detecto instalacion de cron del sistema.
- Backups: scripts presentes; no se audito politica real de ejecucion.
- Configuracion de entorno:
  - Backend lee `BOTICA_DB_*` y `DB_*`.
  - `JWT_SECRET` requerido en produccion.
  - `CORS_ORIGIN` configurable.
  - Frontend proxy `/api/v1` a `http://127.0.0.1:3000`.

## 3. Estructura real del proyecto

### `frontend/`

- Proposito: aplicacion web React/Vite.
- Estado: activa.
- Archivos clave:
  - `frontend/src/app/router.tsx`
  - `frontend/src/context/auth-context.tsx`
  - `frontend/src/lib/api.ts`
  - `frontend/src/pages/*.tsx`
  - `frontend/src/pos/*`
  - `frontend/vite.config.ts`
  - `frontend/package.json`
- Observaciones:
  - Tiene paginas para casi todos los modulos del negocio.
  - POS esta separado en hooks/componentes/utils.
  - Muchas pantallas son CRUD simples.
  - Inventario es una pagina grande con productos, familias, categorias, componentes y distribucion.
- Riesgos:
  - `inventory-page.tsx` concentra mucha logica.
  - Algunas pantallas dependen de endpoints simples o parciales.
  - Proxy `/api` legacy sigue apuntando a PHP en puerto 8081.

### `frontend/src/pages/`

- Proposito: paginas por modulo.
- Estado: activa/parcial.
- Archivos importantes:
  - `login-page.tsx`
  - `inventory-page.tsx`
  - `sales-page.tsx`
  - `compras-page.tsx`
  - `caja-page.tsx`
  - `proveedores-page.tsx`
  - `usuarios-page.tsx`
  - `consistencia-page.tsx`
  - `alertas-page.tsx`
  - `almacenes-page.tsx`
  - `traslados-almacen-page.tsx`
  - `devoluciones-page.tsx`
- Riesgos:
  - Paginas no criticas tienen baja cobertura de tests.
  - Ajustes apunta a una ruta con riesgo de SQL desalineado.

### `frontend/src/pos/`

- Proposito: experiencia POS de ventas.
- Estado: activa y bastante avanzada.
- Archivos clave:
  - `frontend/src/pos/hooks/usePOS.ts`
  - `frontend/src/pos/components/ProductSearch.tsx`
  - `frontend/src/pos/components/Cart.tsx`
  - `frontend/src/pos/components/PaymentPanel.tsx`
  - `frontend/src/pos/components/CustomerPanel.tsx`
  - `frontend/src/pos/components/CheckoutModal.tsx`
  - `frontend/src/pos/types/index.ts`
  - `frontend/src/pos/utils/posUtils.ts`
- Observaciones:
  - Selecciona precios comerciales configurados.
  - Consulta lotes disponibles.
  - Limita cantidad por stock/lotes.
  - Tiene pruebas unitarias de hook, carrito y utilidades.
- Riesgos:
  - El POS permite fallback si falla consulta de lotes; backend sigue siendo autoridad, pero UX puede mostrar una seleccion sin trazabilidad.

### `backend-fastify/`

- Proposito: API Fastify principal.
- Estado: activa.
- Archivos clave:
  - `backend-fastify/src/server.ts`
  - `backend-fastify/src/plugins/*.ts`
  - `backend-fastify/src/routes/*.ts`
  - `backend-fastify/src/db/schema.ts`
  - `backend-fastify/src/lib/schema-check.ts`
  - `backend-fastify/src/__tests__/*.test.ts`
  - `backend-fastify/package.json`
- Observaciones:
  - La logica critica esta en rutas con SQL transaccional.
  - El fail-fast de esquema se ejecuta antes de levantar rutas.
  - Hay buena cobertura en ventas, compras, kardex, consistencia, proveedores y usuarios.
- Riesgos:
  - Drizzle schema desalineado con la DB real en tablas criticas.
  - Algunas rutas mezclan validacion, negocio, SQL y formato de respuesta.

### `backend-fastify/src/routes/`

- Proposito: endpoints REST por modulo.
- Estado: activa, con mezcla de rutas robustas y rutas basicas.
- Archivos importantes:
  - `auth.routes.ts`
  - `inventory.routes.ts`
  - `sales.routes.ts`
  - `purchases.routes.ts`
  - `kardex.routes.ts`
  - `lotes.routes.ts`
  - `consistencia.routes.ts`
  - `traslados-almacen.routes.ts`
  - `caja.routes.ts`
  - `providers.routes.ts`
  - `users.routes.ts`
  - `almacenes.routes.ts`
  - `locales.routes.ts`
  - `ajustes.routes.ts`
- Riesgos:
  - `ajustes.routes.ts` parece usar columnas que no existen en `bot_kardex`, `bot_movimientos_almacen` y `bot_auditoria`.
  - Rutas simples de reportes/clinica no tienen profundidad equivalente a ventas/compras.

### `backend-fastify/src/plugins/`

- Proposito: DB, Drizzle, auth y errores.
- Estado: activa.
- Riesgos:
  - Si `JWT_SECRET` falta en produccion, arranque debe fallar.
  - Error handler convierte problemas de esquema a 503, adecuado pero puede ocultar detalle al frontend.

### `backend-fastify/src/db/schema.ts`

- Proposito: schema Drizzle.
- Estado: parcial/desalineado.
- Observaciones:
  - Productos, familias, categorias y componentes estan representados.
  - `bot_lotes` usa `tvencimiento`, pero la DB real usa `dfechavencimiento`.
  - `bot_kardex` usa `cmotivo/tcreacion`, pero la DB real usa `ctipo/tcreado` y campos de stock anterior/nuevo.
  - `bot_movimientos_almacen` usa `nalmacen_id/tcreacion`, pero la DB real usa origen/destino y `tcreado`.
  - `bot_auditoria` usa `tcreacion`, pero la DB real usa `tcreado`.
  - Detalles de compras/ventas en DB real usan `npreunit`, mientras el schema Drizzle usa `nprecioUnit`.
- Riesgo: alto si futuras rutas usan Drizzle para tablas desalineadas.

### `ops/migrations/`

- Proposito: migraciones SQL incrementales.
- Estado: activa, pero aplicacion automatica incompleta.
- Observaciones:
  - Hay migraciones 002-017.
  - Existe doble prefijo `006`.
  - `start.sh` solo aplica 014-017.
  - Las migraciones recientes agregan precios multiples, familias/categorias y componentes.
- Riesgos:
  - Una DB nueva puede no quedar bien creada si no se aplica el set completo en orden.
  - No se detecto tabla de historial de migraciones.

### `docs/migrations/`

- Proposito: SQL documental/legacy.
- Estado: legacy/dudosa.
- Archivos:
  - `docs/migrations/schema_farmacia_completo.sql`
  - `docs/migrations/fix_database.sql`
- Observaciones:
  - `start.sh` busca archivos equivalentes en la raiz, no en `docs/migrations`.
  - `fix_database.sql` crea tablas legacy `kardex` y `tipos_movimiento`.
- Riesgos:
  - Confusion entre schema actual `bot_*` y SQL legacy.

### `scripts/`

- Proposito: utilidades operativas.
- Estado: parcial.
- Archivos:
  - `scripts/backup-db.sh`
  - `scripts/cron-reconciliacion.sh`
  - `scripts/cron-vencimientos.sh`
  - `scripts/check-schema.js`
- Riesgos:
  - `scripts/check-schema.js` apunta a ruta incorrecta.
  - Cron jobs dependen de login/token y de endpoints disponibles.

### `mcp-server/`

- Proposito: servidor MCP con acceso directo a DB.
- Estado: activo/dudoso para produccion.
- Archivos:
  - `mcp-server/src/index.ts`
  - `mcp-server/mcp_config.json`
  - `mcp-server/package.json`
- Riesgos:
  - Puede escribir directo en DB y saltarse API, permisos, validaciones, auditoria y transacciones.

### `backend-fastify/_draft/` y `backend-fastify/supabase/`

- Proposito: borradores/legacy.
- Estado: legacy/dudoso.
- Riesgos:
  - Pueden inducir a usar modelos viejos.
  - README del backend aun menciona Supabase aunque el backend activo usa PostgreSQL local con `pg`.

## 4. Estado actual de modulos funcionales

### Modulo: Login / autenticacion

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/`, `/auth/clerk`, `/login/clerk`.
  - Paginas: `frontend/src/pages/login-page.tsx`, `frontend/src/pages/clerk-login-page.tsx`, `frontend/src/pages/clerk-test-page.tsx`.
  - Componentes: formulario de login local.
  - Servicios API: `apiLogin`, `apiLogout`, `apiCheckSession`, `apiClerkSync`.
- Backend:
  - Rutas: `backend-fastify/src/routes/auth.routes.ts`.
  - Endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `POST /api/v1/auth/clerk-sync`.
  - Validaciones: DNI/clave, estado activo, bcrypt.
  - Permisos: session requiere auth; login no.
- Base de datos:
  - Tablas: `bot_usuarios`, `bot_permisos`.
  - Relaciones: permisos por usuario.
  - Constraints: DNI unico; estado.
- Tests: no se detectaron tests directos del login local; si hay tests de usuarios/Clerk.
- Riesgos:
  - Si Fastify no arranca, frontend devuelve 502 por proxy.
  - `JWT_SECRET` debe estar bien configurado.
  - Clerk esta parcial y puede confundir flujos.
- Pendientes:
  - Test de login directo.
  - Validacion e2e desde frontend.
- Recomendacion:
  - Mantener login local estable como flujo principal antes de reactivar Clerk.

### Modulo: Usuarios

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/panel/usuarios`.
  - Paginas: `frontend/src/pages/usuarios-page.tsx`.
  - Servicios API: `apiGetUsuarios`, `apiCreateUsuario`, `apiGetUsuarioClerkLink`, `apiLinkUsuarioClerk`, `apiUnlinkUsuarioClerk`.
- Backend:
  - Rutas: `backend-fastify/src/routes/users.routes.ts`.
  - Endpoints: `GET /api/v1/usuarios`, `POST /api/v1/usuarios`, Clerk link GET/POST/DELETE.
  - Validaciones: datos usuario, Clerk link, usuario activo.
  - Permisos: admin/super para gestion sensible.
- Base de datos:
  - Tablas: `bot_usuarios`, `bot_permisos`.
  - Relaciones: `bot_permisos.nusuario_id`.
- Tests: `backend-fastify/src/__tests__/users.test.ts`.
- Riesgos:
  - Clerk es opcional/parcial.
  - Permisos por seccion simples, no RBAC granular.
- Pendientes:
  - Edicion/desactivacion completa de usuarios si no existe en UI.
  - Auditoria completa de cambios de usuario.
- Recomendacion:
  - Consolidar roles/permisos antes de endurecer rutas financieras.

### Modulo: Roles y permisos

- Estado: parcial.
- Frontend:
  - Rutas: varias protegidas con `RequireSection`.
  - Paginas: no se detecta pagina dedicada de matriz de roles; usuarios maneja permisos.
  - Servicios API: ligados a usuarios.
- Backend:
  - Rutas: auth/users.
  - Validaciones: `requireAuth`, `requireAnyPermission`.
  - Permisos: por seccion en `bot_permisos`; admin/super tienen acceso amplio.
- Base de datos:
  - Tablas: `bot_permisos`, `bot_usuarios`.
  - Constraints: FK usuario.
- Tests: usuarios cubre parte.
- Riesgos:
  - No hay roles normalizados en tabla separada.
  - Permisos son cadenas por seccion, no acciones CRUD.
- Pendientes:
  - Modelo RBAC formal si se requiere produccion.
- Recomendacion:
  - Mantener simple para Fase 01, pero exigir permisos estrictos en stock/dinero.

### Modulo: Productos

- Estado: parcial/avanzado.
- Frontend:
  - Rutas: `/panel/inventario`.
  - Paginas: `frontend/src/pages/inventory-page.tsx`.
  - Componentes: dialogos internos de producto, precios, familias, categorias, componentes.
  - Servicios API: `apiGetInventory`, `apiAddProduct`, `apiUpdateProduct`, `apiUpdateProductPrices`.
- Backend:
  - Rutas: `backend-fastify/src/routes/inventory.routes.ts`.
  - Endpoints: `GET /api/v1/inventario`, `POST /api/v1/inventario`, `GET /api/v1/inventario/search`, `GET /api/v1/inventario/distribucion`.
  - Validaciones: productos activos, precios no negativos, familia/categoria/componentes activos, duplicados de componentes.
  - Permisos: auth; crear/editar requiere permiso inventario/admin/super.
- Base de datos:
  - Tablas: `bot_productos`, catalogos y relacion componentes.
  - Relaciones: proveedor, familia, categoria, componentes.
  - Constraints: codigo unico, stock/precios no negativos, FKs.
- Tests: `inventory-prices.test.ts`; no se detectan tests del CRUD completo de productos/familias/componentes.
- Riesgos:
  - Sigue existiendo texto legacy `cfamilia`, `ccategoria`, `cgenerico`.
  - 4 productos activos sin `nfamilia_id`.
  - 3 productos activos con precio principal cero.
  - Stock producto y stock lotes no coinciden en la base local.
- Pendientes:
  - Normalizar residuos legacy.
  - Tests de catalogos y composicion.
- Recomendacion:
  - No agregar mas campos hasta reconciliar stock y cerrar compatibilidad legacy.

### Modulo: Familia de productos

- Estado: implementado parcialmente.
- Frontend:
  - Rutas: tab `Familias` dentro de `/panel/inventario`.
  - Paginas: `frontend/src/pages/inventory-page.tsx`.
  - Servicios API: `apiGetFamiliasProducto`, `apiCreateFamiliaProducto`, `apiUpdateFamiliaProducto`, `apiDeleteFamiliaProducto`.
- Backend:
  - Rutas: `backend-fastify/src/routes/inventory.routes.ts`.
  - Endpoints: `GET/POST/PATCH/DELETE /api/v1/inventario/familias`.
  - Validaciones: nombre obligatorio, duplicado activo, bloqueo si esta en uso.
  - Permisos: auth; escritura requiere inventario/admin/super.
- Base de datos:
  - Tablas: `bot_familias_producto`, `bot_productos`.
  - Relaciones: `bot_productos.nfamilia_id`.
  - Constraints: unique parcial por nombre activo.
- Tests: no encontrado especifico.
- Riesgos:
  - Productos existentes pueden seguir ligados por texto legacy.
  - 4 activos sin FK de familia.
- Pendientes:
  - Migracion/limpieza final de productos sin familia.
- Recomendacion:
  - Completar pruebas y resolver datos sin FK.

### Modulo: Categoria de productos

- Estado: implementado parcialmente.
- Frontend:
  - Rutas: tab `Categorias` dentro de `/panel/inventario`.
  - Paginas: `frontend/src/pages/inventory-page.tsx`.
  - Servicios API: `apiGetCategoriasProducto`, `apiCreateCategoriaProducto`, `apiUpdateCategoriaProducto`, `apiDeleteCategoriaProducto`.
- Backend:
  - Rutas: `backend-fastify/src/routes/inventory.routes.ts`.
  - Endpoints: `GET/POST/PATCH/DELETE /api/v1/inventario/categorias`.
  - Validaciones: nombre obligatorio, duplicado activo, familia activa opcional, bloqueo si esta en uso.
  - Permisos: auth; escritura requiere inventario/admin/super.
- Base de datos:
  - Tablas: `bot_categorias_producto`, `bot_productos`, `bot_familias_producto`.
  - Relaciones: categoria puede tener `nfamilia_id`; producto tiene `ncategoria_id`.
  - Constraints: unique parcial por nombre activo, FK familia.
- Tests: no encontrado especifico.
- Riesgos:
  - Duplicado por nombre activo no considera familia; si se quiere mismo nombre en familias distintas, habria que cambiar regla.
- Pendientes:
  - Confirmar regla negocio categoria global vs categoria por familia.
- Recomendacion:
  - Mantener categoria global si el negocio no exige duplicados por familia.

### Modulo: Composicion / principios activos

- Estado: implementado parcialmente.
- Frontend:
  - Rutas: tab `Componentes` dentro de `/panel/inventario`.
  - Paginas: `frontend/src/pages/inventory-page.tsx`.
  - Servicios API: `apiGetComponentesProducto`, `apiCreateComponenteProducto`, `apiUpdateComponenteProducto`, `apiDeleteComponenteProducto`.
- Backend:
  - Rutas: `backend-fastify/src/routes/inventory.routes.ts`.
  - Endpoints: `GET/POST/PATCH/DELETE /api/v1/inventario/componentes`.
  - Validaciones: nombre obligatorio, duplicado activo, bloqueo si esta asociado a productos activos.
  - Permisos: auth; escritura requiere inventario/admin/super.
- Base de datos:
  - Tablas: `bot_componentes_producto`, `bot_producto_componentes`, `bot_productos`.
  - Relaciones: muchos a muchos producto-componente.
  - Constraints: unique producto-componente, unique parcial componente activo por nombre.
- Tests: no encontrado especifico.
- Riesgos:
  - La migracion desde `cgenerico` puede haber creado componentes compuestos como un solo texto.
  - `cgenerico` sigue existiendo por compatibilidad.
- Pendientes:
  - Normalizacion manual/asistida de composiciones antiguas.
  - Tests de duplicados y bloqueo de eliminacion.
- Recomendacion:
  - Mantener nombre comercial y composicion separados; usar `bot_producto_componentes` como fuente principal.

### Modulo: Precios de venta

- Estado: implementado parcialmente/funcional en venta.
- Frontend:
  - Rutas: productos/POS.
  - Paginas: `inventory-page.tsx`, `sales-page.tsx`.
  - Componentes: POS ProductSearch/Cart.
  - Servicios API: `apiUpdateProductPrices`, POS APIs.
- Backend:
  - Rutas: inventory/sales.
  - Endpoints: `POST /api/v1/inventario` con `action: updatePrices`, `POST /api/v1/ventas`.
  - Validaciones: precios no negativos; venta solo acepta precio enviado si coincide con `npreventa`, `npreventa_2` o `npreventa_3`.
  - Permisos: inventario para editar; ventas para vender.
- Base de datos:
  - Tablas: `bot_productos`, `bot_ventas_det`.
  - Relaciones: venta detalle guarda `npreunit`.
  - Constraints: checks de precios no negativos.
- Tests: `inventory-prices.test.ts`, `sales.test.ts` cubre rechazo de precio arbitrario.
- Riesgos:
  - Productos con `npreventa <= 0` no son vendibles.
  - No hay tabla historica de precios.
- Pendientes:
  - Definir si precio 1 debe ser obligatorio en DB con check `> 0` para activos.
- Recomendacion:
  - Mantener validacion backend como autoridad.

### Modulo: Precio de compra

- Estado: funcional parcial.
- Frontend:
  - Productos muestra `precioCompra` disabled/readOnly.
  - Compras permite ingresar precio unitario de compra.
- Backend:
  - Compras actualiza `bot_productos.nprecompra` desde compra/lote.
  - Productos no debe editar precio compra manualmente.
- Base de datos:
  - `bot_productos.nprecompra`.
  - `bot_compras_det.npreunit`.
- Tests: compras cubre creacion y actualizacion de stock/kardex; no se detecta test especifico de que inventario no toque `nprecompra`.
- Riesgos:
  - `nprecompra` en producto es valor derivado/ultimo costo, no costo por lote.
  - Si rutas MCP o legacy escriben productos, pueden saltarse la regla.
- Pendientes:
  - Test de no modificacion de compra desde productos.
- Recomendacion:
  - Fuente de costo real debe ser compra/lote; producto solo ultimo costo informativo.

### Modulo: Inventario

- Estado: parcial/avanzado.
- Frontend:
  - Rutas: `/panel/inventario`, `/panel/consistencia`, `/panel/alertas`.
  - Servicios API: inventario, lotes, consistencia, alertas.
- Backend:
  - Rutas: inventory, lotes, kardex, consistencia, ajustes.
  - Endpoints: muchos.
  - Validaciones: variables por ruta.
- Base de datos:
  - `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_movimientos_almacen`, `bot_almacenes`.
- Tests: ventas/compras/kardex/consistencia.
- Riesgos:
  - Stock duplicado en producto y lotes puede desbalancearse.
  - Ajustes tiene dos caminos: `/ajustes` riesgoso y `/kardex/ajuste` mas probado.
- Pendientes:
  - Definir fuente de verdad de stock.
- Recomendacion:
  - Para Fase 01, `bot_lotes` por almacen debe ser la fuente operativa; `bot_productos.nstock` debe reconciliarse.

### Modulo: Lotes

- Estado: avanzado.
- Frontend:
  - POS consulta lotes disponibles.
  - Inventario muestra distribucion.
  - Alertas/consistencia usan lotes.
- Backend:
  - Rutas: `lotes.routes.ts`, `purchases.routes.ts`, `sales.routes.ts`, `consistencia.routes.ts`.
  - Endpoints: disponibles, FEFO, consistencia.
  - Validaciones: lote activo, no vencido, cantidad positiva, almacen vendible.
- Base de datos:
  - `bot_lotes`.
  - Relacion con producto, compra y almacen.
- Tests: compras, ventas, traslados, consistencia.
- Riesgos:
  - La columna de vencimiento real es `dfechavencimiento`; Drizzle schema usa `tvencimiento`.
  - Hay stock producto-lotes desbalanceado.
- Pendientes:
  - Reconciliar stock.
- Recomendacion:
  - No tocar FEFO sin pruebas.

### Modulo: Vencimientos

- Estado: parcial/funcional.
- Frontend:
  - POS muestra estados de vencimiento.
  - Alertas/consistencia exponen vencidos/proximos.
- Backend:
  - Rutas: lotes/consistencia.
  - Endpoints: marcar vencidos, alertas.
- Base de datos:
  - `bot_lotes.dfechavencimiento`, `bot_productos.tvencimien`.
- Tests: POS utils y consistencia parcial.
- Riesgos:
  - Producto conserva `tvencimien` como vencimiento agregado/legacy; lote debe mandar.
- Pendientes:
  - Evitar decisiones operativas basadas en vencimiento de producto.
- Recomendacion:
  - Usar vencimiento de lote como fuente.

### Modulo: Kardex

- Estado: avanzado.
- Frontend:
  - Paginas: posiblemente integradas en inventario/consistencia; no se detecta pagina dedicada fuerte.
  - Servicios API: `apiGetKardex`, `apiCreateAjusteKardex` si existe en api.ts.
- Backend:
  - Rutas: `kardex.routes.ts`.
  - Endpoints: `GET /api/v1/kardex`, `GET /api/v1/kardex/:id`, `POST /api/v1/kardex/ajuste`, `GET /api/v1/kardex/resumen/:productoId`.
  - Validaciones: stock no negativo, motivo, admin para ajuste.
- Base de datos:
  - `bot_kardex`.
  - Relaciones: producto, lote, almacen, usuario.
- Tests: `kardex.test.ts`.
- Riesgos:
  - Drizzle schema para kardex no coincide con DB real.
  - Ruta `/api/v1/ajustes` parece duplicar/romper ajuste.
- Pendientes:
  - Elegir un solo endpoint oficial de ajuste.
- Recomendacion:
  - Mantener `/api/v1/kardex/ajuste` como ruta probada.

### Modulo: Compras

- Estado: avanzado.
- Frontend:
  - Rutas: `/panel/compras`.
  - Paginas: `frontend/src/pages/compras-page.tsx`.
  - Servicios API: compras, proveedores, almacenes, inventario.
- Backend:
  - Rutas: `backend-fastify/src/routes/purchases.routes.ts`.
  - Endpoints: `GET /api/v1/compras`, `POST /api/v1/compras`.
  - Validaciones: proveedor activo, almacen activo, FACTURA, documento, productos, lotes, fecha vencimiento, precios.
  - Permisos: compras.
- Base de datos:
  - `bot_compras`, `bot_compras_det`, `bot_lotes`, `bot_productos`, `bot_kardex`, `bot_movimientos_almacen`.
- Tests: `purchases.test.ts`, `compras-page.test.tsx`, `catalogos-compras.test.ts`.
- Riesgos:
  - `bot_compras_det` real usa `npreunit`, pero Drizzle schema usa `nprecioUnit`.
  - Solo FACTURA esta permitida actualmente.
- Pendientes:
  - Definir BOLETA/GUIA si el negocio lo necesita.
- Recomendacion:
  - No cambiar compras hasta resolver arranque/esquema y stock.

### Modulo: Proveedores

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/panel/proveedores`.
  - Paginas: `frontend/src/pages/proveedores-page.tsx`.
  - Servicios API: `apiGetProveedores`, `apiCreateProveedor`.
- Backend:
  - Rutas: `providers.routes.ts`.
  - Endpoints: `GET /api/v1/proveedores`, `POST /api/v1/proveedores`.
  - Validaciones: nombre, RUC 11 digitos, duplicado RUC, estado.
  - Permisos: auth/escritura segun ruta.
- Base de datos:
  - `bot_proveedores`, FK desde compras/productos.
- Tests: `providers.test.ts`.
- Riesgos:
  - Producto aun guarda `cproveedor` denormalizado ademas de `nproveedor_id`.
- Pendientes:
  - Confirmar edicion/desactivacion completa desde UI.
- Recomendacion:
  - Usar `nproveedor_id` como fuente, conservar texto solo compatibilidad.

### Modulo: Ventas POS

- Estado: avanzado.
- Frontend:
  - Rutas: `/panel/ventas`.
  - Paginas: `frontend/src/pages/sales-page.tsx`.
  - Componentes: `frontend/src/pos/*`.
  - Servicios API: `apiPOSBuscarProductos`, `apiPOSCrearVenta`, `apiAddSale`, `apiAnularVenta`.
- Backend:
  - Rutas: `sales.routes.ts`.
  - Endpoints: `GET /api/v1/ventas`, `POST /api/v1/ventas`, `GET /api/v1/ventas/:id`, `PATCH /api/v1/ventas/:id/anular`.
  - Validaciones: producto activo, stock, precio configurado, FEFO, almacenes.
  - Permisos: ventas; anulacion admin/super.
- Base de datos:
  - `bot_ventas`, `bot_ventas_det`, `bot_lotes`, `bot_productos`, `bot_kardex`, `bot_movimientos_almacen`.
- Tests: `sales.test.ts`, POS tests frontend.
- Riesgos:
  - Caja no esta fuertemente acoplada a venta.
  - Venta sin lotes puede usar fallback por stock de producto.
- Pendientes:
  - Exigir caja abierta si negocio lo requiere.
  - Reconciliar stock para evitar fallback peligroso.
- Recomendacion:
  - Mantener backend como autoridad de precio/stock.

### Modulo: Caja

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/caja`.
  - Paginas: `frontend/src/pages/caja-page.tsx`.
  - Servicios API: caja.
- Backend:
  - Rutas: `caja.routes.ts`.
  - Endpoints: `GET /api/v1/caja`, `POST /api/v1/caja`.
  - Validaciones: abrir/cerrar caja, usuario.
  - Permisos: caja.
- Base de datos:
  - `bot_caja`, ventas del dia por usuario.
- Tests: no encontrado especifico.
- Riesgos:
  - Ventas no parecen requerir caja abierta.
  - No se detecto tabla formal de movimientos de caja separada de ventas/caja.
- Pendientes:
  - Integrar venta-caja-cierre.
- Recomendacion:
  - Definir regla: no vender sin caja abierta.

### Modulo: Clientes / pacientes

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/pacientes`.
  - Paginas: `pacientes-page.tsx`.
  - Servicios API: pacientes.
- Backend:
  - Rutas: `patients.routes.ts`.
  - Endpoints: `GET/POST /api/v1/pacientes`.
  - Validaciones: basicas.
- Base de datos:
  - `bot_pacientes`.
  - Venta puede enlazar `ncliente_clinico_id`.
- Tests: no encontrado especifico.
- Riesgos:
  - Cliente comercial y paciente clinico estan parcialmente unificados.
- Pendientes:
  - Definir datos obligatorios para paciente vs cliente anonimo.
- Recomendacion:
  - Mantener paciente opcional en POS, formalizar despues.

### Modulo: Servicios / procedimientos

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/procedimientos`.
  - Paginas: `servicios-page.tsx`.
  - Servicios API: servicios.
- Backend:
  - Rutas: `services.routes.ts`.
  - Endpoints: `GET/POST /api/v1/servicios`.
  - Validaciones: basicas.
- Base de datos:
  - `bot_servicios`.
  - Venta detalle tiene `ctipo`, `nservicio_id`, `cdescripcion`.
- Tests: no encontrado especifico.
- Riesgos:
  - Integracion servicio-venta parece parcial.
- Pendientes:
  - Pruebas de venta de servicios si se soporta.
- Recomendacion:
  - Separar producto fisico de servicio para no afectar stock.

### Modulo: Reportes

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/reportes`.
  - Paginas: `reportes-page.tsx`.
  - Servicios API: reportes.
- Backend:
  - Rutas: `reports.routes.ts`.
  - Endpoints: `GET /api/v1/reportes`.
  - Validaciones: basicas.
- Base de datos:
  - Lee ventas/compras/inventario segun reporte.
- Tests: no encontrado especifico.
- Riesgos:
  - Sin validacion de exactitud contable.
- Pendientes:
  - Definir reportes oficiales.
- Recomendacion:
  - Priorizar reportes despues de cerrar stock/caja.

### Modulo: Auditoria

- Estado: parcial.
- Frontend:
  - Rutas: `/panel/auditoria`.
  - Paginas: `auditoria-page.tsx`.
  - Servicios API: auditoria.
- Backend:
  - Rutas: `audit.routes.ts`.
  - Endpoints: `GET /api/v1/auditoria`.
  - Validaciones: auth.
- Base de datos:
  - `bot_auditoria`.
- Tests: no encontrado especifico.
- Riesgos:
  - No todas las rutas simples auditan cambios.
  - Drizzle schema usa `tcreacion`, DB real usa `tcreado`.
- Pendientes:
  - Cobertura de auditoria para operaciones criticas.
- Recomendacion:
  - Auditar ventas, compras, ajustes, usuarios y anulaciones como minimo.

### Modulo: Almacenes / locales

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/panel/locales`, `/panel/almacenes`.
  - Paginas: `locales-page.tsx`, `almacenes-page.tsx`.
  - Servicios API: locales/almacenes.
- Backend:
  - Rutas: `locales.routes.ts`, `almacenes.routes.ts`.
  - Endpoints: `GET/POST /api/v1/locales`, `GET/POST /api/v1/almacenes`, `GET /api/v1/almacenes/stock`.
  - Validaciones: basicas.
- Base de datos:
  - `bot_locales`, `bot_almacenes`, `bot_lotes`, vistas.
- Tests: catalogos compras cubre shape de almacenes.
- Riesgos:
  - Sin CRUD completo robusto en pruebas.
- Pendientes:
  - Edicion/desactivacion con bloqueo por lotes/ventas.
- Recomendacion:
  - Definir almacenes vendibles, cuarentena y baja como reglas fuertes.

### Modulo: Traslados

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/panel/traslados-almacen`.
  - Paginas: `traslados-almacen-page.tsx`.
- Backend:
  - Rutas: `traslados-almacen.routes.ts`.
  - Endpoints: `POST /api/v1/traslados-almacen`, `GET /api/v1/traslados-almacen`.
  - Validaciones: origen/destino diferentes, lote, stock.
- Base de datos:
  - `bot_lotes`, `bot_movimientos_almacen`, `bot_kardex`.
- Tests: `traslados-almacen.test.ts`.
- Riesgos:
  - Depende de consistencia previa de lotes.
- Pendientes:
  - UI/e2e.
- Recomendacion:
  - Mantener trazabilidad por lote.

### Modulo: Devoluciones

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/panel/devoluciones`.
  - Paginas: `devoluciones-page.tsx`.
- Backend:
  - Rutas: `traslados-almacen.routes.ts`.
  - Endpoints: `POST /api/v1/traslados-almacen/devolucion-cliente`, `POST /api/v1/traslados-almacen/devolucion-proveedor`.
  - Validaciones: lote/almacen/stock.
- Base de datos:
  - `bot_lotes`, `bot_movimientos_almacen`, `bot_kardex`.
- Tests: `traslados-almacen.test.ts`.
- Riesgos:
  - Falta integracion contable/caja para devolucion de dinero.
- Pendientes:
  - Regla financiera de notas de credito/devolucion.
- Recomendacion:
  - Separar devolucion fisica de devolucion monetaria.

### Modulo: Alertas

- Estado: parcial/funcional.
- Frontend:
  - Rutas: `/panel/alertas`.
  - Paginas: `alertas-page.tsx`.
- Backend:
  - Rutas: `consistencia.routes.ts`.
  - Endpoints: `GET /api/v1/consistencia/alertas`, `POST /api/v1/consistencia/marcar-vencidos`.
- Base de datos:
  - `bot_lotes`, `bot_productos`.
- Tests: consistencia.
- Riesgos:
  - Depende de datos de lotes correctos.
- Pendientes:
  - Notificaciones programadas reales.
- Recomendacion:
  - Usar cron vencimientos despues de estabilizar auth/job token.

### Modulo: Consistencia de stock

- Estado: avanzado.
- Frontend:
  - Rutas: `/panel/consistencia`.
  - Paginas: `consistencia-page.tsx`.
- Backend:
  - Rutas: `consistencia.routes.ts`.
  - Endpoints: stock, lotes, kardex, resumen, alertas, reconciliar, marcar vencidos.
  - Validaciones: dry-run por defecto, apply con admin/super.
- Base de datos:
  - `bot_productos`, `bot_lotes`, `bot_kardex`.
- Tests: `consistencia.test.ts`.
- Riesgos:
  - La base local ya tiene diferencia producto-lotes.
- Pendientes:
  - Ejecutar diagnostico y decidir reconciliacion controlada.
- Recomendacion:
  - Convertir consistencia en paso obligatorio antes de pruebas POS.

### Modulo: Clerk

- Estado: parcial/opcional.
- Frontend:
  - Rutas: `/auth/clerk`, `/login/clerk`.
- Backend:
  - Rutas: auth/users.
  - Endpoints: sync y link/unlink.
- Base de datos:
  - `bot_usuarios.cclerk_user_id`.
- Tests: users Clerk.
- Riesgos:
  - Puede confundir login local si no se documenta.
- Pendientes:
  - Decidir si Clerk sigue en Fase 01.
- Recomendacion:
  - No tocar Clerk hasta estabilizar sistema local.

### Modulo: Supabase

- Estado: legacy/dudoso.
- Frontend:
  - no encontrado como flujo activo principal.
- Backend:
  - `backend-fastify/supabase/`, README menciona Supabase.
- Base de datos:
  - PostgreSQL local actual, no Supabase como runtime principal.
- Tests: no encontrado.
- Riesgos:
  - Documentacion vieja puede inducir a errores.
- Pendientes:
  - Marcar/archivar legacy.
- Recomendacion:
  - Separar carpeta legacy de backend activo.

### Modulo: Codigo legacy

- Estado: presente.
- Frontend:
  - Proxy `/api` a PHP legacy.
- Backend:
  - `_draft`, `supabase`, docs SQL legacy, tablas no prefijadas.
- Base de datos:
  - `kardex`, `tipos_movimiento`.
- Tests: no encontrado.
- Riesgos:
  - Confusion de modelos y rutas.
- Pendientes:
  - Inventario de legacy y decision de retiro.
- Recomendacion:
  - No borrar todavia; aislar y documentar.

## 5. Radiografia de productos

### Como se crea un producto actualmente

El frontend usa `frontend/src/pages/inventory-page.tsx`. El formulario de producto incluye:

- Codigo.
- Nombre comercial.
- Familia desde select.
- Categoria desde select.
- Presentacion.
- Laboratorio.
- Precio compra en solo lectura/deshabilitado.
- Precio venta 1.
- Precio venta 2 opcional.
- Precio venta 3 opcional.
- Stock/min stock visibles segun formulario actual.
- Componentes multiples con concentracion, forma y notas.

Al guardar, el frontend arma un payload con:

- `name`
- `generico`: resumen de composicion por compatibilidad.
- `category`
- `family`
- `categoryId`
- `familyId`
- `presentacion`
- `laboratorio`
- `precioVenta1`
- `precioVenta2`
- `precioVenta3`
- `componentes`

El backend recibe esto en `backend-fastify/src/routes/inventory.routes.ts`, valida catalogos y componentes, actualiza/crea producto y reemplaza la relacion `bot_producto_componentes` cuando aplica.

### Como se edita un producto actualmente

El frontend precarga datos desde `ApiInventoryItem`. Si el producto tiene `familyId` o `categoryId`, usa esos IDs. Si no, intenta mapear por nombre legacy (`cfamilia`/`ccategoria`) contra catalogos cargados.

El backend conserva campos texto legacy (`cfamilia`, `ccategoria`, `cgenerico`) al mismo tiempo que usa FKs nuevas (`nfamilia_id`, `ncategoria_id`) y relacion de componentes.

### Campos actuales de `bot_productos`

Columnas detectadas en DB local:

- `nid`
- `ccodigo`
- `cnombre`
- `cgenerico`
- `ccategoria`
- `cfamilia`
- `cpresenta`
- `claborat`
- `nprecompra`
- `npreventa`
- `nstock`
- `nstockmin`
- `cubicacion`
- `cproveedor`
- `crotacion`
- `tvencimien`
- `creceta`
- `cestado`
- `tcreado`
- `tmodifi`
- `nproveedor_id`
- `npreventa_2`
- `npreventa_3`
- `nfamilia_id`
- `ncategoria_id`

### Campos que usa el frontend

El tipo `ApiInventoryItem` en `frontend/src/lib/api.ts` expone:

- `id`
- `code`
- `name`
- `generico`
- `composicion`
- `componentes`
- `category`
- `categoryId`
- `family`
- `familyId`
- `presentacion`
- `laboratorio`
- `precioCompra`
- `precioVenta`
- `precioVenta1`
- `precioVenta2`
- `precioVenta3`
- `stock`
- `minStock`
- `ubicacion`
- `proveedor`
- `rotacion`
- `expiry`
- `prescription`
- `status`

### Campos que acepta el backend

En inventario acepta campos de producto y acciones especiales:

- Creacion/edicion de producto.
- `action: updatePrices`.
- Familia/categoria por nombre e ID.
- Componentes como array.
- Precios comerciales.

El backend expone tambien `GET /api/v1/inventario/search`, usado por POS, con campos de precio, stock, familia/categoria y proveedor.

### Familia y categoria: texto libre o FK

Estado real: ambos.

- Texto legacy:
  - `bot_productos.cfamilia`
  - `bot_productos.ccategoria`
- Modelo nuevo:
  - `bot_productos.nfamilia_id`
  - `bot_productos.ncategoria_id`
  - `bot_familias_producto`
  - `bot_categorias_producto`

La migracion 016 migra texto hacia catalogos y conserva columnas antiguas por compatibilidad. El backend sigue usando ambos para detectar uso y mantener nombres legibles.

### CRUD de familia

Existe.

- Frontend: tab `Familias` en `frontend/src/pages/inventory-page.tsx`.
- Backend: `GET/POST/PATCH/DELETE /api/v1/inventario/familias`.
- DB: `bot_familias_producto`.
- Estado: implementado parcialmente; faltan tests especificos.

### CRUD de categoria

Existe.

- Frontend: tab `Categorias` en `frontend/src/pages/inventory-page.tsx`.
- Backend: `GET/POST/PATCH/DELETE /api/v1/inventario/categorias`.
- DB: `bot_categorias_producto`.
- Estado: implementado parcialmente; faltan tests especificos.

### Composicion o principio activo

Existe parcialmente.

- Legacy: `bot_productos.cgenerico`.
- Modelo nuevo:
  - `bot_componentes_producto`
  - `bot_producto_componentes`
- Frontend permite agregar varios componentes por producto.
- Backend valida existencia, estado activo y duplicados por producto.
- El resumen de composicion se construye con nombre + concentracion.

Riesgo: datos migrados desde `cgenerico` pueden representar combinaciones completas como un unico componente, por ejemplo un texto tipo `amoxicilina + paracetamol`.

### Precio de compra

Existe:

- `bot_productos.nprecompra`
- `bot_compras_det.npreunit`

Regla actual:

- Compras actualiza `nprecompra` del producto desde el precio unitario de compra.
- Frontend de producto muestra `precioCompra` disabled/readOnly.

Riesgo:

- `nprecompra` en producto es ultimo costo o costo informativo; el costo real historico esta en compras/lotes.
- Herramientas directas a DB pueden saltarse la regla.

### Precio de venta

Existe:

- `bot_productos.npreventa` = precio venta 1.
- `bot_productos.npreventa_2` = precio venta 2 opcional.
- `bot_productos.npreventa_3` = precio venta 3 opcional.

El POS muestra precios disponibles y backend valida que `npreunit` enviado en venta corresponda a uno de esos valores configurados.

### Precio 1, precio 2, precio 3

Existen como columnas reales:

- Precio 1: `npreventa`.
- Precio 2: `npreventa_2`.
- Precio 3: `npreventa_3`.

Hay constraints para evitar negativos. No se detecto constraint DB que obligue `npreventa > 0` para productos activos.

### Si el precio de compra se puede editar desde producto

En el frontend auditado, el campo aparece disabled/readOnly en el modal principal y en el modal de precios se muestra como dato de costo deshabilitado. No se observo edicion manual desde la UI de productos.

Se recomienda confirmar que el endpoint de inventario no actualice `nprecompra` durante create/update salvo flujo de compra. El codigo observado mapea precios de venta y campos de catalogo; compras sigue siendo el flujo que actualiza costo.

### Si el precio de compra viene desde compra/lote

Si. En `backend-fastify/src/routes/purchases.routes.ts`, al registrar compra:

- Inserta compra.
- Inserta detalle.
- Actualiza stock del producto.
- Actualiza `bot_productos.nprecompra`.
- Crea/actualiza lote.
- Registra kardex.
- Registra movimiento de almacen.

### Que falta para el modelo correcto

- Resolver productos activos sin `nfamilia_id`.
- Definir si `ncategoria_id` debe ser obligatorio para productos activos.
- Definir si `npreventa > 0` debe ser obligatorio para productos activos.
- Decidir si `cfamilia`, `ccategoria`, `cgenerico`, `tvencimien`, `cproveedor` quedan como campos legacy/denormalizados o se retiran en una fase posterior.
- Alinear Drizzle schema con DB real.
- Agregar tests de familias/categorias/componentes/productos.
- Reconciliar stock producto-lotes.
- Definir fuente de verdad de stock por almacen/lote.

### Modelo objetivo deseado vs estado actual

| Requisito | Estado actual | Observacion |
|---|---|---|
| Nombre comercial | Existe | `bot_productos.cnombre` |
| Familia | Parcial | FK nueva + texto legacy; 4 productos activos sin FK |
| Categoria | Parcial/ok | FK nueva + texto legacy; 0 activos sin categoria FK en DB local |
| Composicion/principio activo | Parcial | M:N nuevo + `cgenerico` legacy |
| Precio compra no editable desde producto | Parcial/ok UI | Debe blindarse por tests/backend |
| Precio venta 1 | Existe | `npreventa` |
| Precio venta 2 | Existe | `npreventa_2` |
| Precio venta 3 | Existe | `npreventa_3` |
| Lotes | Existe | `bot_lotes` |
| Vencimiento | Existe | `bot_lotes.dfechavencimiento`; producto tiene `tvencimien` legacy/agregado |
| Stock por almacen | Parcial | lotes por almacen y vista; producto conserva stock agregado |
| Kardex | Existe | `bot_kardex` |

### Migraciones que harian falta

No aplicar ahora. Recomendadas:

- Migracion de limpieza de productos sin `nfamilia_id`.
- Migracion o script controlado para normalizar componentes migrados desde textos compuestos.
- Migracion para constraints condicionales de precios en productos activos, si el negocio confirma.
- Migracion para alinear/retirar columnas legacy solo despues de adaptar frontend/backend.
- Migracion para historial de migraciones si no se adopta una herramienta formal.

## 6. Radiografia de base de datos

### Estado general de la base local

Base auditada: `botica_db`.

Verificacion de esquema usada por Fastify:

- Resultado: OK.
- Tablas verificadas: 14.
- Columnas verificadas: 28.
- Timestamp observado: `2026-05-08T02:08:56.285Z`.

Verificacion CLI antigua:

- `backend-fastify/check-schema.js` devuelve OK, pero solo verifica 10 tablas y 14 columnas.
- El verificador real usado por `server.ts` es `backend-fastify/src/lib/schema-check.ts`.

Conteos relevantes:

- Productos activos: 11.
- Productos activos sin `nfamilia_id`: 4.
- Productos activos sin `ncategoria_id`: 0.
- Productos activos con `npreventa <= 0`: 3.
- Familias: 6.
- Categorias: 3.
- Componentes: 6.
- Stock activo agregado en productos: 1610.
- Stock activo en lotes: 1594.
- Diferencia detectada: 16 unidades.

### Tabla: `bot_usuarios`

- Proposito: usuarios del ERP y login local.
- Columnas principales: `nid`, `cnombre`, `cnrodni`, `cclave`, `cemail`, `cclerk_user_id`, `crol`, `cestado`, `lsuper`, `ladmin`, timestamps.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Indices/constraints: DNI unico; Clerk ID unico si existe.
- Estado: activa.
- Problemas detectados: mezcla rol texto con flags `ladmin/lsuper`; Clerk parcial.

### Tabla: `bot_permisos`

- Proposito: permisos por seccion para usuarios.
- Columnas principales: `nid`, `nusuario_id`, `cseccion`.
- Primary key: `nid`.
- Foreign keys: `nusuario_id -> bot_usuarios.nid`.
- Indices/constraints: se espera unique usuario/seccion.
- Estado: activa.
- Problemas detectados: permisos no modelan acciones, solo secciones.

### Tabla: `bot_productos`

- Proposito: catalogo principal de productos.
- Columnas principales: `nid`, `ccodigo`, `cnombre`, `cgenerico`, `ccategoria`, `cfamilia`, `nprecompra`, `npreventa`, `npreventa_2`, `npreventa_3`, `nstock`, `nstockmin`, `nproveedor_id`, `nfamilia_id`, `ncategoria_id`, `cestado`.
- Primary key: `nid`.
- Foreign keys: proveedor, familia, categoria.
- Indices/constraints: codigo unico, checks de stock/precios/estado, indices por estado/vencimiento/familia/categoria.
- Estado: activa con legacy.
- Problemas detectados:
  - Texto legacy para familia/categoria/composicion/proveedor.
  - Stock agregado duplicado frente a lotes.
  - Algunos productos sin familia FK y algunos sin precio vendible.

### Tabla: `bot_familias_producto`

- Proposito: catalogo de familias de producto.
- Columnas principales: `nid`, `cnombre`, `cdescripcion`, `cestado`, `tcreado`, `tmodifi`.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Indices/constraints: unique parcial por nombre activo.
- Estado: activa nueva.
- Problemas detectados: faltan pruebas especificas; productos legacy pueden quedar sin FK.

### Tabla: `bot_categorias_producto`

- Proposito: catalogo de categorias.
- Columnas principales: `nid`, `nfamilia_id`, `cnombre`, `cdescripcion`, `cestado`, timestamps.
- Primary key: `nid`.
- Foreign keys: `nfamilia_id -> bot_familias_producto.nid`.
- Indices/constraints: unique parcial por nombre activo, indice familia.
- Estado: activa nueva.
- Problemas detectados: regla de duplicado global por nombre puede limitar categorias homonimas en familias distintas.

### Tabla: `bot_componentes_producto`

- Proposito: catalogo de componentes/principios activos.
- Columnas principales: `nid`, `cnombre`, `cdescripcion`, `cestado`, timestamps.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Indices/constraints: nombre activo unico, nombre no vacio, estado.
- Estado: activa nueva.
- Problemas detectados: migracion desde texto generico puede requerir limpieza semantica.

### Tabla: `bot_producto_componentes`

- Proposito: relacion muchos-a-muchos producto-componente.
- Columnas principales: `nid`, `nproducto_id`, `ncomponente_id`, `cconcentracion`, `cforma`, `cnotas`, timestamps.
- Primary key: `nid`.
- Foreign keys: producto y componente.
- Indices/constraints: unique `nproducto_id/ncomponente_id`.
- Estado: activa nueva.
- Problemas detectados: no hay tests especificos de CRUD de composicion.

### Tabla: `bot_lotes`

- Proposito: stock por lote y almacen con vencimiento.
- Columnas principales: `nid`, `nproducto_id`, `ncompra_id`, `ccodigo_lote`, `dfechavencimiento`, `ncantidad`, `ncantidad_inicial`, `cestado`, `nversion`, `nalmacen_id`.
- Primary key: `nid`.
- Foreign keys: producto, compra, almacen.
- Indices/constraints: cantidad no negativa, estado, indices FEFO/producto/almacen/vencimiento.
- Estado: activa.
- Problemas detectados:
  - Drizzle schema usa columna `tvencimiento`, no la real `dfechavencimiento`.
  - Stock agregado no coincide con productos.

### Tabla: `bot_kardex`

- Proposito: libro de movimientos de stock.
- Columnas principales: `nid`, `nproducto_id`, `ctipo`, `cref_tabla`, `nref_id`, `ncantidad`, `nstock_anterior`, `nstock_nuevo`, `cdetalle`, `nusuario_id`, `cusuario`, `tcreado`, `nlote_id`, `ccodigo_lote`, `nalmacen_id`.
- Primary key: `nid`.
- Foreign keys: producto, lote, almacen, usuario.
- Indices/constraints: indices por producto, lote, almacen, fecha/tipo.
- Estado: activa.
- Problemas detectados:
  - Drizzle schema usa `cmotivo/tcreacion`, no coincide.
  - Hay tabla legacy `kardex` separada sin uso activo.

### Tabla: `bot_movimientos_almacen`

- Proposito: movimientos fisicos de productos/lotes entre almacenes y por compras/ventas/devoluciones.
- Columnas principales: `nid`, `nproducto_id`, `nlote_id`, `nalmacen_origen_id`, `nalmacen_destino_id`, `ctipo_movimiento`, `ncantidad`, `cdetalle`, `nusuario_id`, `cusuario`, `tcreado`.
- Primary key: `nid`.
- Foreign keys: producto, lote, almacenes, usuario.
- Indices/constraints: tipo/cantidad.
- Estado: activa.
- Problemas detectados: Drizzle schema usa `nalmacen_id/tcreacion`, no coincide.

### Tabla: `bot_compras`

- Proposito: cabecera de compras.
- Columnas principales: `nid`, `ccodigo`, `nproveedor_id`, `cproveedor`, `cdocumento`, `ntotal`, `cnotas`, `cestado`, `nusuario_id`, `tcreado`, `ctipo_comprobante`, `nalmacen_id`.
- Primary key: `nid`.
- Foreign keys: proveedor, usuario, almacen.
- Indices/constraints: codigo unico, tipo comprobante.
- Estado: activa.
- Problemas detectados: `cproveedor` denormalizado; solo FACTURA soportada en backend.

### Tabla: `bot_compras_det`

- Proposito: detalle de compras.
- Columnas principales: `nid`, `ncompra_id`, `nproducto_id`, `ncantidad`, `npreunit`, `nsubtotal`.
- Primary key: `nid`.
- Foreign keys: compra, producto.
- Indices/constraints: cantidades/precios.
- Estado: activa.
- Problemas detectados:
  - No se detecto columna `nlote_id` real aunque el schema Drizzle la declara.
  - Drizzle usa `nprecio_unit`, DB real usa `npreunit`.

### Tabla: `bot_ventas`

- Proposito: cabecera de ventas.
- Columnas principales: `nid`, `ccodigo`, `cnrodni_cli`, `ccliente`, `cmetpago`, `carea`, `ccaja`, `nsubtotal`, `nigv`, `ntotal`, `cnotas`, `cestado`, `nusuario_id`, `tcreado`, `ncliente_clinico_id`, `nalmacen_id`.
- Primary key: `nid`.
- Foreign keys: usuario, paciente/cliente clinico, almacen.
- Indices/constraints: codigo unico, estado.
- Estado: activa.
- Problemas detectados: caja se guarda como texto `ccaja`, no FK fuerte a `bot_caja`.

### Tabla: `bot_ventas_det`

- Proposito: lineas de venta.
- Columnas principales: `nid`, `nventa_id`, `nproducto_id`, `ncantidad`, `npreunit`, `nsubtotal`, `ctipo`, `nservicio_id`, `cdescripcion`, `nlote_id`, `clote_codigo`.
- Primary key: `nid`.
- Foreign keys: venta, producto, servicio, lote.
- Indices/constraints: tipo linea.
- Estado: activa.
- Problemas detectados:
  - `nproducto_id` permite null para servicios; correcto si se valida por `ctipo`.
  - Drizzle usa `nprecioUnit`, DB real usa `npreunit`.

### Tabla: `bot_caja`

- Proposito: aperturas/cierres de caja.
- Columnas principales: `nid`, usuario/cajero, montos, estado, fechas.
- Primary key: `nid`.
- Foreign keys: usuario si existe segun schema.
- Indices/constraints: no auditado en detalle.
- Estado: parcial/activa.
- Problemas detectados: ventas no enlazan por FK a caja; no se detecto tabla de movimientos de caja granular.

### Tabla: `bot_proveedores`

- Proposito: proveedores.
- Columnas principales: `nid`, `cnombre`, `cruc`, `cdireccion`, `ctelefono`, `cemail`, `ccontacto`, `cestado`, timestamps.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Indices/constraints: RUC unico activo o deduplicado segun migracion.
- Estado: activa.
- Problemas detectados: producto/compra conservan nombres denormalizados.

### Tabla: `bot_pacientes`

- Proposito: pacientes/clientes clinicos.
- Columnas principales: `nid`, `cnombre`, `cdni`, `ctelefono`, `nedad`, `cnotas`, `tultima_visita`, `cestado`, timestamps.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Indices/constraints: DNI posiblemente no unico estricto.
- Estado: parcial.
- Problemas detectados: frontera cliente comercial vs paciente clinico no completamente definida.

### Tabla: `bot_servicios`

- Proposito: servicios/procedimientos.
- Columnas principales: `nid`, `cnombre`, categoria, precio, descripcion, estado.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Estado: parcial.
- Problemas detectados: integracion con ventas requiere pruebas.

### Tabla: `bot_almacenes`

- Proposito: almacenes por local.
- Columnas principales: `nid`, `nlocal_id`, `cnombre`, `ctipo_almacen`, `bpermite_venta`, `bpermite_consumo_clinico`, `cestado`, timestamps.
- Primary key: `nid`.
- Foreign keys: local.
- Indices/constraints: tipo/estado.
- Estado: activa.
- Problemas detectados: reglas de desactivacion con lotes no auditadas.

### Tabla: `bot_locales`

- Proposito: locales/sedes.
- Columnas principales: `nid`, `cnombre`, direccion, telefono, estado, timestamps.
- Primary key: `nid`.
- Foreign keys: no aplica.
- Estado: activa.
- Problemas detectados: reglas de desactivacion con almacenes no auditadas.

### Tabla: `bot_auditoria`

- Proposito: log de acciones.
- Columnas principales: `nid`, `nusuario_id`, `cusuario`, `caccion`, `ctabla`, `nregistro_id`, `cdetalle`, `tcreado`.
- Primary key: `nid`.
- Foreign keys: usuario opcional.
- Estado: activa parcial.
- Problemas detectados: Drizzle schema usa `tcreacion`, DB real usa `tcreado`; cobertura no uniforme.

### Otras tablas detectadas

| Tabla | Estado | Observacion |
|---|---|---|
| `bot_citas` | parcial | modulo citas, CRUD basico |
| `bot_medicos` | parcial | medicos para flujo clinico |
| `bot_historial` | parcial | historial clinico |
| `bot_recetas` | parcial | cabecera de recetas |
| `bot_recetas_det` | parcial | detalle de recetas |
| `bot_transferencias` | parcial/legacy | transferencias no necesariamente igual a traslados de almacen |
| `bot_transferencias_det` | parcial/legacy | detalle transferencias |
| `bot_alquileres` | parcial | modulo alquileres |
| `bot_deudores` | parcial | modulo deudores |
| `bot_inventario_var` | parcial | inventario variable; sin filas locales |
| `kardex` | legacy | tabla no prefijada, 0 filas |
| `tipos_movimiento` | legacy | catalogo no prefijado |

### Problemas transversales detectados

- Tablas legacy duplicadas: `kardex` vs `bot_kardex`.
- Campos texto que deberian ser FK:
  - `bot_productos.cfamilia`
  - `bot_productos.ccategoria`
  - `bot_productos.cgenerico`
  - `bot_productos.cproveedor`
  - `bot_compras.cproveedor`
  - `bot_ventas.ccaja`
- Campos calculados/duplicados:
  - `bot_productos.nstock` vs suma de `bot_lotes.ncantidad`.
  - `bot_productos.tvencimien` vs lote vencimiento.
  - `bot_productos.nprecompra` vs historico de compras.
- Riesgo de datos huerfanos:
  - Auditoria y rutas legacy si escriben sin FKs.
  - MCP directo si inserta sin reglas.
- Falta de constraints:
  - Caja-venta por FK.
  - Precio principal positivo para productos activos, si se exige.
  - Obligacion de familia/categoria para productos activos, si se exige.

## 7. Normalizacion de base de datos

### Evaluacion 1FN

La base cumple parcialmente 1FN: la mayoria de tablas tienen columnas atomicas y PKs. Excepciones o deudas:

- `bot_productos.cgenerico` contiene composicion libre y puede contener varios componentes en un solo texto.
- `bot_productos.ccategoria` y `cfamilia` duplican catalogos.
- `bot_productos.cproveedor` duplica proveedor.
- Textos compuestos de componentes pueden requerir separacion semantica.

### Evaluacion 2FN

La mayoria de tablas con PK simple cumplen 2FN por estructura. Riesgos:

- Tablas detalle guardan subtotales calculados; es aceptable como snapshot de venta/compra, pero debe tratarse como dato historico.
- En productos, atributos derivados como stock agregado y ultimo costo no dependen estrictamente solo de producto como fuente primaria, sino de lotes/compras.

### Evaluacion 3FN

La base no esta completamente en 3FN:

- Producto guarda familia/categoria/proveedor por texto y por FK.
- Producto guarda stock agregado derivado de lotes.
- Producto guarda vencimiento agregado derivado de lotes.
- Compra guarda proveedor por FK y texto.
- Venta guarda caja como texto.
- Permisos no normalizan roles/acciones.

### Tablas bien encaminadas

- `bot_lotes`: buen modelo para lote/almacen/vencimiento.
- `bot_kardex`: buen historico de stock si se usa consistentemente.
- `bot_componentes_producto` + `bot_producto_componentes`: buen modelo M:N.
- `bot_familias_producto` y `bot_categorias_producto`: buen inicio de catalogos.
- `bot_almacenes` + `bot_locales`: buen modelo base para ubicaciones.

### Tablas que necesitan normalizacion

- `bot_productos`: retirar o congelar campos texto legacy en fase posterior.
- `bot_caja`/`bot_ventas`: enlazar venta a caja real.
- `bot_permisos`: roles/acciones si se requiere control fino.
- `bot_servicios`: categorizar si crece.
- `bot_pacientes`/clientes: separar cliente comercial de paciente clinico si el negocio lo exige.

### Campos que deberian pasar a catalogos o relaciones

- Familia: ya tiene catalogo; falta limpieza final.
- Categoria: ya tiene catalogo; falta decidir obligatoriedad.
- Composicion: ya tiene M:N; falta limpieza de `cgenerico`.
- Proveedor: ya tiene FK; falta eliminar dependencia de texto.
- Caja: deberia ser FK a apertura/cierre activa.

### Relaciones muchos-a-muchos necesarias

- Producto-componente: ya existe.
- Usuario-roles/roles-permisos: recomendable Fase 02 si crece.
- Producto-proveedor: opcional si un producto puede tener varios proveedores.
- Receta-productos/servicios: ya hay receta det, requiere revision.

## 8. Modelo objetivo recomendado

### Fase 01 obligatoria

#### `usuarios`

- Proposito: acceso al sistema.
- Campos minimos: id, DNI, nombre, clave hash, email, estado, flags admin/super, timestamps.
- Relaciones: permisos, auditoria, ventas, compras, caja.
- Reglas: DNI unico, clave hasheada, estado activo para login.
- Riesgos: mezcla Clerk/local.

#### `permisos`

- Proposito: habilitar secciones/acciones.
- Campos minimos: usuario_id, seccion, accion opcional.
- Relaciones: usuario.
- Reglas: admin/super bypass controlado.
- Riesgos: permisos solo por seccion pueden ser insuficientes.

#### `productos`

- Proposito: catalogo comercial.
- Campos minimos: codigo, nombre comercial, familia_id, categoria_id, presentacion, laboratorio, proveedor_id opcional, precio venta 1/2/3, estado.
- Relaciones: familia, categoria, proveedor, componentes, lotes.
- Reglas: codigo unico, nombre obligatorio, al menos precio vendible, precio compra no editable.
- Riesgos: no duplicar stock si no se reconcilia.

#### `familias_producto`

- Proposito: grupo general.
- Campos minimos: nombre, descripcion, estado.
- Relaciones: productos, categorias.
- Reglas: nombre activo unico; no desactivar si productos activos.
- Riesgos: productos legacy sin familia.

#### `categorias_producto`

- Proposito: clasificacion especifica.
- Campos minimos: familia_id opcional/requerido, nombre, descripcion, estado.
- Relaciones: familia, productos.
- Reglas: nombre activo unico o unico por familia segun negocio; no desactivar si productos activos.
- Riesgos: regla de duplicado debe definirse.

#### `componentes_producto`

- Proposito: principio activo.
- Campos minimos: nombre, descripcion, estado.
- Relaciones: producto_componentes.
- Reglas: nombre activo unico; no desactivar si usado.
- Riesgos: nombres compuestos migrados.

#### `producto_componentes`

- Proposito: composicion de producto.
- Campos minimos: producto_id, componente_id, concentracion, forma, notas.
- Relaciones: producto, componente.
- Reglas: no duplicar componente por producto.
- Riesgos: concentracion como texto requiere disciplina.

#### `proveedores`

- Proposito: fuente de compras.
- Campos minimos: nombre, RUC, contacto, telefono, email, estado.
- Relaciones: compras, productos opcional.
- Reglas: RUC unico activo si existe.
- Riesgos: datos denormalizados en productos/compras.

#### `compras`

- Proposito: ingreso de mercaderia.
- Campos minimos: codigo, proveedor_id, almacen_id, comprobante, documento, total, usuario_id, estado.
- Relaciones: proveedor, almacen, usuario, detalle.
- Reglas: transaccion, no permitir producto/lote invalido.
- Riesgos: documentos duplicados si no hay unique proveedor/documento.

#### `compras_det`

- Proposito: lineas de compra.
- Campos minimos: compra_id, producto_id, cantidad, precio_unitario, subtotal, lote/vencimiento si aplica.
- Relaciones: compra, producto, lote.
- Reglas: cantidad/precio positivos.
- Riesgos: schema actual no guarda `nlote_id` real en detalle segun auditoria local.

#### `lotes`

- Proposito: stock real por lote y almacen.
- Campos minimos: producto_id, compra_id, almacen_id, codigo_lote, fecha_vencimiento, cantidad inicial, cantidad actual, estado.
- Relaciones: producto, compra, almacen.
- Reglas: FEFO, cantidad no negativa, vencimiento requerido.
- Riesgos: stock agregado desbalanceado.

#### `almacenes`

- Proposito: ubicacion de stock.
- Campos minimos: local_id, nombre, tipo, permite_venta, permite_consumo, estado.
- Relaciones: local, lotes, ventas/compras/movimientos.
- Reglas: solo almacenes vendibles en POS.
- Riesgos: desactivar con stock.

#### `ventas`

- Proposito: salida comercial.
- Campos minimos: codigo, cliente, metodo_pago, caja_id, almacen_id, usuario_id, subtotal, igv, total, estado.
- Relaciones: detalle, usuario, caja, almacen, paciente opcional.
- Reglas: transaccion, precio validado, stock FEFO.
- Riesgos: venta sin caja abierta.

#### `ventas_det`

- Proposito: lineas de venta.
- Campos minimos: venta_id, tipo, producto_id/servicio_id, lote_id, cantidad, precio_unitario, subtotal.
- Relaciones: venta, producto, servicio, lote.
- Reglas: producto requiere lote si hay trazabilidad; servicio no descuenta stock.
- Riesgos: lineas mixtas requieren validacion estricta.

#### `caja`

- Proposito: apertura/cierre y control monetario.
- Campos minimos: usuario_id, monto_inicial, monto_final, estado, apertura, cierre.
- Relaciones: ventas, usuario.
- Reglas: una caja abierta por usuario/local; vender requiere caja abierta.
- Riesgos: caja actual no esta fuertemente ligada a ventas.

#### `kardex`

- Proposito: auditoria de stock.
- Campos minimos: producto_id, lote_id, almacen_id, tipo, referencia, cantidad, stock anterior/nuevo, usuario, timestamp.
- Relaciones: producto, lote, almacen, usuario.
- Reglas: todo movimiento de stock debe generar kardex.
- Riesgos: rutas paralelas pueden omitirlo.

#### `auditoria`

- Proposito: log de operaciones sensibles.
- Campos minimos: usuario_id, usuario, accion, tabla, registro_id, detalle, timestamp.
- Relaciones: usuario.
- Reglas: registrar ventas, anulaciones, compras, ajustes, usuarios, catalogos.
- Riesgos: cobertura incompleta.

### Fase 02

#### `pacientes`

- Proposito: pacientes clinicos.
- Campos minimos: DNI, nombre, telefono, datos clinicos basicos, estado.
- Relaciones: recetas, historial, ventas clinicas.
- Reglas: DNI opcional o unico segun negocio.
- Riesgos: mezclar paciente con cliente anonimo.

#### `medicos`

- Proposito: profesionales que emiten recetas/servicios.
- Campos minimos: nombre, CMP, especialidad, contacto, estado.
- Relaciones: recetas, citas.
- Reglas: CMP unico si aplica.
- Riesgos: baja prioridad para botica basica.

#### `historial`

- Proposito: eventos clinicos.
- Campos minimos: paciente_id, fecha, descripcion, usuario/medico.
- Relaciones: paciente, medico, usuario.
- Reglas: privacidad y auditoria.
- Riesgos: datos sensibles.

#### `recetas`

- Proposito: prescripciones.
- Campos minimos: paciente_id, medico_id, fecha, observaciones, estado.
- Relaciones: receta_det, productos.
- Reglas: trazabilidad de receta para productos controlados.
- Riesgos: regulatorio.

#### `servicios`

- Proposito: procedimientos no inventariables.
- Campos minimos: nombre, categoria, precio, estado.
- Relaciones: ventas_det.
- Reglas: no descuenta stock.
- Riesgos: caja/impuestos.

#### `deudores`

- Proposito: cuentas por cobrar.
- Campos minimos: cliente/paciente, monto, fecha, estado.
- Relaciones: ventas.
- Reglas: pago parcial, saldo.
- Riesgos: requiere caja.

#### `alquileres`

- Proposito: alquiler de equipos u otros.
- Campos minimos: cliente, articulo, periodo, monto, estado.
- Relaciones: caja/ventas.
- Reglas: devolucion y garantia.
- Riesgos: fuera de Fase 01.

#### `reportes avanzados`

- Proposito: analitica operativa/financiera.
- Campos minimos: no aplica como tabla unica.
- Relaciones: ventas/compras/stock/caja.
- Reglas: exactitud contable.
- Riesgos: no construir sobre stock/caja inconsistentes.

## 9. Radiografia de API backend

### Auth

| Metodo | Ruta | Archivo | Auth | Permisos | Request esperado | Response esperado | Estado | Observaciones |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `backend-fastify/src/routes/auth.routes.ts` | no | no | DNI y clave | token/usuario/sesion | funcional | login local |
| POST | `/api/v1/auth/logout` | `backend-fastify/src/routes/auth.routes.ts` | parcial | no | vacio | ok | funcional | limpia cookie/token |
| GET | `/api/v1/auth/session` | `backend-fastify/src/routes/auth.routes.ts` | si | no | token/cookie | usuario/permisos | funcional | usado por AuthContext |
| POST | `/api/v1/auth/clerk-sync` | `backend-fastify/src/routes/auth.routes.ts` | variable | no | datos Clerk | usuario/link | parcial | flujo Clerk opcional |

### Usuarios

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/usuarios` | `users.routes.ts` | si | usuarios/admin | funcional | lista usuarios y estado Clerk |
| POST | `/api/v1/usuarios` | `users.routes.ts` | si | admin/super | funcional parcial | crea usuario |
| GET | `/api/v1/usuarios/:id/clerk-link` | `users.routes.ts` | si | admin/super | funcional | estado link |
| POST | `/api/v1/usuarios/:id/clerk-link` | `users.routes.ts` | si | admin/super | funcional | vincula Clerk |
| DELETE | `/api/v1/usuarios/:id/clerk-link` | `users.routes.ts` | si | admin/super | funcional | desvincula Clerk |

### Productos

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/inventario` | `inventory.routes.ts` | si | inventario/lectura | funcional | lista productos |
| POST | `/api/v1/inventario` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | crea/edita producto y updatePrices |
| GET | `/api/v1/inventario/search` | `inventory.routes.ts` | si | ventas/inventario | funcional | busqueda POS |
| GET | `/api/v1/inventario/distribucion` | `inventory.routes.ts` | si | inventario | funcional parcial | distribucion stock |

### Familias

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/inventario/familias` | `inventory.routes.ts` | si | no estricto | funcional parcial | lista/busca |
| POST | `/api/v1/inventario/familias` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | bloquea duplicado |
| PATCH | `/api/v1/inventario/familias/:id` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | bloquea desactivar si uso |
| DELETE | `/api/v1/inventario/familias/:id` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | borrado logico |

### Categorias

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/inventario/categorias` | `inventory.routes.ts` | si | no estricto | funcional parcial | lista/busca/filtra familia |
| POST | `/api/v1/inventario/categorias` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | valida familia activa |
| PATCH | `/api/v1/inventario/categorias/:id` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | actualiza productos asociados |
| DELETE | `/api/v1/inventario/categorias/:id` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | borrado logico |

### Componentes

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/inventario/componentes` | `inventory.routes.ts` | si | no estricto | funcional parcial | lista/busca |
| POST | `/api/v1/inventario/componentes` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | crea componente |
| PATCH | `/api/v1/inventario/componentes/:id` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | bloquea si uso al inactivar |
| DELETE | `/api/v1/inventario/componentes/:id` | `inventory.routes.ts` | si | inventario/admin | funcional parcial | borrado logico |

### Inventario

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/inventario-var` | `misc-inventory.routes.ts` | si | inventario-var | parcial | inventario variable |
| POST | `/api/v1/inventario-var` | `misc-inventory.routes.ts` | si | inventario-var | parcial | CRUD simple |
| POST | `/api/v1/ajustes` | `ajustes.routes.ts` | si | admin/inventario | riesgoso | SQL parece desalineado |
| POST | `/api/v1/ajustes/ajustes` | `ajustes.routes.ts` | si | admin/inventario | legacy/riesgoso | alias legacy |

### Lotes

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/lotes` | `lotes.routes.ts` | si | inventario/ventas | funcional | lista lotes |
| GET | `/api/v1/lotes/disponibles/:productoId` | `lotes.routes.ts` | si | ventas/inventario | funcional | lotes vendibles |
| GET | `/api/v1/lotes/fefo/:productoId` | `lotes.routes.ts` | si | ventas/inventario | funcional | orden FEFO |
| GET | `/api/v1/lotes/consistencia` | `lotes.routes.ts` | si | inventario | funcional parcial | diagnostico |

### Compras

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/compras` | `purchases.routes.ts` | si | compras | funcional | fallback por columnas faltantes |
| POST | `/api/v1/compras` | `purchases.routes.ts` | si | compras | avanzado | transaccion, lote, stock, kardex |

### Ventas

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/ventas` | `sales.routes.ts` | si | ventas | funcional | lista ventas |
| POST | `/api/v1/ventas` | `sales.routes.ts` | si | ventas | avanzado | valida precio configurado y FEFO |
| GET | `/api/v1/ventas/:id` | `sales.routes.ts` | si | ventas | funcional | detalle |
| PATCH | `/api/v1/ventas/:id/anular` | `sales.routes.ts` | si | admin/super | avanzado | revierte stock/lotes/kardex |

### Caja

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/caja` | `caja.routes.ts` | si | caja | parcial | caja actual y resumen |
| POST | `/api/v1/caja` | `caja.routes.ts` | si | caja | parcial | abrir/cerrar |

### Proveedores

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/proveedores` | `providers.routes.ts` | si | compras/proveedores | funcional | lista proveedores |
| POST | `/api/v1/proveedores` | `providers.routes.ts` | si | proveedores/admin | funcional | crea/edita segun payload |

### Clientes/Pacientes

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/pacientes` | `patients.routes.ts` | si | pacientes | parcial | CRUD basico |
| POST | `/api/v1/pacientes` | `patients.routes.ts` | si | pacientes | parcial | crea paciente |

### Reportes

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/reportes` | `reports.routes.ts` | si | reportes | parcial | no auditado profundo |

### Auditoria

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/auditoria` | `audit.routes.ts` | si | auditoria/admin | parcial | consulta logs |

### Almacenes

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/locales` | `locales.routes.ts` | si | locales/almacenes | parcial | lista locales |
| POST | `/api/v1/locales` | `locales.routes.ts` | si | admin | parcial | crea local |
| GET | `/api/v1/almacenes` | `almacenes.routes.ts` | si | almacenes | funcional parcial | usado por compras/POS |
| POST | `/api/v1/almacenes` | `almacenes.routes.ts` | si | admin | parcial | crea almacen |
| GET | `/api/v1/almacenes/stock` | `almacenes.routes.ts` | si | inventario | parcial | stock por almacen |

### Traslados

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| POST | `/api/v1/traslados-almacen` | `traslados-almacen.routes.ts` | si | inventario/almacenes | funcional | mueve lote/stock |
| GET | `/api/v1/traslados-almacen` | `traslados-almacen.routes.ts` | si | inventario/almacenes | funcional | historial |
| POST | `/api/v1/traslados-almacen/devolucion-cliente` | `traslados-almacen.routes.ts` | si | ventas/inventario | funcional parcial | devolucion fisica |
| POST | `/api/v1/traslados-almacen/devolucion-proveedor` | `traslados-almacen.routes.ts` | si | compras/inventario | funcional parcial | devolucion a proveedor |

### Consistencia

| Metodo | Ruta | Archivo | Auth | Permisos | Estado | Observaciones |
|---|---|---|---|---|---|---|
| GET | `/api/v1/consistencia/stock` | `consistencia.routes.ts` | si | inventario/admin | funcional | compara producto vs lotes |
| GET | `/api/v1/consistencia/lotes` | `consistencia.routes.ts` | si | inventario/admin | funcional | integridad lotes |
| GET | `/api/v1/consistencia/kardex` | `consistencia.routes.ts` | si | inventario/admin | funcional | integridad kardex |
| GET | `/api/v1/consistencia/resumen` | `consistencia.routes.ts` | si | inventario/admin | funcional | resumen |
| GET | `/api/v1/consistencia/alertas` | `consistencia.routes.ts` | si | inventario/admin | funcional | alertas |
| POST | `/api/v1/consistencia/reconciliar` | `consistencia.routes.ts` | si | admin/super para aplicar | funcional | dry-run por defecto |
| POST | `/api/v1/consistencia/marcar-vencidos` | `consistencia.routes.ts` | si | inventario/admin | funcional parcial | marca lotes vencidos |

### Otros endpoints detectados

| Modulo | Endpoints | Estado |
|---|---|---|
| Dashboard | `GET /api/v1/dashboard` | parcial |
| Citas | `GET/POST /api/v1/citas` | parcial |
| Medicos | `GET/POST /api/v1/medicos` | parcial |
| Historial | `GET/POST /api/v1/historial` | parcial |
| Recetas | `GET/POST /api/v1/recetas` | parcial |
| Perfil | `GET/POST /api/v1/perfil` | parcial |
| Alquileres | `GET/POST /api/v1/alquileres` | parcial |
| Deudores | `GET/POST /api/v1/deudores` | parcial |
| Transferencias | `GET/POST /api/v1/transferencias` | legacy/parcial |
| Servicios | `GET/POST /api/v1/servicios` | parcial |
| Sistema | `GET /api/v1/system/schema-status` | funcional parcial |

### Endpoints no encontrados

- `/api/v1/productos/familias`: no encontrado; la ruta real es `/api/v1/inventario/familias`.
- `/api/v1/productos/categorias`: no encontrado; la ruta real es `/api/v1/inventario/categorias`.
- `/api/v1/productos/componentes`: no encontrado; la ruta real es `/api/v1/inventario/componentes`.
- CRUD completo PATCH/DELETE para varios modulos simples: no encontrado o no auditado como existente.

## 10. Radiografia frontend

### Router

El router real esta en `frontend/src/app/router.tsx`. Usa rutas publicas para login y rutas protegidas bajo `/panel`. `AppShell` envuelve paginas internas. `PanelIndexRoute` redirige o selecciona pagina inicial. `RequireAuth` protege sesion y `RequireSection` controla permisos.

### Layout

`frontend/src/components/app-shell.tsx` y secciones en `frontend/src/lib/app-sections.ts` definen la navegacion. Perfil queda accesible para usuarios autenticados. Admin/super acceden a todas las secciones.

### Guards

- `RequireAuth`: valida estado de AuthContext.
- `RequireSection`: valida permisos del usuario para seccion.

### AuthContext

`frontend/src/context/auth-context.tsx` administra:

- Usuario actual.
- Loading/session check.
- Login/logout.
- Token local.
- Sincronizacion de sesion con backend.

### API client

`frontend/src/lib/api.ts`:

- Usa `/api/v1`.
- Incluye cookies.
- Incluye Bearer token si existe.
- Normaliza errores en `Error`.
- Tiene tipos amplios para inventario, POS, usuarios, caja, compras, lotes y consistencia.

Riesgo: archivo grande y centralizado.

### Paginas listas o mas avanzadas

- Login.
- Ventas POS.
- Compras.
- Inventario/productos.
- Consistencia.
- Almacenes/traslados/devoluciones.
- Usuarios parcial.
- Proveedores parcial.

### Paginas parciales

- Caja.
- Reportes.
- Pacientes.
- Procedimientos/servicios.
- Medicos.
- Historial/recetas.
- Alquileres.
- Deudores.
- Inventario variable.
- Auditoria.
- Perfil.
- Alertas.

### POS

El POS es el frontend mas probado:

- Busqueda de producto.
- Seleccion de lote FEFO informativa.
- Seleccion de precio configurado.
- Carrito.
- Totales.
- Pago.
- Modal de confirmacion.

Riesgos:

- Necesita e2e con backend real para asegurar stock, lote y caja.

### Formularios

Los formularios son principalmente componentes controlados dentro de paginas. Inventario concentra muchos modales/tabs en un unico archivo.

### Tablas

Tablas simples HTML/componentes UI, con busqueda y acciones. No se detecta data-grid externo.

### Modales

Dialogos propios en componentes UI. Inventario usa modales para producto, precios, familia, categoria y componente.

### Manejo loading/error

Patron con estados locales, `toast` y mensajes de error. No hay sistema global uniforme de errores mas alla del cliente API.

### Tests frontend

Detectados:

- `frontend/src/pages/compras-page.test.tsx`
- `frontend/src/pos/hooks/usePOS.test.ts`
- `frontend/src/pos/utils/posUtils.test.ts`
- `frontend/src/pos/components/Cart.test.tsx`

Faltan tests para:

- Login.
- Inventario/catalogos/componentes.
- Caja.
- Usuarios.
- Almacenes/locales.
- Consistencia UI.
- Flujos e2e.

## 11. Radiografia backend

### `server.ts`

`backend-fastify/src/server.ts`:

- Crea Fastify.
- Registra CORS, cookies, JWT, Swagger en dev/test, Helmet, rate limit, DB, Drizzle, auth y error handler.
- Registra health checks.
- Ejecuta schema check fail-fast antes de rutas.
- Registra rutas bajo `/api/v1`.
- Escucha en puerto `BOTICA_FASTIFY_PORT` o `3000`.

Riesgo:

- Si faltan migraciones, Fastify no arranca y frontend muestra 502.

### Plugins

- DB: correcto para `BOTICA_DB_*`/`DB_*`.
- Drizzle: util pero desalineado en algunas tablas.
- Auth: punto fuerte, con usuario enriquecido y permisos.
- Error handler: traduce errores conocidos, buen punto de partida.

### Rutas bien encaminadas

- `sales.routes.ts`
- `purchases.routes.ts`
- `kardex.routes.ts`
- `lotes.routes.ts`
- `consistencia.routes.ts`
- `traslados-almacen.routes.ts`
- `providers.routes.ts`
- `users.routes.ts`
- `inventory.routes.ts`, aunque grande.

### Rutas criticas

- Ventas: afecta stock, lotes, kardex y dinero.
- Compras: afecta costo, stock, lotes, kardex.
- Kardex/ajustes: afecta stock.
- Traslados/devoluciones: afecta stock por almacen.
- Caja: afecta dinero.
- Usuarios/permisos: afecta seguridad.

### Rutas que mezclan demasiada logica

- `inventory.routes.ts`: catalogos, productos, componentes, busqueda y distribucion.
- `sales.routes.ts`: por criticidad, seria candidata a servicios aunque hoy tiene pruebas.
- `purchases.routes.ts`: por transaccion de compras/lotes/kardex.
- `consistencia.routes.ts`: diagnostico y reconciliacion.

### Rutas que necesitan servicios

- Ventas.
- Compras.
- Inventario/productos.
- Kardex/stock.
- Caja.
- Consistencia.

### Rutas que necesitan permisos mas estrictos

- `POST /api/v1/ajustes`.
- `POST /api/v1/kardex/ajuste`.
- `POST /api/v1/consistencia/reconciliar` cuando `apply=true`.
- Anulacion de ventas.
- Usuarios/Clerk link.
- Catalogos si afectan productos activos.

### SQL crudo

Predomina en rutas criticas. Esto es aceptable por control transaccional, pero exige:

- Tests.
- Queries consistentes.
- Evitar duplicar logica.
- Alinear nombres de columnas.

### Transacciones

Buenas en:

- Compras.
- Ventas.
- Anulacion de ventas.
- Traslados/devoluciones.
- Kardex ajuste probado.

Riesgo:

- Rutas simples y `ajustes.routes.ts` pueden no tener la misma solidez.

### Validaciones

Fuertes en ventas/compras/kardex/proveedores/consistencia.

Basicas en modulos CRUD simples.

### Tests backend

Detectados:

- `ajustes.test.ts`
- `catalogos-compras.test.ts`
- `traslados-almacen.test.ts`
- `providers.test.ts`
- `kardex.test.ts`
- `schema-check.test.ts`
- `inventory-prices.test.ts`
- `users.test.ts`
- `consistencia.test.ts`
- `sales.test.ts`
- `purchases.test.ts`

Cobertura fuerte en nucleos criticos, pero faltan tests directos de auth, inventario completo, catalogos de producto y caja.

## 12. Flujo real de compras

### Como se registra una compra

El frontend en `frontend/src/pages/compras-page.tsx` carga proveedores, almacenes e inventario. Al enviar, llama API de compras con proveedor, almacen destino, comprobante, documento, items, lote, vencimiento, cantidad y precio unitario.

El backend en `backend-fastify/src/routes/purchases.routes.ts`:

1. Requiere autenticacion y permiso de compras.
2. Valida proveedor activo.
3. Valida almacen activo.
4. Valida tipo de comprobante, actualmente FACTURA.
5. Valida documento.
6. Valida items.
7. Inicia transaccion.
8. Inserta `bot_compras`.
9. Inserta `bot_compras_det`.
10. Bloquea/actualiza producto.
11. Actualiza `bot_productos.nstock`.
12. Actualiza `bot_productos.nprecompra`.
13. Crea o actualiza `bot_lotes`.
14. Inserta `bot_kardex` tipo COMPRA.
15. Inserta `bot_movimientos_almacen`.
16. Inserta auditoria.
17. Commit.

### Tablas que toca

- `bot_compras`
- `bot_compras_det`
- `bot_productos`
- `bot_lotes`
- `bot_kardex`
- `bot_movimientos_almacen`
- `bot_auditoria`
- `bot_proveedores`
- `bot_almacenes`

### Como se crea lote

Si no existe lote por producto/codigo/almacen, inserta en `bot_lotes` con cantidad inicial/actual y vencimiento. Si existe, actualiza cantidad.

### Como se actualiza stock

Suma cantidad al stock agregado de producto y al lote correspondiente.

### Como se registra kardex

Inserta movimiento tipo COMPRA con cantidad positiva, stock anterior/nuevo, producto, lote y almacen.

### Si hay transaccion

Si. El flujo usa transaccion y rollback ante error.

### Validaciones existentes

- Auth.
- Permiso.
- Proveedor.
- Almacen.
- Tipo comprobante.
- Documento.
- Producto activo.
- Cantidad/precio.
- Lote/vencimiento.
- Faltas de migracion con errores claros.

### Riesgos

- Producto stock y lote stock pueden desbalancearse si otra ruta escribe fuera de esta transaccion.
- Precio compra en producto es ultimo costo, no costo historico por lote.
- Schema Drizzle no coincide con detalle real de compras.

## 13. Flujo real de ventas

### Como vende el POS

El frontend `sales-page.tsx` usa `frontend/src/pos/hooks/usePOS.ts`. El usuario busca productos, agrega al carrito, selecciona precio si hay varios, informa pago y confirma venta.

### Como se selecciona producto

`apiPOSBuscarProductos` consulta `/api/v1/inventario/search`. El producto trae stock, precios y datos basicos. Al agregar, el POS consulta lotes disponibles.

### Como se calcula precio

Frontend:

- Calcula precios disponibles desde `precioVenta1`, `precioVenta2`, `precioVenta3`.
- Si hay uno, lo usa.
- Si hay varios, permite seleccionar.
- No permite precio invalido.

Backend:

- Lee `npreventa`, `npreventa_2`, `npreventa_3`.
- Compara en centavos.
- Rechaza precio arbitrario.
- Rechaza producto sin precio configurado.

### Como se descuenta stock

Backend descuenta:

- `bot_productos.nstock`.
- `bot_lotes.ncantidad` por lote FEFO si existen lotes.
- Registra movimientos y kardex.

### Como se usa FEFO

Selecciona lotes activos, no vencidos, cantidad positiva, almacen vendible/seleccionado, ordenados por fecha de vencimiento. Puede consumir varios lotes si la cantidad excede el primero.

### Como se registra kardex

Inserta movimientos de salida tipo VENTA con stock anterior/nuevo, lote y almacen.

### Como afecta caja

La venta guarda metodo de pago y campos monetarios. Caja puede consultar ventas del dia, pero no se detecto una FK fuerte venta-caja ni validacion obligatoria de caja abierta antes de vender.

### Como se anula venta

`PATCH /api/v1/ventas/:id/anular`:

- Requiere auth y admin/super.
- Bloquea venta.
- Cambia estado a anulada.
- Restaura stock producto.
- Restaura lote desde kardex/detalle.
- Inserta movimientos reversos.
- Inserta auditoria.

### Riesgos

- Si venta cae en fallback sin lotes, reduce stock agregado sin trazabilidad completa.
- Caja no esta estrictamente integrada.
- La exactitud depende de que producto stock y lotes esten reconciliados.

## 14. Flujo real de inventario

### Stock agregado

`bot_productos.nstock` guarda stock agregado. Se actualiza en compras, ventas, anulaciones, ajustes y posiblemente traslados/devoluciones.

Riesgo: esta duplicado frente a suma de lotes.

### Stock por lote

`bot_lotes.ncantidad` es la trazabilidad operativa por lote, vencimiento y almacen.

### Stock por almacen

Se modela con `bot_lotes.nalmacen_id` y vista `vw_stock_por_almacen`.

### Kardex

`bot_kardex` registra movimientos de stock. Ventas/compras/anulaciones/traslados lo usan.

### Ajustes

Hay dos rutas:

- `POST /api/v1/kardex/ajuste`: probada y alineada con kardex.
- `POST /api/v1/ajustes`: contrato legacy/oficial segun test, pero SQL parece desalineado con columnas reales.

### Consistencia

`/api/v1/consistencia/*` compara stock agregado, lotes y kardex. Base local ya muestra diferencia de 16 unidades entre productos y lotes.

### Alertas

Se basan en lotes, vencimientos y stock minimo.

### Vencimientos

Fuente correcta: `bot_lotes.dfechavencimiento`. Producto conserva `tvencimien`, que parece legacy/agregado.

### Riesgos de desbalance

- Herramientas MCP directas.
- Rutas legacy.
- Ajustes desalineados.
- Migraciones de stock inicial.
- Fallback de venta sin lotes.

## 15. Flujo real de caja

### Apertura

`POST /api/v1/caja` permite abrir caja para usuario con monto inicial.

### Cierre

`POST /api/v1/caja` permite cerrar caja y registrar montos.

### Relacion con ventas

`GET /api/v1/caja` resume ventas del dia/usuario, pero ventas no parecen exigir una caja abierta ni enlazan por FK a una caja especifica. `bot_ventas` tiene `ccaja` texto.

### Relacion con usuario

Caja opera por usuario autenticado.

### Movimientos de caja

No se detecto tabla separada de movimientos de caja. La caja parece apoyarse en apertura/cierre y ventas.

### Que falta

- Venta requiere caja abierta.
- FK venta-caja.
- Movimientos manuales: ingreso, egreso, retiro, diferencia.
- Auditoria de apertura/cierre.
- Tests.

## 16. Riesgos tecnicos actuales

| Riesgo | Archivo o tabla afectada | Impacto | Prioridad | Recomendacion |
|---|---|---|---|---|
| Fastify no arranca si schema check falla | `backend-fastify/src/server.ts`, `schema-check.ts` | Login 502 y API caida | alta | Asegurar migraciones completas antes de server |
| Login 502 por backend caido | `frontend/vite.config.ts`, `start.sh`, Fastify | Usuario no puede entrar | alta | Validar `/health` y login directo en start |
| `start.sh` busca SQL base/fix en raiz inexistente | `start.sh` | DB nueva puede quedar mal creada | alta | Corregir rutas o documentar bootstrap real |
| `start.sh` aplica solo migraciones 014-017 | `start.sh`, `ops/migrations` | DB nueva incompleta | alta | Crear runner ordenado de migraciones |
| `scripts/check-schema.js` apunta a ruta incorrecta | `scripts/check-schema.js` | Diagnostico roto | alta | Corregir wrapper |
| CLI schema check desactualizado | `backend-fastify/check-schema.js` | Falso OK | alta | Unificar con `src/lib/schema-check.ts` |
| Drizzle desalineado con DB real | `backend-fastify/src/db/schema.ts` | Queries futuras rotas | alta | Alinear schema o aislar Drizzle |
| Familia/categoria aun tienen texto libre legacy | `bot_productos` | Doble fuente de verdad | media | Completar migracion y limpieza gradual |
| Composicion migrada puede estar mal semantizada | `bot_componentes_producto` | Busqueda/composicion imprecisa | media | Limpieza de componentes compuestos |
| Precio compra puede ser editado fuera de API | MCP/DB directa | Costos incorrectos | media | Restringir escrituras directas y tests |
| Precio venta multiple sin constraint de precio 1 positivo | `bot_productos` | Productos no vendibles | media | Definir check para activos |
| Stock duplicado producto/lote | `bot_productos`, `bot_lotes` | Ventas/alertas incorrectas | alta | Reconciliar y definir fuente de verdad |
| Lint/tests pueden no cubrir modulos simples | frontend/backend tests | Regresiones silenciosas | media | Agregar tests focalizados |
| Legacy Supabase/PHP | `backend-fastify/supabase`, proxy `/api` | Confusion de arquitectura | media | Marcar legacy y aislar |
| MCP directo a DB | `mcp-server/src/index.ts` | Salta permisos/auditoria | alta | Limitar a lectura o usar API |
| Caja no enlazada a venta | `bot_caja`, `bot_ventas` | Cuadre financiero debil | alta | Exigir caja abierta y FK |
| `ajustes.routes.ts` desalineado | `backend-fastify/src/routes/ajustes.routes.ts` | Ajustes fallan o corrompen | alta | Usar ruta probada de kardex o corregir minimo |
| Doble prefijo migracion 006 | `ops/migrations` | Orden ambiguo | media | Renumerar en migracion futura controlada |
| Tabla legacy `kardex` | DB | Confusion con `bot_kardex` | baja/media | Marcar legacy |

## 17. Pendientes para continuar desarrollo

### Bloqueadores

- Confirmar que `./start.sh` levanta Fastify y `/health`.
- Corregir/verificar bootstrap de DB nueva.
- Unificar o corregir verificadores de esquema.
- Resolver ruta de `scripts/check-schema.js`.
- Reconciliar stock producto-lotes antes de pruebas de venta serias.
- Revisar `ajustes.routes.ts` antes de usar ajustes desde UI.

### Alta prioridad

- Endurecer venta-caja: no vender sin caja abierta si esa es la regla.
- Alinear Drizzle schema con DB real.
- Completar tests de familias/categorias/componentes.
- Completar test de producto que no edita precio compra.
- Resolver productos sin familia FK.
- Resolver productos con precio venta cero.
- Documentar flujo oficial de migraciones.

### Media prioridad

- Limpiar campos legacy despues de compatibilidad.
- Normalizar componentes migrados.
- Mejorar permisos por accion.
- Pruebas UI/e2e para POS/compras/inventario.
- Mejorar reportes.
- Fortalecer auditoria.

### Baja prioridad

- Archivar Supabase/PHP legacy.
- Separar archivos grandes de frontend en componentes menores.
- Crear servicios backend por dominio.
- Mejorar README y documentacion de entorno.
- Automatizar backups/cron con monitoreo.

## 18. Plan recomendado de desarrollo

### Paso 1: Estabilizar arranque/login

- Objetivo: que `./start.sh`, `/health` y login local funcionen siempre en una DB actual y en una DB nueva.
- Archivos:
  - `start.sh`
  - `scripts/check-schema.js`
  - `backend-fastify/check-schema.js`
  - `backend-fastify/src/lib/schema-check.ts`
  - `backend-fastify/src/server.ts`
  - `frontend/vite.config.ts`
- Riesgo: alto, afecta todo el sistema.
- Resultado esperado: backend operativo en puerto 3000 y login DNI `00000000` sin 502.

### Paso 2: Completar familia/categoria

- Objetivo: cerrar datos legacy y pruebas de CRUD catalogos.
- Archivos:
  - `frontend/src/pages/inventory-page.tsx`
  - `frontend/src/lib/api.ts`
  - `backend-fastify/src/routes/inventory.routes.ts`
  - `ops/migrations/016_productos_familias_categorias.sql`
- Riesgo: medio.
- Resultado esperado: todos los productos activos tienen familia/categoria validas o regla explicita de opcionalidad.

### Paso 3: Agregar/completar composicion

- Objetivo: asegurar que composicion M:N sea fuente principal y `cgenerico` quede solo compatibilidad.
- Archivos:
  - `inventory-page.tsx`
  - `api.ts`
  - `inventory.routes.ts`
  - `ops/migrations/017_productos_componentes.sql`
- Riesgo: medio.
- Resultado esperado: producto puede tener varios componentes sin duplicados y componentes usados no se desactivan.

### Paso 4: Agregar/fortalecer precios venta 1/2/3

- Objetivo: cerrar reglas de precios comerciales y productos vendibles.
- Archivos:
  - `inventory-page.tsx`
  - `sales-page.tsx`
  - `frontend/src/pos/*`
  - `sales.routes.ts`
  - `inventory.routes.ts`
  - `ops/migrations/015_productos_precios_venta.sql`
- Riesgo: alto por impacto en ventas.
- Resultado esperado: POS solo vende precios configurados y backend rechaza arbitrariedad.

### Paso 5: Auditar y normalizar DB

- Objetivo: resolver duplicados/legacy y alinear Drizzle.
- Archivos:
  - `backend-fastify/src/db/schema.ts`
  - `ops/migrations/*`
  - `docs/migrations/*`
- Riesgo: alto.
- Resultado esperado: una sola fuente de verdad de schema y migraciones reproducibles.

### Paso 6: Validar ventas/compras/stock/caja

- Objetivo: confirmar flujo completo operativo.
- Archivos:
  - `sales.routes.ts`
  - `purchases.routes.ts`
  - `caja.routes.ts`
  - `kardex.routes.ts`
  - `consistencia.routes.ts`
  - POS frontend.
- Riesgo: alto.
- Resultado esperado: compras ingresan lotes, ventas descuentan FEFO, anulaciones restauran, caja cuadra.

## 19. Migraciones recomendadas

No aplicar todavia. Propuestas para planificar.

### Migracion 018: historial de migraciones y bootstrap ordenado

- Nombre sugerido: `018_migration_history.sql`
- Objetivo: crear tabla de migraciones aplicadas o adoptar runner formal.
- Tablas afectadas: nueva `bot_migrations` opcional.
- Riesgo: bajo/medio.
- Orden: primero.
- SQL aproximado:
  - Crear tabla `bot_migrations(nombre text primary key, aplicada_en timestamp default now())`.
  - Registrar migraciones existentes despues de validar estado.

### Migracion 019: limpieza familia/categoria pendientes

- Nombre sugerido: `019_productos_catalogos_limpieza.sql`
- Objetivo: asignar `nfamilia_id` faltantes y validar categorias.
- Tablas afectadas: `bot_productos`, `bot_familias_producto`, `bot_categorias_producto`.
- Riesgo: medio.
- Orden: despues de backup.
- Descripcion:
  - Detectar productos activos sin familia.
  - Crear familia `Sin clasificar` si el negocio lo acepta o exigir asignacion manual.
  - No borrar columnas legacy todavia.

### Migracion 020: composicion normalizada

- Nombre sugerido: `020_componentes_limpieza.sql`
- Objetivo: corregir componentes compuestos migrados desde `cgenerico`.
- Tablas afectadas: `bot_componentes_producto`, `bot_producto_componentes`.
- Riesgo: medio.
- Orden: despues de revision manual.
- Descripcion:
  - Reportar componentes con separadores `+`, `/`, `,`.
  - Reemplazar con componentes atomicos solo con aprobacion.

### Migracion 021: precios vendibles

- Nombre sugerido: `021_productos_precios_activos.sql`
- Objetivo: asegurar que producto activo tenga al menos un precio venta positivo.
- Tablas afectadas: `bot_productos`.
- Riesgo: medio/alto.
- Orden: despues de corregir productos con precio cero.
- SQL aproximado:
  - Check condicional: si `cestado = 'A'`, al menos uno de `npreventa`, `npreventa_2`, `npreventa_3` mayor a cero.
  - Mantener no negativos.

### Migracion 022: precio compra desde compras/lotes

- Nombre sugerido: `022_precio_compra_fuente_compras.sql`
- Objetivo: documentar/fortalecer que `nprecompra` es ultimo costo derivado.
- Tablas afectadas: `bot_productos`, `bot_compras_det`.
- Riesgo: medio.
- Orden: despues de tests.
- Descripcion:
  - No necesariamente SQL; puede ser trigger o politica de API.
  - Recomendada mas como test/backend que como constraint DB.

### Migracion 023: constraints de stock

- Nombre sugerido: `023_stock_constraints_indices.sql`
- Objetivo: fortalecer cantidades no negativas e indices.
- Tablas afectadas: `bot_productos`, `bot_lotes`, `bot_kardex`, `bot_movimientos_almacen`.
- Riesgo: medio.
- Orden: despues de reconciliar datos.
- SQL aproximado:
  - Verificar/crear checks `nstock >= 0`, `ncantidad >= 0`.
  - Indices por producto/almacen/estado/vencimiento.

### Migracion 024: caja-venta

- Nombre sugerido: `024_ventas_caja_fk.sql`
- Objetivo: enlazar ventas a caja real.
- Tablas afectadas: `bot_ventas`, `bot_caja`.
- Riesgo: alto.
- Orden: despues de definir flujo caja.
- Descripcion:
  - Agregar `ncaja_id`.
  - Migrar ventas antiguas si se puede.
  - Backend debe exigir caja abierta.

### Migracion 025: alinear columnas Drizzle/DB

- Nombre sugerido: `025_schema_alignment_documentation.sql`
- Objetivo: no necesariamente alterar DB; puede ser cambio de codigo.
- Tablas afectadas: lotes, kardex, movimientos, auditoria, detalles.
- Riesgo: alto si se renombra DB; bajo si se corrige Drizzle.
- Orden: antes de usar Drizzle en rutas criticas.
- Descripcion:
  - Preferir corregir `backend-fastify/src/db/schema.ts` para reflejar DB real.

## 20. Proxima tarea recomendada

# Proxima tarea recomendada

## Objetivo

Estabilizar arranque, login y verificacion de esquema para que el proyecto tenga una base segura antes de nuevas features.

## Alcance

- No tocar productos, ventas, compras, FEFO, caja ni inventario funcional.
- Revisar y corregir solo scripts/configuracion de arranque y schema check.
- Confirmar que Fastify arranca en puerto 3000.
- Confirmar que Vite proxy `/api/v1` apunta al puerto correcto.
- Confirmar login directo y desde frontend.

## Archivos probables

- `start.sh`
- `scripts/check-schema.js`
- `backend-fastify/check-schema.js`
- `backend-fastify/src/lib/schema-check.ts`
- `backend-fastify/src/server.ts`
- `frontend/vite.config.ts`
- `backend-fastify/.env.example`

## Criterios de aceptacion

- `./start.sh` deja Fastify operativo.
- `curl http://127.0.0.1:3000/health` responde OK.
- `POST /api/v1/auth/login` con DNI `00000000` y clave `12345678` responde correctamente.
- `scripts/check-schema.js` ejecuta el verificador real o deja de existir como wrapper roto.
- `backend-fastify/check-schema.js` no da falsos OK frente al schema real.
- El flujo de migraciones de DB nueva queda documentado o automatizado.
- Frontend deja de mostrar 502 por backend caido.

## Validacion

Ejecutar:

```bash
./start.sh
curl http://127.0.0.1:3000/health
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"dni":"00000000","clave":"12345678"}'
cd backend-fastify && npm run build && npm test
cd ../frontend && npm run build && npm test
```

Lint solo para reportar:

```bash
cd backend-fastify && npm run lint
cd ../frontend && npm run lint
```

## Prompt sugerido

```text
Necesito estabilizar el arranque y login del proyecto Botica El Pueblo sin implementar features nuevas.

Contexto:
- Frontend Vite usa proxy /api/v1 hacia http://127.0.0.1:3000.
- Backend Fastify debe arrancar en puerto 3000.
- Base local: PostgreSQL botica_db.
- Existe radiografia en RADIOGRAFIA_COMPLETA_BOTICA_EL_PUEBLO.md.

Objetivo:
Corregir lo minimo para que ./start.sh levante Fastify, /health responda y login con DNI 00000000 clave 12345678 funcione.

Revisar:
- /tmp/botica_fastify.log
- start.sh
- scripts/check-schema.js
- backend-fastify/check-schema.js
- backend-fastify/src/lib/schema-check.ts
- backend-fastify/src/server.ts
- backend-fastify/src/plugins/db.ts
- frontend/vite.config.ts
- backend-fastify/.env.example

Reglas:
- No tocar productos, ventas, compras, inventario, FEFO, lotes, kardex ni caja.
- No cambiar migraciones funcionales salvo que el arranque dependa de una correccion minima y segura.
- No limpiar legacy.
- No refactorizar.

Criterios:
- ./start.sh deja backend operativo.
- curl http://127.0.0.1:3000/health responde OK.
- Login directo responde OK.
- Frontend ya no muestra 502.
- Build y tests existentes pasan.
```
