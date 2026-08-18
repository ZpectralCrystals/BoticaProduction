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

## Activación de producción

- Aplicación Clerk: `Botica El Pueblo`.
- Instancia de producción vinculada a `botica-production.vercel.app`.
- Variables Clerk cargadas como secretos en Vercel para Production y Preview.
- `CLERK_AUTHORIZED_PARTIES` restringido a `https://botica-production.vercel.app`.
- Frontend Clerk productivo conectado mediante proxy serverless seguro `/__clerk`.
- Despliegue productivo reconstruido después de cargar las variables.
- Autenticación principal conservada por DNI como contingencia operativa.

Google OAuth queda deshabilitado hasta disponer de credenciales OAuth propias de
producción. "Google" significa iniciar sesión con una cuenta Gmail mediante OAuth;
no crea otro usuario ERP ni reemplaza sus roles. El acceso Clerk habilitado para
esta fase es por correo y contraseña.

## Validación productiva

- `GET /__clerk/v1/environment`: `200`, proxy Clerk operativo.
- `POST /__clerk/v1/client/sign_ins`: proxy operativo; corregida compatibilidad
  Vercel para POST, cuerpo parseado, `ReadableStream` y parámetros de rewrite.
- `/login/clerk`: formulario de correo y contraseña renderizado.
- Credenciales aceptadas; Clerk solicita código por correo al tratarse del primer
  ingreso desde un dispositivo nuevo.
- Google no aparece como opción mientras no tenga credenciales productivas.
- Token Clerk inválido: `401 CLERK_TOKEN_INVALID`, sin degradar la API.
- `GET /api/health/ready`: `200`, Fastify y PostgreSQL conectados.
- Pruebas automatizadas: 150 backend y 58 frontend aprobadas.

## Primer usuario productivo

- Identidad Clerk creada para `gustavogaldelg@gmail.com`.
- Correo marcado como verificado por Clerk.
- Usuario vinculado al ERP `ADMINISTRADOR`, DNI `00000000`.
- Panel de usuarios confirma `1 vinculado(s)`.
- Primer ingreso llegó correctamente a verificación de nuevo dispositivo.

El código temporal debe ingresarlo el propietario desde el correo recibido. Esta
protección permanece activa; no se deshabilita para completar pruebas.

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
