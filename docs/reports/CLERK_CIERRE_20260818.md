# Cierre de integración Clerk

Fecha: 2026-08-18

## Objetivo

Usar Clerk como proveedor de identidad sin mover a Clerk la autorización del ERP.
`bot_usuarios` conserva estado, rol y permisos operativos.

## Flujo final

1. Usuario inicia sesión con Clerk mediante correo o proveedor habilitado.
2. Frontend obtiene token corto de sesión Clerk.
3. `POST /api/v1/auth/clerk-sync` valida token con SDK oficial `@clerk/backend`.
4. Backend busca `bot_usuarios.cclerk_user_id` activo.
5. Backend emite JWT ERP con `authSource=clerk` y permisos actuales de PostgreSQL.
6. Cada request protegido vuelve a comprobar usuario activo; para sesiones Clerk también comprueba vínculo vigente.

## Implementado

- Sincronización Clerk -> ERP automática, sin botón manual.
- Login alternativo por correo en pantalla principal.
- Logout coordinado de Clerk y ERP.
- Validación oficial de token con `authorizedParties`.
- Rate limit para sincronización.
- Revocación inmediata del JWT ERP al desvincular Clerk.
- Búsqueda de usuarios Clerk por nombre/correo desde Administración > Usuarios.
- Validación del usuario Clerk antes de vincular cuando existe `CLERK_SECRET_KEY`.
- Pruebas de token válido, inválido, sin vínculo y vínculo revocado.

## Variables requeridas

Frontend:

- `VITE_CLERK_PUBLISHABLE_KEY`

Backend:

- `CLERK_SECRET_KEY`
- `CLERK_AUTHORIZED_PARTIES`

Opcionales:

- `CLERK_JWT_KEY`
- `CLERK_JWT_ISSUER`

## Límite de responsabilidad

Clerk resuelve identidad, sesión, recuperación de acceso, MFA y proveedores sociales.
No decide quién vende, abre caja, modifica inventario o administra usuarios. Esas reglas siguen en Botica ERP y PostgreSQL.
