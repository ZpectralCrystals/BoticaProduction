# Clerk — Integración Progresiva: Paso 2

**Fecha:** Abril 2026  
**Principio rector:** _Clerk visible, usable y verificable. Sin romper el login actual. Sin migración total todavía._

---

## 1. Estado anterior (Paso 1)

Lo que existía antes de esta fase:

| Elemento                    | Estado                                      |
|-----------------------------|---------------------------------------------|
| `ClerkProviderWrapper`      | Creado, condicional según `VITE_CLERK_PUBLISHABLE_KEY` |
| `auth-bridge.tsx`           | Creado, datos básicos: `clerkSignedIn`, `clerkEmail`, `clerkUserId` |
| `clerk-test-page.tsx`       | Página de prueba básica en `/auth/clerk`    |
| Ruta `/auth/clerk`          | Pública, accesible                          |
| JWT local ERP               | Auth oficial, sin cambios                   |
| `bot_usuarios`              | Fuente de roles y permisos, sin cambios     |
| Clerk en uso real           | No — era solo infraestructura instalada     |

---

## 2. Qué se mejoró en esta fase

### `auth-bridge.tsx` — Bridge enriquecido

**Nuevos campos en `ClerkBridgeData`:**
- `clerkDisplayName: string | null` — nombre completo o primer nombre del usuario Clerk
- `clerkAvatarUrl: string | null` — URL del avatar de Clerk (`user.imageUrl`)

**Nuevo tipo:**
```typescript
export type ActiveSession = 'local' | 'clerk' | 'both' | 'none'
```

**Nuevos campos en `useAuthBridge()`:**

| Campo                  | Tipo             | Descripción                                      |
|------------------------|------------------|--------------------------------------------------|
| `activeSession`        | `ActiveSession`  | Qué sesiones están activas simultáneamente       |
| `isLocalAuthenticated` | `boolean`        | Si hay sesión ERP local activa                   |
| `isClerkAuthenticated` | `boolean`        | Si hay sesión Clerk activa                       |
| `localUser`            | `AuthUser | null`| Objeto completo del usuario ERP                  |
| `localPermisos`        | `string[]`       | Permisos del usuario ERP                         |
| `clerkDisplayName`     | `string | null`  | Nombre del usuario en Clerk                      |
| `clerkAvatarUrl`       | `string | null`  | Avatar URL del usuario en Clerk                  |

**`activeSession` logic:**
```typescript
const activeSession =
  hasLocal && hasClerk ? 'both'
  : hasLocal ? 'local'
  : hasClerk ? 'clerk'
  : 'none'
```

---

## 3. Rutas creadas o ajustadas

| Ruta           | Estado     | Tipo    | Descripción                                               |
|----------------|------------|---------|-----------------------------------------------------------|
| `/auth/clerk`  | Mejorada   | Pública | Diagnóstico completo: key, sesiones, componentes Clerk    |
| `/login/clerk` | **Nueva**  | Pública | Login real con Clerk usando `<SignIn>` embebido de Clerk  |

### `/auth/clerk` — Diagnóstico (mejorado)
Muestra:
- `VITE_CLERK_PUBLISHABLE_KEY` enmascarada (`pk_test_xxxx…yyyy`)
- Si Clerk está habilitado
- Modo auth oficial del ERP
- Sesión ERP local (nombre + rol)
- Sesión Clerk (displayName, email)
- Estado combinado (`local` / `clerk` / `both` / `none`)
- Advertencia si ambas sesiones están activas simultáneamente
- Botón de sign-in Clerk (modal) si key configurada
- Tarjeta de usuario Clerk con sign-out si hay sesión
- Links a `/login/clerk` y `/`

### `/login/clerk` — Login real (nueva)
- Si `CLERK_ENABLED`: renderiza `<SignIn>` de Clerk con estilos personalizados
- Si `!CLERK_ENABLED`: instrucciones de setup con pasos claros
- Tras autenticación, redirige a `/auth/clerk`
- Link de vuelta al ERP siempre visible
- No requiere ni modifica auth local

---

## 4. Componentes Clerk creados

Ubicación: `frontend/src/components/auth/clerk/`

### `ClerkStatusBadge`
Badge inline de estado. Seguro en cualquier parte del árbol (usa `useAuthBridge`, no hooks Clerk directos).

| Estado              | Color   | Texto                    |
|---------------------|---------|--------------------------|
| No configurado      | Gris    | "Clerk: no configurado"  |
| Configurado, activo | Verde   | "Clerk: activo"          |
| Configurado, inactivo | Ámbar | "Clerk: no autenticado"  |

```tsx
<ClerkStatusBadge />                    // con label
<ClerkStatusBadge showLabel={false} />  // solo dot
```

### `ClerkUserCard`
Tarjeta de usuario Clerk con avatar, nombre, email, ID y botón de sign-out.

```tsx
<ClerkUserCard />                  // completa con sign-out
<ClerkUserCard showSignOut={false} />  // solo info
<ClerkUserCard compact />          // versión compacta (nav)
```

### `ClerkSignInButton`
Botón de sign-in con Clerk. Renderiza `null` si Clerk no está configurado.

```tsx
<ClerkSignInButton />
<ClerkSignInButton mode="redirect" redirectUrl="/auth/clerk" />
<ClerkSignInButton variant="outline">Custom label</ClerkSignInButton>
```

---

## 5. Cómo convive con JWT local

```
┌─────────────────────────────────────────────────────────┐
│  ERP Botica El Pueblo — Auth Layers (Fase 2)            │
├─────────────────────────────────────────────────────────┤
│  Layer 1: ClerkProvider (main.tsx)                       │
│  └─ solo activo si VITE_CLERK_PUBLISHABLE_KEY existe     │
│                                                          │
│  Layer 2: ClerkBridgeProvider (providers.tsx)            │
│  └─ expone datos de Clerk sin romper árbol si no hay key │
│                                                          │
│  Layer 3: AuthProvider (providers.tsx)                   │
│  └─ JWT local, bot_usuarios, auth oficial del ERP        │
│                                                          │
│  Hook: useAuthBridge()                                   │
│  └─ unifica ambas capas → activeSession, etc.            │
└─────────────────────────────────────────────────────────┘
```

**Reglas de coexistencia:**
- Las dos sesiones son **completamente independientes** en esta fase
- El ERP usa exclusivamente la sesión local (JWT) para autorización
- Clerk solo gestiona identidad; no afecta rutas, permisos ni acceso al panel
- Tener sesión Clerk NO otorga acceso al ERP
- Tener sesión ERP NO crea sesión Clerk

**¿Qué pasa si ambas están activas?**
- `activeSession === 'both'`
- La UI lo detecta y muestra una advertencia informativa
- No hay conflicto funcional; son capas aisladas

---

## 6. Qué falta para migración total (Fase 3)

### Backend
1. **Agregar columna `clerk_user_id`** a `bot_usuarios`:
   ```sql
   ALTER TABLE bot_usuarios ADD COLUMN clerk_user_id VARCHAR(255) UNIQUE;
   ```

2. **Endpoint de sincronización** `POST /api/v1/auth/clerk-sync`:
   - Recibe JWT de Clerk (Bearer token)
   - Verifica con Clerk SDK (`clerkClient.verifyToken()`)
   - Busca en `bot_usuarios` por `clerk_user_id`
   - Si existe: retorna usuario con roles/permisos
   - Si no existe: error 403 (usuario no vinculado)

3. **Middleware de auth dual** en Fastify:
   - Detectar si el token es JWT local o JWT de Clerk
   - Para JWT de Clerk: verificar y mapear a `bot_usuarios`

### Frontend
4. **`AuthProvider` debe aceptar token de Clerk** como alternativa al login DNI/clave

5. **Flujo de vinculación**: si hay sesión Clerk pero sin usuario ERP vinculado, mostrar pantalla de vinculación (ingresar DNI para vincular cuentas)

6. **Cambiar `mode` en `useAuthBridge()`** de `'local'` a `'clerk'` cuando el backend soporte verificación de JWT Clerk

### Clerk Dashboard
7. Configurar dominios de producción en Clerk
8. Configurar OAuth providers (Google, etc.) si se necesita
9. Configurar `afterSignInUrl` y `afterSignUpUrl` en Clerk dashboard

---

## 7. Validaciones ejecutadas

| Validación                                    | Resultado |
|-----------------------------------------------|-----------|
| `npx tsc --noEmit` en frontend                | ✅ Sin errores |
| Ruta `/auth/clerk` compila y tipea correctamente | ✅       |
| Ruta `/login/clerk` compila y tipea correctamente | ✅      |
| `useAuthBridge()` tipado completo sin errores | ✅        |
| `ClerkBridgeData` con nuevos campos           | ✅        |
| `ClerkStatusBadge` seguro sin ClerkProvider   | ✅ (usa bridge) |
| `ClerkUserCard` seguro sin ClerkProvider      | ✅ (guarda con CLERK_ENABLED) |
| `ClerkSignInButton` retorna null sin key      | ✅        |
| Build sin romper login JWT local              | ✅        |
| `CLERK_ENABLED=false`: cero crashes, cero renders Clerk | ✅ |

---

## Estructura de archivos resultante

```
frontend/src/
├── components/
│   └── auth/
│       └── clerk/
│           ├── ClerkStatusBadge.tsx   ← NUEVO: badge inline de estado
│           ├── ClerkUserCard.tsx      ← NUEVO: tarjeta de usuario Clerk
│           ├── ClerkSignInButton.tsx  ← NUEVO: botón de sign-in seguro
│           └── index.ts               ← NUEVO: re-exports
├── context/
│   └── auth-bridge.tsx                ← MEJORADO: activeSession, displayName, avatarUrl, localUser, localPermisos
├── lib/
│   └── clerk-provider.tsx             ← Sin cambios
├── pages/
│   ├── clerk-test-page.tsx            ← MEJORADO: diagnóstico completo, usa nuevos componentes
│   └── clerk-login-page.tsx           ← NUEVO: /login/clerk con <SignIn> real
└── app/
    └── router.tsx                     ← ACTUALIZADO: ruta /login/clerk añadida
```
