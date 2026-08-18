# Clerk integración paso 3 - cierre

Esta fase quedó cerrada el 2026-08-18.

## Resultado

- Vinculación explícita `Clerk user ID -> bot_usuarios`.
- Sincronización automática de sesión.
- SDK backend oficial para verificar tokens.
- Orígenes autorizados mediante `CLERK_AUTHORIZED_PARTIES`.
- Sesiones Clerk revocables al quitar vínculo o desactivar usuario ERP.
- Directorio Clerk consultable desde gestión de usuarios.
- Logout Clerk + ERP coordinado.
- Login local conservado como contingencia.

## Seguridad

Clerk autentica identidad. PostgreSQL autoriza operaciones ERP. Un usuario Clerk autenticado sin vínculo ERP activo recibe `403 CLERK_NOT_LINKED`.

El token ERP emitido desde Clerk incluye:

- `authSource=clerk`
- `clerkUserId`

Cada request protegido comprueba que el vínculo siga vigente.

## Configuración

Consulte `backend-fastify/.env.example`, `frontend/.env.example` y `docs/reports/CLERK_CIERRE_20260818.md`.
