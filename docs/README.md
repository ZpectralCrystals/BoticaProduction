# Botica El Pueblo

Proyecto independiente para la operacion de Botica El Pueblo. Nacio tomando como referencia la logica de MPERP, pero hoy corre con frontend React/Vite, backend principal en Fastify y persistencia PostgreSQL.

## Stack implementado

- React 19 + Vite 8
- Tailwind CSS 4
- Base de componentes estilo shadcn en `src/components/ui`
- React Router para navegacion
- Sonner para feedback rapido
- Backend Fastify + TypeScript
- Backend PHP legacy opcional para compatibilidad
- PostgreSQL 15
- Hash de contraseñas con bcrypt

## Alcance actual

El proyecto ya cuenta con frontend y backend para estos modulos:

- Acceso
- Dashboard
- Inventario
- Ventas
- Caja
- Compras
- Proveedores
- Pacientes
- Procedimientos
- Medicos
- Reportes
- Transferencias
- Alquileres
- Deudores
- Inventario variado
- Auditoria
- Usuarios
- Perfil

## Estructura

```text
frontend/                   App React/Vite
backend-fastify/            API principal en Fastify/TypeScript
_legacy_backend_php/        Backend PHP legacy de referencia
docs/                       Documentacion organizada por categoria
ops/                        Migraciones y scripts operativos
schema_farmacia_completo.sql Schema base para inicializar la BD
fix_database.sql            Ajustes incrementales de compatibilidad
start.sh                    Arranque local completo
```

## Documentacion

```text
docs/architecture/  Modelo y decisiones tecnicas
docs/context/       Contexto funcional del negocio
docs/guides/        Guias de modulos activos
docs/operations/    Checklist y operacion
docs/reports/       Auditorias, cierres y reportes tecnicos
```

## Como iniciar

1. Desde la raiz del proyecto ejecuta:

```bash
./start.sh
```

Eso levanta:

- PostgreSQL
- Migraciones pendientes
- Backend Fastify en `http://127.0.0.1:3000`
- Frontend Vite en `http://localhost:5173`

Si prefieres levantar solo el frontend:

```bash
cd frontend
npm install
npm run dev
```

Para build de produccion:

```bash
cd frontend
npm run build
```

## Variables de entorno

```bash
BOTICA_DB_HOST=localhost
BOTICA_DB_PORT=5432
BOTICA_DB_NAME=botica_db
BOTICA_DB_USER=tu_usuario_pg
BOTICA_DB_PASS=tu_password_pg
BOTICA_BACKEND_PORT=8081
BOTICA_FASTIFY_PORT=3000
BOTICA_FRONTEND_PORT=5173
BOTICA_CORS_ORIGIN=http://localhost:5173
BOTICA_PG_BIN=/ruta/a/binarios/postgresql
BOTICA_ENABLE_PHP_LEGACY=0
```

## Tunnel con Cloudflare

El frontend acepta `*.trycloudflare.com` y tambien hosts adicionales usando:

```bash
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=nuevo-subdominio.trycloudflare.com npm run dev
```
