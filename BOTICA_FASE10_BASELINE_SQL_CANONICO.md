# BOTICA FASE 10 - Baseline SQL canonico actual

## 1. Resumen ejecutivo

Se creo baseline SQL canonico actual para levantar una base PostgreSQL nueva con el schema real usado por backend Fastify.

Baseline:

```txt
ops/baseline/schema_botica_actual.sql
```

No se modificaron reglas de negocio.

## 2. Problema encontrado

Fase 9 dejo `start.sh` preparado para aplicar migraciones `002-022`, pero no existia un SQL baseline canonico actual.

El archivo `docs/migrations/schema_farmacia_completo.sql` es legacy/Supabase y no representa el schema `bot_*` real usado por Fastify.

## 3. Graphify usado

Se reviso primero:

```bash
sed -n '1,240p' graphify-out/GRAPH_REPORT.md
```

Consultas:

```bash
graphify query "schema-check actual migraciones ops/migrations schema Drizzle tablas reales esperadas start.sh scripts backup restore baseline bot_productos bot_usuarios bot_compras bot_ventas" --budget 16000
graphify query "backend-fastify src db schema.ts drizzle pgTable bot_productos bot_lotes bot_caja bot_compras bot_ventas schema-check required columns" --budget 20000
graphify query "ops/migrations 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 alter table create table bot_" --budget 20000
graphify query "backup restore pg_dump schema_botica_actual start.sh BOTICA_SCHEMA_FILE baseline SQL botica_db" --budget 12000
```

## 4. Archivos revisados

- `backend-fastify/src/db/schema.ts`
- `backend-fastify/src/lib/schema-check.ts`
- `backend-fastify/check-schema.js`
- `backend-fastify/package.json`
- `start.sh`
- `ops/migrations/*.sql`
- `docs/migrations/schema_farmacia_completo.sql`
- `docs/migrations/fix_database.sql`

## 5. Archivos modificados

- `ops/baseline/schema_botica_actual.sql`
- `start.sh`
- `ops/migrations/008_rename_sales_clinical_customer_link.sql`
- `BOTICA_FASE10_BASELINE_SQL_CANONICO.md`

## 6. Cambios aplicados

### Baseline canonico

Se genero `ops/baseline/schema_botica_actual.sql` desde la base local alineada con Fases 0-9 usando:

```bash
pg_dump --schema-only --no-owner --no-privileges
```

Contenido:

- Tablas `bot_*` actuales.
- Constraints.
- Indices.
- Views.
- Triggers.
- Funciones SQL.
- Sin datos de prueba.
- Sin ownership ni privilegios locales.

### start.sh

`start.sh` ahora usa por defecto:

```bash
ops/baseline/schema_botica_actual.sql
```

`BOTICA_SCHEMA_FILE` sigue permitiendo override.

### Migracion 008

Se hizo mas idempotente `008_rename_sales_clinical_customer_link.sql`.

Motivo:

- Baseline actual ya contiene `bot_ventas.ncliente_clinico_id`.
- Migration `007` puede crear temporalmente `npaciente_id`.
- Migration `008` fallaba si existian columna/constraint nueva y vieja a la vez.

Cambio:

- Si existen ambas columnas, copia `npaciente_id` hacia `ncliente_clinico_id` cuando destino esta vacio.
- Si existen constraint/index viejo y nuevo, elimina viejo.
- Si existen ambas columnas al final, elimina `npaciente_id`.

## 7. Validacion de baseline

Se probo flujo real en DB temporal:

1. Crear DB temporal.
2. Aplicar `ops/baseline/schema_botica_actual.sql`.
3. Aplicar migraciones `002-022` en mismo orden de `start.sh`.
4. Ejecutar `backend-fastify/check-schema.js`.
5. Ejecutar `backend-fastify/src/lib/schema-check.ts`.
6. Eliminar DB temporal.

Resultado:

- OK: baseline aplica.
- OK: migraciones `002-022` aplican encima.
- OK: `check-schema.js`, 10 tablas y 14 columnas verificadas.
- OK: `src/lib/schema-check.ts`, 20 tablas y 65 columnas verificadas.

## 8. Validaciones tecnicas

```bash
bash -n start.sh
git diff --check

cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Resultado:

- OK: shell syntax.
- OK: diff sin whitespace errors.
- OK: backend TypeScript.
- OK: backend tests, 103 passed.
- OK: backend build.
- OK: backend lint.
- OK: frontend TypeScript.
- OK: frontend tests, 50 passed.
- OK: frontend build.
- OK: frontend lint.

Nota frontend: tests pasan con warning preexistente de React `act(...)` en `usePOS.test.ts`.

## 9. Riesgos encontrados

- `backend-fastify/src/db/schema.ts` no es espejo perfecto de DB real: ejemplo, `bot_almacenes` en DB usa `bpermite_venta`, mientras Drizzle declara `lpermite_venta`.
- `backend-fastify/check-schema.js` tiene set de checks mas corto que `src/lib/schema-check.ts`.
- Baseline se genero desde DB local actual; si DB local tuviera drift historico no deseado, ese drift queda en baseline.

## 10. Pendientes recomendados

- Alinear `backend-fastify/src/db/schema.ts` con DB real o declarar que `pg_dump` es fuente canonica de baseline.
- Unificar `backend-fastify/check-schema.js` con `src/lib/schema-check.ts` para evitar doble lista de requisitos.
- Agregar script formal `npm run schema:check` o `ops/scripts/check-schema.sh`.

## 11. Checklist final

- [x] Graphify usado antes de revisar codigo.
- [x] Baseline SQL creado en `ops/baseline/schema_botica_actual.sql`.
- [x] `start.sh` apunta al baseline canonico por default.
- [x] Migraciones `002-022` siguen aplicando encima del baseline.
- [x] Migration `008` robusta para estado mixto `npaciente_id`/`ncliente_clinico_id`.
- [x] DB temporal validada.
- [x] Schema-check simple OK.
- [x] Schema-check completo OK.
- [x] Build/tests/lint OK.
