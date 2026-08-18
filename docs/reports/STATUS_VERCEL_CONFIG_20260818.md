# STATUS VERCEL CONFIG - 2026-08-18

## Estado

- Repo produccion: `https://github.com/ZpectralCrystals/BoticaProduction.git`
- Rama: `main`
- Frontend y backend preparados para convivir en el mismo proyecto Vercel.
- Supabase staging migrado y auditado sin bloqueantes DB.
- Backend Fastify adaptado como Vercel Function bajo `/api/*`.
- Dominio productivo detectado: `https://botica-production.vercel.app`.
- Variables del proyecto Vercel: configuradas como sensibles para Production y Preview.
- API pública validada contra Supabase: `HTTP 200`, 64 productos activos.
- Login, panel e inventario validados desde la interfaz productiva.

## Cambios aplicados

- `vercel.json` instala y compila frontend + backend.
- `api/[...path].ts` entrega todas las rutas API a Fastify.
- Rewrite `/api/:path*` resuelve explícitamente hacia la Function antes del fallback SPA.
- `package.json` raíz fuerza runtime ESM compatible con backend Fastify.
- `backend-fastify/src/server.ts` permite arranque persistente y serverless.
- `backend-fastify/src/plugins/db.ts` acepta variables Botica o `DATABASE_URL`/`POSTGRES_URL`.
- `frontend/src/lib/api.ts` ahora soporta `VITE_API_BASE_URL`.
- `frontend/.env.example` documenta API local/produccion.

## Variables Vercel necesarias

No configurar `VITE_API_BASE_URL`: frontend usa `/api/v1` en el mismo dominio.

Configurar en Vercel para Production, Preview y Development:

```env
BOTICA_DB_HOST=aws-0-ca-central-1.pooler.supabase.com
BOTICA_DB_PORT=6543
BOTICA_DB_NAME=postgres
BOTICA_DB_USER=postgres.hzekajqbtzzigvlmrdaa
BOTICA_DB_PASS=SECRETO_SUPABASE
BOTICA_DB_SSL=require
BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false
PGOPTIONS=--search_path=public,extensions
JWT_SECRET=SECRETO_ALEATORIO_MINIMO_32_CARACTERES
```

`CORS_ORIGIN` es opcional en Vercel: se deriva de `VERCEL_URL`. Usarlo solo si se habilitan dominios externos adicionales.

## Validacion ejecutada

- Backend: build, lint y 133/133 tests OK.
- Frontend: build, lint y 56/56 tests OK.
- Handler Vercel importado localmente sin errores.
- API local + Supabase: `/health/ready` 200, 64 productos activos.
- Auditoría npm productiva: frontend 0, backend 0 vulnerabilidades.
- Pruebas finales: backend 133/133, frontend 56/56; build y lint OK.
- Primer deploy serverless: Function creada, pero rewrite SPA todavía devolvía 405.
- Corrección posterior: prioridad explícita de `/api/*` y health público en `/api/health`.
- Segundo deploy: routing correcto; runtime detectó wrapper CommonJS intentando cargar backend ESM.
- Corrección posterior: proyecto raíz declarado `type: module`.

## Cierre del corte

- [x] Variables Supabase/JWT cargadas sin exponer valores.
- [x] Build serverless y redeploy en estado `Ready`.
- [x] `/api/health` responde `200` con DB conectada.
- [x] Login JWT y rutas protegidas funcionando.
- [x] Inventario productivo visible desde Vercel.

## Pendiente operativo, no de programación

- [ ] Cambiar clave admin demo antes de entrega pública.
- [ ] Rotar password Supabase y actualizar Vercel en la misma operación.
- [ ] Definir dominio final y monitoreo externo cuando el negocio lo solicite.

Supabase permanece en plan Free. SUNAT, Clerk y servicios externos quedan fuera del
cierre funcional actual y se evaluarán en otra fase.
