# Clerk ↔ ERP operativo

## Objetivo

Cerrar la operación de Clerk para que la relación entre Clerk y `bot_usuarios.cclerk_user_id` ya no dependa de SQL manual.

## Qué quedó implementado

### Backend

Se agregaron endpoints administrativos en `backend-fastify/src/routes/users.routes.ts`:

- `GET /api/v1/usuarios/:id/clerk-link`
  - devuelve el estado actual del vínculo
- `POST /api/v1/usuarios/:id/clerk-link`
  - vincula o actualiza `cclerk_user_id`
  - body:

```json
{
  "clerkUserId": "user_2xY..."
}
```

- `DELETE /api/v1/usuarios/:id/clerk-link`
  - desvincula de forma segura

### Reglas aplicadas

- solo administradores ERP pueden gestionar vínculos Clerk
- el usuario ERP debe existir
- solo se permite vincular usuarios ERP activos
- `clerkUserId` es obligatorio
- `clerkUserId` debe iniciar con `user_`
- no se permite reutilizar el mismo `clerkUserId` en dos usuarios ERP
- cada vínculo y desvínculo queda auditado en `bot_auditoria`

### Compatibilidad

- no se rompe el login local JWT
- no se rompe `POST /api/v1/auth/clerk-sync`
- `bot_usuarios` sigue siendo la fuente de verdad para:
  - estado
  - rol
  - permisos

## Frontend

La pantalla `frontend/src/pages/usuarios-page.tsx` ahora:

- muestra si cada usuario tiene Clerk vinculado o no
- muestra el `clerkUserId` actual
- permite abrir un panel de vínculo Clerk por usuario
- permite:
  - vincular
  - actualizar vínculo
  - desvincular
- si el navegador ya tiene sesión Clerk activa, permite reutilizar ese `clerkUserId`

## Estado de lectura en listado

`GET /api/v1/usuarios` ahora devuelve también:

```json
{
  "clerkLinked": true,
  "clerkUserId": "user_2xY..."
}
```

## Flujo operativo recomendado

1. Crear o activar el usuario ERP en `/panel/usuarios`
2. Abrir la gestión Clerk del usuario
3. Pegar el `Clerk User ID` real desde Clerk
4. Guardar vínculo
5. El usuario inicia sesión con Clerk
6. El backend valida JWT Clerk y activa la sesión ERP mediante `/api/v1/auth/clerk-sync`

## Validación realizada

- tests backend: `backend-fastify/src/__tests__/users.test.ts`
- build backend OK
- build frontend OK

## Pendiente futuro

- validación contra Clerk Management API para autodescubrimiento de usuarios
- búsqueda de usuarios Clerk por email desde el panel ERP
- revocación explícita de sesiones ERP cuando un vínculo Clerk se remueve
