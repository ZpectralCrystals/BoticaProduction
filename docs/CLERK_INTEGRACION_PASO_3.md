# Clerk Integración Paso 3 — Vinculación real con ERP

## Resumen

En esta fase se implementó la integración operativa mínima de Clerk con el ERP sin reemplazar el login local.

- Clerk ahora puede autenticarse contra backend (`/api/v1/auth/clerk-sync`)
- El backend valida JWT Clerk con firma real (JWKS)
- La autorización ERP sigue en `bot_usuarios` (roles/permisos)
- El login local JWT sigue intacto

---

## 1) Estrategia de vinculación elegida

### Estrategia: **vinculación manual controlada por `cclerk_user_id`**

Se eligió esta estrategia por seguridad y trazabilidad:

- No se auto-vincula por email (evita falsos positivos/mapeos ambiguos)
- Solo se permite acceso ERP vía Clerk si existe vínculo explícito en BD
- El vínculo es único (`UNIQUE` parcial) y nullable para migración progresiva

Regla operativa:

- Si `bot_usuarios.cclerk_user_id = <clerk_sub>` y `cestado='A'` -> acceso ERP permitido
- Si no existe vínculo -> `CLERK_NOT_LINKED` (sin acceso al panel)

---

## 2) Cambios en base de datos

Archivo creado:

- `ops/migrations/014_usuarios_clerk_link.sql`

Incluye:

1. `ALTER TABLE bot_usuarios ADD COLUMN IF NOT EXISTS cclerk_user_id VARCHAR(255)`
2. Normalización de vacíos a `NULL`
3. Índice único parcial:
   - `ux_bot_usuarios_cclerk_user_id`
   - aplica solo cuando `cclerk_user_id IS NOT NULL`
4. `COMMENT` de la columna

### Ejemplo de vinculación manual

```sql
UPDATE bot_usuarios
SET cclerk_user_id = 'user_2xY...'
WHERE nid = 15;
```

---

## 3) Endpoints nuevos / ajustados

### Backend

#### `POST /api/v1/auth/clerk-sync`

Propósito:
- recibir token Clerk (`Authorization: Bearer <token>`)
- validar identidad Clerk
- mapear a usuario ERP vinculado
- crear sesión ERP local compatible (cookie + token)

Respuestas:

- **200**:
  ```json
  {
    "linked": true,
    "authSource": "clerk",
    "user": { "id": 1, "nombre": "...", "permisos": ["ventas"] },
    "token": "..."
  }
  ```
- **401** `CLERK_TOKEN_INVALID`
- **403** `CLERK_NOT_LINKED`
- **400** `CLERK_TOKEN_REQUIRED`

No se eliminó ni alteró:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/session`
- `POST /api/v1/auth/logout`

---

## 4) Flujo backend

1. Extrae Bearer token Clerk
2. Verifica JWT RS256 con JWKS (`CLERK_JWKS_URL`) y validaciones de tiempo/issuer
3. Obtiene `sub` (Clerk user id)
4. Busca usuario activo en `bot_usuarios` por `cclerk_user_id`
5. Si existe vínculo:
   - `buildAuthUser(...)` para cargar roles/permisos desde ERP
   - genera JWT local Fastify
   - setea cookie `botica_token`
   - devuelve `user + token`
6. Si no existe vínculo:
   - `403 CLERK_NOT_LINKED`

Variables de entorno agregadas:

- `CLERK_JWKS_URL`
- `CLERK_JWT_ISSUER` (opcional recomendado)

Archivo actualizado:
- `backend-fastify/.env.example`

---

## 5) Flujo frontend

### Cambios principales

- `frontend/src/lib/api.ts`
  - `apiClerkSync(clerkToken)`
  - tipos `ClerkSyncSuccess` / `ClerkSyncNotLinked`

- `frontend/src/context/auth-context.tsx`
  - nuevo método `syncClerkSession(clerkToken)`
  - cuando sync es exitosa: hidrata `user` ERP real

- `frontend/src/pages/clerk-test-page.tsx`
  - nuevo bloque `ClerkErpSyncPanel`
  - si hay sesión Clerk y no ERP: botón **Sincronizar sesión ERP con Clerk**
  - si está vinculado: estado verde de sesión ERP activa

- `frontend/src/context/auth-bridge.tsx`
  - nuevos flags de estado:
    - `erpSessionActive`
    - `erpLinkedByClerk`

### Comportamiento UX

#### Caso A: Usuario Clerk vinculado
- Click en sincronizar
- backend responde 200
- frontend activa sesión ERP local
- usuario queda listo para panel con permisos de `bot_usuarios`

#### Caso B: Usuario Clerk no vinculado
- backend responde `CLERK_NOT_LINKED`
- frontend muestra mensaje claro
- no hay acceso ERP

---

## 6) Convivencia con login JWT local

Se mantiene coexistencia real:

- Login local (`DNI + clave`) sigue funcionando igual
- Login Clerk ahora puede activar sesión ERP **solo** si hay vínculo
- Ambos caminos convergen al mismo `AuthUser` construido desde `bot_usuarios`

Regla de acceso ERP (explícita):

- El ERP autoriza por **sesión local ERP válida** (cookie/JWT Fastify)
- Una sesión Clerk sola **no autoriza** acceso al ERP

---

## 7) Roles y permisos

No hubo cambios de fuente de verdad:

- Roles/permisos siguen en `bot_usuarios` + `bot_permisos`
- Clerk solo autentica identidad
- `buildAuthUser()` sigue siendo el punto único de construcción de contexto de autorización

---

## 8) Manejo de sesiones

| Estado | Resultado |
|---|---|
| Solo sesión local | Acceso ERP normal |
| Solo sesión Clerk | Sin acceso ERP hasta `clerk-sync` exitoso |
| Ambas sesiones | Acceso ERP por sesión local; Clerk queda como capa de identidad |
| Ninguna sesión | Sin acceso |

---

## 9) Qué falta para reemplazo total del login local

1. Flujo de onboarding/admin para vincular `cclerk_user_id` sin SQL manual
2. Middleware de autenticación híbrido global (aceptar JWT Clerk en más endpoints protegidos)
3. Política de precedencia de sesión multi-dispositivo
4. Endpoint de desvinculación segura Clerk↔ERP
5. Tests automáticos de `/auth/clerk-sync` (vinculado/no vinculado/token inválido)

---

## 10) Riesgos y cuidados

- Si `CLERK_JWKS_URL` está mal configurado, `clerk-sync` rechazará tokens (401)
- Sin vínculo en `cclerk_user_id`, el usuario Clerk no puede entrar (esperado)
- Evitar auto-link por email en esta fase reduce riesgo de escalamiento indebido
- Mantener actualizado `cestado='A'` para cuentas autorizadas

---

## 11) Archivos modificados

### Backend
- `backend-fastify/src/routes/auth.routes.ts`
- `backend-fastify/src/db/schema.ts`
- `backend-fastify/.env.example`
- `ops/migrations/014_usuarios_clerk_link.sql` (nuevo)

### Frontend
- `frontend/src/lib/api.ts`
- `frontend/src/context/auth-context.tsx`
- `frontend/src/context/auth-bridge.tsx`
- `frontend/src/pages/clerk-test-page.tsx`
- `frontend/tsconfig.app.json` (ajuste TS build)
- `frontend/src/pages/ajustes-page.tsx` (fix tipado para build)

---

## 12) Validaciones ejecutadas

### Backend
- `npx tsc --noEmit` ✅
- `npm run build` ✅
- `npm test` ✅ (73/73)

### Frontend
- `npx tsc --noEmit` ✅
- `npm run build` ✅

Observación:
- Vite reporta warning de chunk grande (>500kB), no bloqueante.
