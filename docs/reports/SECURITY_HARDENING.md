# SECURITY HARDENING — Botica El Pueblo Backend
**Fecha:** 11 Abril 2026 — 35/35 tests ✅  
**Scope:** Backend Fastify — endurecimiento previo a producción

---

## 1. Rate Limiting

### Paquete
`@fastify/rate-limit` v10.3.0 (compatible con Fastify 5)

### Global (safety net)

**`server.ts`** — límite global por IP como protección ante DoS básico:
```typescript
await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  skipOnError: true,
  errorResponseBuilder: (_request, context) => ({
    error: 'TOO_MANY_REQUESTS',
    message: `Demasiadas solicitudes. Intente de nuevo en ${context.after}.`,
  }),
})
```

### Login (específico)

**`auth.routes.ts`** — límite estricto en `POST /api/v1/auth/login`:
```typescript
fastify.post('/login', {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
      errorResponseBuilder: (_request, context) => ({
        error: 'TOO_MANY_REQUESTS',
        message: `Demasiados intentos. Intente de nuevo en ${context.after}.`,
      }),
    },
  },
}, ...)
```

### Comportamiento
- **Global:** 300 req/min/IP — protege todo el API ante bucles o DoS accidental
- **Login:** 10 intentos/15 min/IP — bloquea fuerza bruta sobre credenciales
- **Al superar:** HTTP 429 con `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- **Override:** la config específica de `/login` anula el global para esa ruta

### Justificación del límite de login
10 intentos / 15 min = 1 intento cada 90 segundos. Suficiente para un cajero que olvidó su contraseña, pero impide ataques de fuerza bruta.

---

## 2. Headers de Seguridad

### Paquete
`@fastify/helmet` v13.0.2 (compatible con Fastify 5)

### Configuración

**`server.ts`**:
```typescript
await app.register(helmet, {
  contentSecurityPolicy: false,       // API JSON, no sirve HTML
  crossOriginResourcePolicy: false,   // Usado cross-origin desde el frontend React
  crossOriginEmbedderPolicy: false,   // Idem
})
```

### Headers activados por defecto

| Header | Valor | Propósito |
|---|---|---|
| `X-Frame-Options` | `SAMEORIGIN` | Previene clickjacking |
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-XSS-Protection` | `0` | Desactiva filtro XSS antiguo (correcto en 2024+) |
| `Referrer-Policy` | `no-referrer` | No filtra info de referrer |
| `X-DNS-Prefetch-Control` | `off` | Evita prefetch de DNS |
| `X-Download-Options` | `noopen` | Previene apertura directa en IE |
| `X-Permitted-Cross-Domain-Policies` | `none` | Bloquea Flash/PDF cross-domain |
| `Strict-Transport-Security` | `max-age=15552000` | HSTS en producción HTTPS |
| `Origin-Agent-Cluster` | `?1` | Aislamiento de proceso por origen |
| `Permissions-Policy` | (defaults) | Restringe features del navegador |

### Por qué se deshabilitaron 3 opciones

- **`contentSecurityPolicy: false`**: Este backend sirve solo JSON. La CSP se aplica a documentos HTML. No corresponde a una API REST. Si el backend sirviera HTML, se debería configurar cuidadosamente.
- **`crossOriginResourcePolicy: false`**: El frontend React (`localhost:5173` / dominio propio) consume esta API desde un origen diferente. Con `require-corp` activado, el navegador bloquearía las respuestas.
- **`crossOriginEmbedderPolicy: false`**: Idem anterior.

### Compatibilidad con Swagger UI
Swagger UI sirve en `/documentation`. Al no tener CSP activa, las interfaces JavaScript de Swagger funcionan sin restricciones. En producción, si Swagger se desactiva, se puede re-habilitar CSP para mayor seguridad.

---

## 3. User Enumeration Eliminado + Audit Log de Autenticación

### Problema

El endpoint `POST /login` exponía dos respuestas diferentes:
- `HTTP 404` para DNI no registrado  
- `HTTP 401` para contraseña incorrecta  

Esto permitía a cualquier atacante descubrir qué DNIs tienen cuenta en el sistema probando el endpoint.

### Fix: respuesta genérica unificada

```typescript
// Antes (vulnerable):
if (!row) return reply.code(404).send({ error: 'USUARIO NO ENCONTRADO' })
if (!isValid) return reply.code(401).send({ error: 'CONTRASEÑA INCORRECTA' })

// Después (seguro):
if (!row) return reply.code(401).send({ error: 'CREDENCIALES INVALIDAS' })
if (!isValid) return reply.code(401).send({ error: 'CREDENCIALES INVALIDAS' })
```

Ahora ambos casos devuelven HTTP 401 con el mismo mensaje. El atacante no puede distinguir entre "DNI inexistente" y "contraseña incorrecta".

### Audit Log de autenticación

Login fallido (contraseña incorrecta — solo cuando el usuario existe) y login exitoso ahora generan registros en `bot_auditoria`.

Fire-and-forget con `.catch(() => {})` — un fallo en el log nunca bloquea el login.

```typescript
// Login exitoso
fastify.db.query(
  `INSERT INTO bot_auditoria (..., caccion, cdetalle) VALUES (..., 'LOGIN', $3)`,
  [user.id, user.nombre, `Login exitoso desde ${request.ip}`]
).catch(() => {})

// Login fallido (contraseña incorrecta)
fastify.db.query(
  `INSERT INTO bot_auditoria (..., caccion, cdetalle) VALUES (..., 'LOGIN_FALLIDO', $3)`,
  [row.nid, row.cnombre, `Contraseña incorrecta desde ${request.ip}`]
).catch(() => {})
```

> **Por qué no se loguea el caso "DNI inexistente":** no tenemos un `nusuario_id` válido. Registrar el DNI intentado podría ser un vector de enumeración inversa vía la tabla de auditoría.

---

## 4. Swagger UI deshabilitado en producción

**`server.ts`** — registro condicional:
```typescript
if (process.env.NODE_ENV !== 'production') {
  await app.register(swagger, { ... })
  await app.register(swaggerUi, { routePrefix: '/documentation' })
}
```

- En desarrollo: `GET /documentation` accesible normalmente
- En producción: el endpoint no existe → `404 Not Found`
- No hay riesgo de exponer la estructura completa del API a atacantes

---

## 5. Endpoint Sensible Eliminado: `/internal/auth/verify-password`

### Descripción del riesgo (CRÍTICO)

El plugin `plugins/auth.ts` exponía:

```
POST /internal/auth/verify-password
Body: { hash: string, password: string }
Response: { ok: boolean }
```

**Sin autenticación. Sin rate limiting. Sin logging.**

### Por qué era un riesgo crítico

Este endpoint era un **oráculo de contraseñas offline-to-online**:

1. El atacante obtiene el hash de un usuario (ej: por SQL injection, backup expuesto, acceso a DB)
2. Llama este endpoint repetidamente con distintos passwords candidatos
3. El servidor hace el `bcrypt.compare()` y devuelve `{ ok: true/false }`
4. El atacante fuerza la contraseña a través del servidor, sin tocar la DB directamente
5. bcrypt con cost 10 ya es lento, pero el servidor absorbía el cómputo de todas formas

### Acción tomada

**Eliminado completamente** de `plugins/auth.ts`. No existe ningún uso legítimo en producción. La comparación de contraseñas se hace únicamente en `POST /api/v1/auth/login` donde:
- Está bajo rate limiting (10/15min)
- Está bajo autenticación de credentials
- Genera logging

### Verificación
```bash
# Debe retornar 404 después del hardening
curl -X POST http://localhost:3000/internal/auth/verify-password \
  -H "Content-Type: application/json" \
  -d '{"hash":"$2a$10$xxx","password":"test"}'
# → 404 Not Found
```

---

## 6. Vulnerabilidades en `fast-jwt` (pre-existentes)

`npm audit` reporta vulnerabilidades en la cadena `@fastify/jwt` → `fast-jwt`:

| Severidad | Paquete | Problema |
|---|---|---|
| `critical` | `fast-jwt` | Acepta extensiones de header `crit` desconocidas (RFC 7515) |
| `high` | `fast-jwt` | Riesgo relacionado con verificación JWT |

### Estado
Estas vulnerabilidades son **pre-existentes** (no introducidas por este hardening) y afectan al paquete upstream `fast-jwt` que usa `@fastify/jwt`.

### Mitigación temporal

Mientras no hay fix upstream estable:
1. Los JWTs se generan y verifican internamente — no se acepta JWTs externos de terceros
2. El `JWT_SECRET` es largo y aleatorio en producción (ya validado en `server.ts`)
3. Los tokens tienen expiración de 8 horas (`maxAge: 60 * 60 * 8`)
4. La cookie es `httpOnly` + `sameSite: lax` + `secure: true` en producción

### Acción recomendada
Monitorear `@fastify/jwt` para releases que actualicen `fast-jwt`. Ejecutar:
```bash
npm audit
npm update @fastify/jwt
```

---

## 7. Riesgos Restantes

| Riesgo | Severidad | Estado | Acción Recomendada |
|---|---|---|---|
| `fast-jwt` vulnerabilities | Critical/High | ⚠️ Pendiente | Actualizar cuando haya fix upstream |
| Sin HTTPS en dev | Alto | 🔵 Por diseño | Usar proxy HTTPS en producción (nginx/caddy) |
| Límite global de rate | Medio | ✅ Cerrado | 300 req/min/IP en producción |
| Swagger UI público en prod | Medio | ✅ Cerrado | Deshabilitado con `NODE_ENV=production` |
| User enumeration en login | Medio | ✅ Cerrado | Respuesta genérica 401 para ambos casos |
| Auditía de logins | Bajo | ✅ Cerrado | LOGIN y LOGIN_FALLIDO en `bot_auditoria` |
| Sin rotación de JWT | Bajo | 🔵 Aceptado | Stateless por diseño; logout borra cookie |
| Sin CAPTCHA en login | Bajo | 🔵 Aceptado | Rate limit (10/15min) es suficiente para uso local |
| DNI inexistente sin log de audit | Bajo | 🔵 Aceptado | No se loguea para evitar oracle inverso (ver §3) |

---

## 8. Archivos Modificados

| Archivo | Cambio |
|---|---|
| `src/server.ts` | `+import helmet, rateLimit` · `+register(helmet)` · `register(rateLimit, {global:true, max:300})` · swagger condicional |
| `src/routes/auth.routes.ts` | Rate limit 10/15min · **Fix user enum** (404→401 genérico) · audit LOGIN/LOGIN_FALLIDO |
| `src/plugins/auth.ts` | **Eliminado** `POST /internal/auth/verify-password` · **Eliminado** `import bcrypt` |
| `package.json` | `+@fastify/helmet ^13.0.2` · `+@fastify/rate-limit ^10.3.0` |

---

## Verificación rápida post-deploy

```bash
# 1. Headers de seguridad presentes
curl -I http://localhost:3000/api/v1/auth/session
# → X-Frame-Options: SAMEORIGIN
# → X-Content-Type-Options: nosniff
# → X-XSS-Protection: 0

# 2. Rate limit activo en login (11 intentos rápidos)
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"dni":"00000000","clave":"wrong"}'
done
# → 10x 401 (CREDENCIALES INVALIDAS), luego 1x 429

# 4. User enumeration cerrado
# DNI inexistente y contraseña incorrecta dan la misma respuesta:
curl -s -X POST .../auth/login -d '{"dni":"99999999","clave":"x"}'
# → 401 {"error":"CREDENCIALES INVALIDAS"}
curl -s -X POST .../auth/login -d '{"dni":"<dni_real>","clave":"x"}'
# → 401 {"error":"CREDENCIALES INVALIDAS"}

# 5. Swagger deshabilitado en produccion
curl http://localhost:3000/documentation  # en NODE_ENV=production
# → 404

# 3. Endpoint eliminado
curl -X POST http://localhost:3000/internal/auth/verify-password \
  -H "Content-Type: application/json" -d '{}'
# → 404
```
