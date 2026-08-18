# Fase 00 - Aislamiento

## Objetivo
- Crear laboratorio local para rebranding sin tocar repo real ni git remoto.

## Hecho
- Copia local creada en `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab`.
- `.git` no fue copiado.
- `node_modules`, `dist` y backups pesados no fueron copiados.
- Puertos separados:
  - Frontend lab: `5174`
  - Backend lab: `3001`
- Scripts lab agregados:
  - `frontend`: `npm run dev:lab`
  - `backend-fastify`: `npm run dev:lab`
- Vite proxy lab apunta a `http://127.0.0.1:3001`.
- Backend dev acepta CORS desde `http://localhost:5174`.

## No tocado
- Repo real `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo`.
- Git remoto.
- Base de datos.

## Riesgo
- Lab usa misma DB por ahora si backend se levanta sin `BOTICA_DB_NAME` distinto.
- Para pruebas visuales basta. Para pruebas destructivas, duplicar DB antes.

## Estado
- Fase completa.
