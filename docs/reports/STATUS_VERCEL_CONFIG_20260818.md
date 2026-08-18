# STATUS VERCEL CONFIG - 2026-08-18

## Estado

- Repo produccion: `https://github.com/ZpectralCrystals/BoticaProduction.git`
- Rama: `main`
- Frontend preparado para Vercel como app Vite estatica.
- Supabase staging migrado y auditado sin bloqueantes DB.
- Backend Fastify sigue siendo servicio Node persistente; no es serverless Vercel todavia.

## Cambios aplicados

- `vercel.json` raiz define build desde `frontend/`.
- `frontend/src/lib/api.ts` ahora soporta `VITE_API_BASE_URL`.
- `frontend/.env.example` documenta API local/produccion.

## Variables Vercel necesarias

En Vercel frontend, configurar solo cuando exista backend publico:

```env
VITE_API_BASE_URL=https://TU_BACKEND_PUBLICO/api/v1
```

Si no se configura, frontend llama `/api/v1` relativo. Eso sirve en local por proxy Vite, pero en Vercel fallara salvo que exista backend/rewrite en el mismo dominio.

## Backend produccion pendiente

Elegir uno:

- Railway/Render/Fly/VPS: recomendado para Fastify actual.
- Convertir Fastify a Vercel serverless: posible, requiere adaptador y revisar rutas/tiempos.

Variables minimas del backend host:

```env
NODE_ENV=production
BOTICA_DB_HOST=aws-0-ca-central-1.pooler.supabase.com
BOTICA_DB_PORT=6543
BOTICA_DB_NAME=postgres
BOTICA_DB_USER=postgres.hzekajqbtzzigvlmrdaa
BOTICA_DB_PASSWORD=ROTAR_Y_CONFIGURAR
BOTICA_DB_SSL=require
BOTICA_DB_SSL_REJECT_UNAUTHORIZED=false
BOTICA_SKIP_DB_BOOTSTRAP=1
BOTICA_APPLY_MIGRATIONS=0
JWT_SECRET=GENERAR_SECRETO_LARGO
CORS_ORIGIN=https://TU_DOMINIO_VERCEL
```

## Antes de corte real

- Rotar password Supabase y actualizar backend host.
- Cambiar clave admin demo en sistema.
- Definir dominio final Vercel para `CORS_ORIGIN`.
- Ejecutar smoke API contra backend publico.
