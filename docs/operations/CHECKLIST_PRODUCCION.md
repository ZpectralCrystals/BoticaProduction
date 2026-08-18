# CHECKLIST DE PRODUCCIÓN — Botica El Pueblo ERP
**Fecha de auditoría:** Abril 2026  
**Auditor:** Principal Software Engineer — Revisión técnica completa

---

## 🔴 LEYENDA
- ✅ Listo
- ⚠️ Parcial / Requiere acción antes de producción
- ❌ No implementado / Bloqueante

---

## BACKEND

### Estructura y configuración

- [x] ✅ Fastify como servidor HTTP principal
- [x] ✅ Pool de conexiones PostgreSQL (`pg.Pool`) con health-check al arrancar
- [x] ✅ Plugin JWT (`@fastify/jwt`) para autenticación stateless
- [x] ✅ Cookie httpOnly para token (8h TTL)
- [x] ✅ Cookie `secure` condicional según `NODE_ENV=production` ← **CORREGIDO esta sesión**
- [x] ✅ CORS configurado con lista de orígenes permitidos via env
- [x] ✅ Swagger/OpenAPI en `/documentation`
- [x] ✅ Shutdown graceful con `close-with-grace`
- [ ] ⚠️ **JWT_SECRET**: usa fallback `'botica-fastify-local-secret'` si no hay env var. **Obligatorio setear `JWT_SECRET` en producción con valor fuerte (≥32 chars).**
- [ ] ⚠️ Pool sin tamaño máximo explícito definido (usa default pg = 10). Revisar bajo carga.
- [ ] ❌ Sin rate limiting en rutas de login (riesgo brute force)
- [ ] ❌ Sin helmet / headers de seguridad HTTP

### Autenticación

- [x] ✅ Login por DNI + contraseña (bcrypt)
- [x] ✅ JWT firmado y retornado como cookie httpOnly + en body
- [x] ✅ `requireAuth` preHandler en todas las rutas protegidas
- [x] ✅ Logout limpia cookie
- [x] ✅ Endpoint `/auth/session` para restaurar sesión al refrescar página
- [x] ✅ Permisos granulares cargados desde `bot_permisos`
- [ ] ⚠️ Endpoint interno `/internal/auth/verify-password` sin autenticación (solo para uso interno — no exponer en producción sin firewall)

### Rutas registradas bajo `/api/v1`

| Prefijo | Estado |
|---|---|
| `/auth` | ✅ login / logout / session |
| `/inventario` | ✅ GET lista, GET search, POST create/update/restock |
| `/ventas` | ✅ GET lista, POST crear, GET /:id |
| `/compras` | ✅ GET, POST (con restock de stock) |
| `/pacientes` | ✅ CRUD |
| `/dashboard` | ✅ métricas del día |
| `/usuarios` | ✅ CRUD |
| `/perfil` | ✅ |
| `/reportes` | ✅ |
| `/caja` | ✅ |
| `/transferencias` | ✅ con SELECT FOR UPDATE |
| `/citas` | ✅ |
| `/historial` | ✅ |
| `/recetas` | ✅ |
| `/medicos` | ✅ |
| `/deudores` | ✅ |
| `/alquileres` | ✅ |
| `/servicios` | ✅ |
| `/proveedores` | ✅ |
| `/auditoria` | ✅ |
| `/inventario-var` | ✅ |
| `/health` | ✅ sin auth |

### Lógica de ventas (`POST /api/v1/ventas`)

- [x] ✅ Transacción BEGIN/COMMIT/ROLLBACK explícita con `client.connect()`
- [x] ✅ Validación: total > 0
- [x] ✅ Validación: usuario autenticado
- [x] ✅ Código de venta único (`VTA-YYYYMMDD-XXXX`)
- [x] ✅ IGV calculado server-side (total / 1.18)
- [x] ✅ INSERT en `bot_ventas` con subtotal, igv, total
- [x] ✅ INSERT en `bot_ventas_det` por cada item
- [x] ✅ `SELECT FOR UPDATE` por producto antes de descontar ← **AÑADIDO esta sesión**
- [x] ✅ Validación stock suficiente por item ← **AÑADIDO esta sesión**
- [x] ✅ Rechazo de producto vencido ← **AÑADIDO esta sesión**
- [x] ✅ ROLLBACK completo si algún item falla ← **AÑADIDO esta sesión**
- [x] ✅ Deducción de `nstock` tras venta ← **AÑADIDO esta sesión**
- [x] ✅ Registro en `bot_auditoria` dentro de la transacción
- [ ] ❌ Sin Kardex (no existe tabla `bot_kardex` activa) — movimientos no trazables
- [ ] ❌ Sin FEFO por lote (no existe tabla `bot_lotes` activa)
- [ ] ❌ Sin fraccionamiento
- [ ] ⚠️ Normalización de método de pago solo en GET, en POST confía en el valor enviado por el frontend

### Concurrencia

- [x] ✅ `SELECT FOR UPDATE` en ventas (esta sesión) — bloqueo pesimista por fila
- [x] ✅ `SELECT FOR UPDATE` en transferencias (ya existía)
- [x] ✅ `nstock` nunca puede ir negativo si todos los ítems pasan por el SELECT FOR UPDATE
- [ ] ⚠️ Sin test de carga para validar bajo concurrencia real

---

## FRONTEND

### POS (`SalesPOS`)

- [x] ✅ `SalesPOS` como único componente POS activo
- [x] ✅ `sales-page.tsx` delega completamente a `<SalesPOS />`
- [x] ✅ Toda llamada API usa `lib/api.ts` exclusivamente
- [x] ✅ `ProductSearch` con búsqueda en tiempo real (debounce 300ms)
- [x] ✅ `usePOS` hook gestiona estado: carrito, cliente, pago, totales
- [x] ✅ Cart con botones +/- y eliminar item
- [x] ✅ Limpiar carrito completo
- [x] ✅ `PaymentPanel` con Efectivo / Yape / Mixto + calculadora de vuelto
- [x] ✅ `CheckoutModal` con resumen tributario (subtotal + IGV + total)
- [x] ✅ Alerta visual de stock bajo (≤5 unidades)
- [x] ✅ Alerta visual de producto próximo a vencer (≤30 días)
- [x] ✅ Badge de receta médica
- [x] ✅ Deshabilita productos sin stock en buscador
- [x] ✅ Atajos de teclado: F2 (buscar), F4 (finalizar), Esc (cerrar modal)
- [x] ✅ Toast de éxito con código de venta
- [ ] ⚠️ `cashier` hardcodeado como `'Caja principal'` — debería venir del contexto de auth
- [ ] ⚠️ Sin feedback visual cuando el backend rechaza por stock insuficiente (se muestra el error pero sin resaltar el item)
- [ ] ⚠️ `eval` en calculadora de `PaymentPanel.tsx` (riesgo menor, warning de build)
- [ ] ❌ Sin bloqueo de checkout si hay productos con `receta='S'` sin receta capturada
- [ ] ❌ Sin FEFO por lote (depende del backend)
- [ ] ❌ Sin fraccionamiento (vende siempre unidades completas)

### Construcción y calidad

- [x] ✅ `tsc -b` sin errores
- [x] ✅ `vite build` exitoso (1780 módulos, 555 kB / 146 kB gzip)
- [x] ✅ Sin `services/api.ts` ni código Supabase
- [ ] ⚠️ Bundle monolítico > 500 kB — considerar code-splitting en próxima iteración
- [ ] ❌ Sin tests automatizados (Vitest/Playwright)

---

## BASE DE DATOS

### Tablas activas (prefijo `bot_`)

| Tabla | Estado | Notas |
|---|---|---|
| `bot_productos` | ✅ | stock en columna `nstock` |
| `bot_ventas` | ✅ | cabecera de venta |
| `bot_ventas_det` | ✅ | detalle por producto |
| `bot_compras` | ✅ | cabecera compra |
| `bot_compras_det` | ✅ | detalle compra |
| `bot_usuarios` | ✅ | auth + roles |
| `bot_permisos` | ✅ | permisos por sección |
| `bot_auditoria` | ✅ | log de acciones |
| `bot_pacientes` | ✅ | |
| `bot_citas` | ✅ | |
| `bot_proveedores` | ✅ | |
| `bot_transferencias` | ✅ | con detalle |
| `bot_transferencias_det` | ✅ | |
| `bot_lotes` | ❌ | **No existe** — FEFO no disponible |
| `bot_kardex` | ❌ | **No existe** — trazabilidad no disponible |

### Integridad

- [x] ✅ `nstock >= 0` garantizado por `SELECT FOR UPDATE` + validación antes de descontar
- [x] ✅ Stock sube en compras (dentro de transacción)
- [x] ✅ Stock baja en ventas (esta sesión) — dentro de la misma transacción
- [x] ✅ Stock baja en transferencias/merma (ya existía)
- [ ] ⚠️ No hay `CHECK CONSTRAINT` en BD que impida `nstock < 0` — la garantía es solo a nivel aplicación
- [ ] ❌ Sin trigger de Kardex — movimientos de stock no son trazables en BD
- [ ] ❌ Sin tabla de lotes — precio de costo real por lote no disponible

### Schema canónico

- [x] ✅ El baseline activo es `ops/baseline/schema_botica_actual.sql`; no se usa schema legacy/Supabase.

---

## SEGURIDAD

- [x] ✅ Contraseñas en bcrypt
- [x] ✅ JWT firmado, no en localStorage
- [x] ✅ Cookie httpOnly (no accesible desde JS)
- [x] ✅ Cookie `secure` en producción (esta sesión)
- [x] ✅ Parámetros SQL parametrizados (sin SQL injection)
- [x] ✅ CORS configurado por env var
- [ ] ❌ `JWT_SECRET` no forzado como requerido — arranca con fallback inseguro
- [ ] ❌ Sin rate limiting en `/auth/login`
- [ ] ❌ Sin headers `Strict-Transport-Security`, `X-Frame-Options`, `CSP`
- [ ] ⚠️ Endpoint `/internal/auth/verify-password` sin autenticación

---

## OPERACIÓN

- [ ] ⚠️ No hay `.env.example` documentado
- [ ] ⚠️ No hay script de backup de BD
- [ ] ⚠️ No hay proceso de rotación de JWT_SECRET
- [ ] ❌ Sin migraciones versionadas (Flyway/Liquibase/custom)
- [ ] ❌ Sin monitoreo/alertas (Prometheus, Sentry, etc.)
- [ ] ❌ Sin proceso de anulación de ventas (solo `cestado` en BD pero sin ruta)
