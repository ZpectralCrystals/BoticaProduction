# Status DB productiva Supabase - Fase 7 smoke app

Proyecto local: BoticaElPueblo-RebrandLab  
Supabase project ID: hzekajqbtzzigvlmrdaa  
Region: ca-central-1  
Fecha operativa: 2026-08-18 America/Lima  
Objetivo: validar backend local contra Supabase staging restaurado.

## Resultado

Fase 7 app smoke: OK.

Backend Fastify local conectado a Supabase pooler y consulto datos reales restaurados.

No se guardo password en repo.

## Cambio tecnico requerido

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backend-fastify/src/plugins/db.ts`

Cambio:

- Soporte `BOTICA_DB_SSL` / `DB_SSL` / `PGSSLMODE`.
- Soporte `BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false`.

Motivo:

Node `pg` rechazo certificado Supabase pooler en Mac con:

`self-signed certificate in certificate chain`

Con SSL configurable, backend arranco contra Supabase.

## Env validado

```bash
BOTICA_DB_HOST=aws-0-ca-central-1.pooler.supabase.com
BOTICA_DB_PORT=6543
BOTICA_DB_NAME=postgres
BOTICA_DB_USER=postgres.<project_id>
BOTICA_DB_SSL=require
BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false
PGOPTIONS='--search_path=public,extensions'
PORT=3017
CORS_ORIGIN=http://localhost:5174
```

Password usado solo en entorno de proceso local.

## Smoke ejecutado

API base:

`http://127.0.0.1:3017`

Usuario:

`ADMINISTRADOR`

Credencial funcional:

`DNI 00000000`

No se registra password en este reporte.

| Check | Resultado |
|---|---|
| `GET /health/live` | PASS HTTP 200 |
| `GET /health/ready` | PASS HTTP 200, productos activos 62 |
| `POST /api/v1/auth/login` | PASS HTTP 200 |
| `GET /api/v1/auth/session` | PASS HTTP 200 |
| `GET /api/v1/dashboard` | PASS HTTP 200 |
| `GET /api/v1/inventario?limit=5` | PASS HTTP 200 |
| `GET /api/v1/lotes?limit=5` | PASS HTTP 200 |
| `GET /api/v1/compras?limit=5` | PASS HTTP 200 |
| `GET /api/v1/ventas?limit=5` | PASS HTTP 200 |
| `GET /api/v1/caja` | PASS HTTP 200 |
| `GET /api/v1/consistencia/resumen` | PASS HTTP 200 |
| `GET /api/v1/proveedores?limit=5` | PASS HTTP 200 |
| `GET /api/v1/usuarios` | PASS HTTP 200 |

## Evidencia datos

- Productos activos: 62.
- Lotes endpoint responde.
- Compras endpoint responde.
- Ventas endpoint responde con 22 registros.
- Usuarios endpoint responde con 6 registros.

## Limitacion

Smoke fue read-only salvo auditoria de login generada por backend.

Falta smoke con escritura controlada:

- Compra nueva.
- Lote nuevo.
- Venta FEFO.
- Caja.
- Anulacion.
- Consistencia post-operacion.

Debe ejecutarse despues de backup Supabase staging post-restore.

## Siguiente paso

F8 hardening ops:

1. Backup Supabase staging.
2. Rotar password DB antes de produccion.
3. Crear env final fuera de repo.
4. Probar frontend local apuntando al backend Supabase.
5. Smoke con escritura controlada.
