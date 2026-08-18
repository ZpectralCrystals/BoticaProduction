# Cierre total de producción

Fecha: 2026-08-18

## Estado

Sistema funcional y desplegado en `https://botica-production.vercel.app`.
Programación, base de datos, respaldo y autenticación Clerk quedaron cerrados.

## Producción

- Vercel desplegado desde `main`.
- Despliegue automatico desde la rama `main`.
- `GET /api/health/ready`: HTTP 200.
- Fastify activo, PostgreSQL conectado y 64 productos activos.
- Supabase usa plan gratuito; SUNAT queda fuera de esta fase.

## Seguridad

- Contraseña expuesta de Supabase rotada.
- Contraseña anterior rechazada; contraseña nueva validada.
- Secreto actual guardado en Vercel y macOS Keychain, no en Git.
- Google OAuth deshabilitado hasta contar con Client ID y Client Secret propios.
- Registro publico por correo deshabilitado; altas y vinculos son administrativos.

## Clerk

- Identidad de producción creada para `gustavogaldelg@gmail.com`.
- Administrador ERP DNI `00000000` vinculado con Clerk.
- Proxy productivo GET/POST corregido para Vercel.
- Formulario localizado al espanol y presentado como "Ingreso con correo".
- Retorno `/auth/clerk` convertido en callback operativo sin diagnosticos publicos.
- Contraseña aceptada y flujo llegó a verificación de nuevo dispositivo.
- Queda únicamente ingresar el código temporal recibido por correo; es una medida
  de seguridad del propietario, no un pendiente de programación.

## Backups

- Backup previo a rotación:
  `backups/database/botica_20260818_091532.sql.gz`.
- SHA-256:
  `3835224b81b7454de411fdf649052101710d46def9e6b29a8adef3a4069db5bf`.
- Backup diario macOS: `~/BoticaBackups/`, todos los días a las 02:00.
- LaunchAgent: `com.boticaelpueblo.backup`.
- Última ejecución: código 0; gzip y checksum válidos.
- Retención: 30 días.

## Pruebas

- Backend: 150/150.
- Frontend: 61/61.
- TypeScript backend: limpio.
- Scripts de backup: sintaxis Bash válida.
- Salud productiva: HTTP 200.

## Acceso

1. Abrir `/login/clerk`.
2. Ingresar `gustavogaldelg@gmail.com` y contraseña personal.
3. En primer dispositivo, ingresar código enviado al correo.
4. Clerk valida identidad; ERP conserva rol, permisos y estado operativo.

No documentar contraseñas, códigos temporales ni secretos en archivos del proyecto.

## Alcance pospuesto

SUNAT queda para una fase independiente. El cierre actual conserva validaciones
locales de RUC/DNI y no depende de servicios tributarios externos.
