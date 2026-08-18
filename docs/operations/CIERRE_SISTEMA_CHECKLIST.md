# CIERRE SISTEMA — CHECKLIST DE DESPLIEGUE
**Botica El Pueblo ERP**  
**Fecha:** 11 Abril 2026  
**Estado:** ✅ 82/82 tests · ✅ TS sin errores · ✅ Build limpio

---

## LEYENDA
- ✅ Listo — no requiere acción
- ⚙️ Requiere acción antes de arrancar en producción
- ⚠️ Recomendado — no es bloqueante para piloto
- ❌ Pendiente — planificado para siguiente fase

---

## 1. MIGRACIONES DE BASE DE DATOS

Ejecutar en orden en la BD de producción:

```bash
psql -U postgres -d botica_db -f ops/migrations/002_nstock_constraint.sql
psql -U postgres -d botica_db -f ops/migrations/003_bot_kardex.sql
psql -U postgres -d botica_db -f ops/migrations/004_bot_lotes.sql
psql -U postgres -d botica_db -f ops/migrations/005_fefo.sql
```

Todas las migraciones son **idempotentes** — seguras de ejecutar más de una vez.

| Migración | Agrega | Estado |
|---|---|---|
| `002_nstock_constraint.sql` | CHECK `nstock >= 0` | ⚙️ Aplicar |
| `003_bot_kardex.sql` | Tabla `bot_kardex` + índices | ⚙️ Aplicar |
| `004_bot_lotes.sql` | Tabla `bot_lotes` + FEFO index + vista | ⚙️ Aplicar |
| `005_fefo.sql` | Columnas `nlote_id`/`ccodigo_lote` en kardex y ventas_det | ⚙️ Aplicar |

---

## 2. VARIABLES DE ENTORNO (BACKEND)

Copiar `.env.example` → `.env` y completar:

```bash
cp backend-fastify/.env.example backend-fastify/.env
```

| Variable | Requerida | Descripción |
|---|---|---|
| `NODE_ENV` | ✅ | `production` |
| `JWT_SECRET` | **⚙️ CRÍTICA** | Mínimo 32 chars aleatorios. El server NO arranca sin esto en producción. Generar: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `BOTICA_DB_HOST` | ⚙️ | Host PostgreSQL |
| `BOTICA_DB_PORT` | ⚙️ | Puerto (default 5432) |
| `BOTICA_DB_NAME` | ⚙️ | Nombre de BD |
| `BOTICA_DB_USER` | ⚙️ | Usuario PostgreSQL |
| `BOTICA_DB_PASS` | ⚙️ | Contraseña PostgreSQL |
| `CORS_ORIGIN` | ⚙️ | URL pública del frontend (ej: `https://botica.midominio.com`) |
| `PORT` | ⚠️ | Default 3000 |
| `HOST` | ⚠️ | `0.0.0.0` detrás de proxy, `127.0.0.1` directo |
| `LOG_LEVEL` | ⚠️ | `info` en producción |

---

## 3. BACKUP PREVIO AL DESPLIEGUE

```bash
# Backup completo antes de cualquier migración
pg_dump -U postgres botica_db > backup_predespliegue_$(date +%Y%m%d_%H%M).sql

# Verificar que el backup es legible
psql -U postgres -d postgres -c "SELECT COUNT(*) FROM pg_database WHERE datname='botica_db'"
```

⚙️ **Obligatorio** — hacer backup antes de ejecutar migraciones.

---

## 4. HTTPS / PROXY INVERSO

El backend corre en HTTP. En producción debe quedar detrás de un proxy HTTPS.

**Opción recomendada (Nginx):**

```nginx
server {
    listen 443 ssl;
    server_name botica.midominio.com;

    ssl_certificate     /etc/letsencrypt/live/botica.midominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/botica.midominio.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        root /var/www/botica/dist;
        try_files $uri /index.html;
    }
}
```

| Check | Estado |
|---|---|
| Certificado SSL válido (Let's Encrypt o equivalente) | ⚙️ Configurar |
| Proxy inverso configurado | ⚙️ Configurar |
| Cookie `secure: true` automático cuando `NODE_ENV=production` | ✅ Ya configurado |
| HSTS activo vía `@fastify/helmet` | ✅ Ya configurado |

---

## 5. BUILD BACKEND

```bash
cd backend-fastify
npm install --production=false   # incluye devDeps para build
npm run build                    # tsc → dist/
npm test                         # 35 tests deben pasar
```

| Check | Estado |
|---|---|
| `tsc` sin errores | ✅ |
| 35/35 tests verdes | ✅ |
| `dist/` generado | ⚙️ Verificar en servidor |

**Arrancar en producción:**
```bash
NODE_ENV=production node dist/server.js
```

---

## 6. BUILD FRONTEND

```bash
cd frontend
npm install
npm run build    # Vite → dist/ (555 kB / 146 kB gzip)
npm test         # 47 tests deben pasar
```

| Check | Estado |
|---|---|
| `tsc --noEmit` sin errores | ✅ |
| 47/47 tests verdes | ✅ |
| `dist/` generado | ⚙️ Copiar al servidor / CDN |
| Sin `eval()` en código | ✅ Corregido (PaymentPanel) |

---

## 7. SEGURIDAD — VERIFICACIÓN POST-DEPLOY

```bash
# 1. Headers de seguridad
curl -I https://botica.midominio.com/api/v1/auth/session
# → X-Frame-Options: SAMEORIGIN
# → X-Content-Type-Options: nosniff
# → Strict-Transport-Security: max-age=15552000

# 2. Rate limit en login activo (11 intentos rápidos → 429)
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://botica.midominio.com/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"dni":"00000000","clave":"wrong"}'
done
# → 10x 401, luego 429

# 3. Swagger deshabilitado en producción
curl https://botica.midominio.com/documentation
# → 404

# 4. Endpoint interno eliminado
curl -X POST https://botica.midominio.com/internal/auth/verify-password -d '{}'
# → 404

# 5. Health check
curl https://botica.midominio.com/health
# → {"status":"ok","runtime":"fastify"}
```

---

## 8. SMOKE TESTS MANUALES (QA OPERATIVO)

Ejecutar en orden con usuario de prueba antes de autorizar operación:

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Login con credenciales válidas | Redirige al dashboard, cookie seteada |
| 2 | Login con DNI inexistente | `401 CREDENCIALES INVALIDAS` |
| 3 | Login con contraseña incorrecta | `401 CREDENCIALES INVALIDAS` |
| 4 | Buscar producto en POS | Aparece con stock y precio |
| 5 | Agregar al carrito | Aparece badge de lote si tiene lotes |
| 6 | Completar venta efectivo | Toast con código VTA-YYYYMMDD-XXXX |
| 7 | Verificar kardex | `GET /api/v1/kardex?producto_id=X` retorna movimiento |
| 8 | Verificar stock bajó | Inventario muestra -cantidad vendida |
| 9 | Anular venta (admin) | `PATCH /ventas/:id/anular` → estado `I`, stock restaurado |
| 10 | Registrar compra con lote | `POST /compras` con codigoLote + fechaVencimiento |
| 11 | Verificar lote creado | `GET /lotes?producto_id=X` muestra el lote |
| 12 | Verificar consistencia | `GET /lotes/consistencia` muestra diferencia = 0 |
| 13 | Logout | Cookie limpiada, redirige a login |

---

## 9. CHECKLIST FINAL PRE-AUTORIZACIÓN

```
[ ] Backup de BD realizado antes de migraciones
[ ] Migraciones 002–005 ejecutadas sin error
[ ] JWT_SECRET seteado con valor fuerte (≥32 chars)
[ ] NODE_ENV=production en el servidor
[ ] CORS_ORIGIN apunta al dominio correcto del frontend
[ ] HTTPS activo con certificado válido
[ ] npm test en backend → 35/35 ✅
[ ] npm test en frontend → 47/47 ✅
[ ] npm run build backend → sin errores ✅
[ ] npm run build frontend → sin errores ✅
[ ] Smoke tests 1–13 completados ✅
[ ] Backup post-deploy tomado ✅
```

---

## 10. PENDIENTES NO BLOQUEANTES (SIGUIENTE SPRINT)

| Ítem | Impacto | Complejidad |
|---|---|---|
| Actualizar `fast-jwt` cuando haya fix upstream | Seguridad JWT | Media |
| Tests de `auth.routes.ts` (login/logout/user enum) | Cobertura | Baja |
| Tests de `CheckoutModal`, `ProductSearch`, `PaymentPanel` | Cobertura | Baja |
| FEFO multi-lote test (3+ lotes) | Cobertura | Media |
| Monitoreo (Sentry / logs centralizados) | Observabilidad | Alta |
| Backup automático diario (cron + pg_dump) | Operación | Baja |
| Code-splitting frontend (bundle >500 kB) | Performance | Media |
