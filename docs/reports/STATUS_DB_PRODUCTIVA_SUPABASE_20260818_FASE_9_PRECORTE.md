# Status DB productiva Supabase - Fase 9 precorte

Proyecto local: BoticaElPueblo-RebrandLab  
Fecha operativa: 2026-08-18 America/Lima  
Objetivo: dejar corte controlado listo sin guardar secretos.

## Resultado

F9 precorte: listo a nivel tecnico local.

No se ejecuto corte productivo definitivo porque password final/rotado no debe guardarse en repo y debe confirmarse en entorno real.

## Preparado

### start.sh remoto-aware

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/start.sh`

Cambios:

- Carga `backend-fastify/.env` temprano.
- Detecta DB remota.
- Salta arranque local PostgreSQL.
- Salta `createdb`.
- Salta migraciones legacy locales.
- Usa `BOTICA_SKIP_DB_BOOTSTRAP=1`.
- Usa `BOTICA_APPLY_MIGRATIONS=0`.

Motivo:

Supabase no debe recibir migraciones legacy de `ops/migrations/*` durante arranque app.

### Template env Supabase

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/ops/env/supabase.backend.env.example`

No contiene password real.

### Smoke API

Archivo:

`/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/scripts/smoke-supabase-api.sh`

Resultado local contra API temporal:

```txt
PASS health/ready
PASS auth/login
PASS auth/session
PASS inventario
PASS consistencia/resumen
```

## Validacion

Backend:

- `npm run build`: PASS.
- `npm test`: PASS, 133 tests.

Shell:

- `bash -n start.sh`: PASS.
- `bash -n scripts/smoke-supabase-api.sh`: PASS.

## Estado servicios temporales

API temporal:

`http://127.0.0.1:3017`

Frontend temporal:

`http://127.0.0.1:5176`

Ambos apuntan a Supabase staging validado.

## Falta para corte real

1. Confirmar password Supabase rotado.
2. Colocar password solo en env local/servidor, no repo.
3. Generar `JWT_SECRET` fuerte si sera producción.
4. Ajustar `CORS_ORIGIN` a URL final.
5. Levantar app con env nuevo.
6. Ejecutar `scripts/smoke-supabase-api.sh`.
7. Abrir UI y validar login/inventario/venta.

## Comando recomendado

```bash
cp ops/env/supabase.backend.env.example backend-fastify/.env
# editar backend-fastify/.env con password rotado y JWT_SECRET fuerte
BOTICA_FASTIFY_ENV_FILE=backend-fastify/.env ./start.sh
```

Smoke:

```bash
BOTICA_API_URL=http://127.0.0.1:3001/api/v1 scripts/smoke-supabase-api.sh
```

## Nota seguridad

Password anterior fue compartido en chat. Rotacion final obligatoria antes de usar Supabase como DB oficial.

