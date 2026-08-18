# Clerk y ERP operativo

Estado: implementación completa en código. Configuración externa documentada en `docs/reports/CLERK_CIERRE_20260818.md`.

## Responsabilidades

- Clerk: identidad, sesión, recuperación, MFA y proveedores de acceso.
- `bot_usuarios`: estado activo, DNI, rol y permisos del ERP.
- `bot_permisos`: módulos habilitados.

## Flujo

1. Usuario inicia sesión con Clerk.
2. Frontend sincroniza automáticamente el token con `/api/v1/auth/clerk-sync`.
3. Backend valida token mediante `@clerk/backend` y `authorizedParties`.
4. Backend exige vínculo único en `bot_usuarios.cclerk_user_id` y usuario activo.
5. Backend emite sesión ERP con permisos vigentes.
6. Desvincular Clerk invalida el JWT ERP originado por Clerk en el siguiente request.

## Administración

En `/panel/usuarios`, administrador puede:

- buscar usuarios Clerk por nombre o correo;
- vincular o actualizar vínculo;
- desvincular;
- usar manualmente un `user_...` como contingencia.

No existe auto-vínculo por correo. Selección y confirmación siempre son administrativas.

## Endpoints

- `POST /api/v1/auth/clerk-sync`
- `GET /api/v1/usuarios/clerk/search?q=...`
- `GET /api/v1/usuarios/:id/clerk-link`
- `POST /api/v1/usuarios/:id/clerk-link`
- `DELETE /api/v1/usuarios/:id/clerk-link`

Todos los cambios de vínculo quedan auditados en `bot_auditoria`.

## Compatibilidad

Login local DNI + clave permanece como acceso de contingencia. Ambos caminos terminan en el mismo contexto ERP y la misma política de permisos.
