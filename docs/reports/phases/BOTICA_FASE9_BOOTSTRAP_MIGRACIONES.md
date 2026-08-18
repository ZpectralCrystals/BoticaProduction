# BOTICA FASE 9 - Bootstrap local y migraciones automaticas

## 1. Resumen ejecutivo

Se actualizo el bootstrap local para aplicar migraciones SQL de forma explicita hasta la `022`.

No se modificaron reglas de negocio, FEFO, caja, compras, CXP, productos, reportes ni layout.

## 2. Problema encontrado

`start.sh` solo aplicaba:

- `014_usuarios_clerk_link.sql`
- `015_productos_precios_venta.sql`
- `016_productos_familias_categorias.sql`
- `017_productos_componentes.sql`

Quedaban fuera migraciones criticas:

- `018_lotes_costo_y_producto_flags.sql`
- `019_producto_precios_y_historial.sql`
- `020_caja_movimientos_y_cxp.sql`
- `021_cierre_caja_persistente.sql`
- `022_productos_tipo_no_medicamento.sql`

Eso explicaba que una base local pudiera arrancar con schema incompleto antes de Fase 8.

Tambien se encontro que `start.sh` referencia `schema_farmacia_completo.sql` y `fix_database.sql` en raiz, pero esos archivos no existen en raiz. El repositorio contiene versiones legacy en `docs/migrations/`, no confirmadas como baseline canonico actual.

## 3. Graphify usado

Se reviso primero:

```bash
sed -n '1,220p' graphify-out/GRAPH_REPORT.md
```

Consultas:

```bash
graphify query "start.sh bootstrap PostgreSQL migraciones ops/migrations schema-check README instalacion 002 022" --budget 12000
```

## 4. Archivos revisados

- `start.sh`
- `backend-fastify/README.md`
- `docs/operations/CIERRE_SISTEMA_CHECKLIST.md`
- `backend-fastify/src/lib/schema-check.ts`
- `ops/migrations/*.sql`
- `docs/migrations/schema_farmacia_completo.sql`
- `docs/migrations/fix_database.sql`

## 5. Archivos modificados

- `start.sh`
- `BOTICA_FASE9_BOOTSTRAP_MIGRACIONES.md`

## 6. Cambios aplicados

### Orden explicito de migraciones

`start.sh` ahora declara `MIGRATIONS` con orden fijo:

```txt
002_nstock_constraint.sql
003_bot_kardex.sql
004_bot_lotes.sql
005_fefo.sql
006_deduplicate_entities.sql
006_migrar_stock_a_lotes.sql
007_unify_customers_and_patients.sql
008_rename_sales_clinical_customer_link.sql
009_deduplicate_services.sql
010_locales_almacenes.sql
011_compras_tipo_comprobante_factura.sql
012_compras_almacen_destino.sql
013_proveedores_ruc_unico_y_auditoria.sql
014_usuarios_clerk_link.sql
015_productos_precios_venta.sql
016_productos_familias_categorias.sql
017_productos_componentes.sql
018_lotes_costo_y_producto_flags.sql
019_producto_precios_y_historial.sql
020_caja_movimientos_y_cxp.sql
021_cierre_caja_persistente.sql
022_productos_tipo_no_medicamento.sql
```

Se mantiene orden explicito para los dos `006`.

### Schema inicial configurable

Se agregaron variables:

```bash
BOTICA_SCHEMA_FILE
BOTICA_FIX_FILE
```

Defaults:

```bash
SCHEMA_FILE="$DIR/schema_farmacia_completo.sql"
FIX_FILE="$DIR/fix_database.sql"
```

Si la DB no existe y no hay schema inicial, `start.sh` falla con mensaje claro.

### Validacion de baseline

Antes de aplicar migraciones, `start.sh` verifica que existan tablas base:

- `bot_productos`
- `bot_usuarios`
- `bot_compras`
- `bot_ventas`

Si faltan, falla antes de correr migraciones. Esto evita aplicar migraciones modernas sobre schema legacy/incompatible.

### Migraciones requeridas

Si una migracion listada en `MIGRATIONS` no existe en `ops/migrations/`, `start.sh` ahora falla con error explicito. Ya no omite archivos faltantes en silencio.

## 7. Estado de base nueva

Automatizado:

- Si existe DB con baseline canonico, `start.sh` aplica `002-022`.
- Si DB no existe, `start.sh` puede crearla si `BOTICA_SCHEMA_FILE` apunta a un SQL baseline canonico.
- Si no hay baseline canonico, falla rapido y explica la variable requerida.

Pendiente fuera de esta fase:

- Versionar o generar un baseline SQL canonico actual que cree `bot_*` base desde cero.

## 8. Validaciones ejecutadas

```bash
bash -n start.sh
git diff --check
```

Resultado:

- OK: sintaxis de `start.sh`.
- OK: diff sin whitespace errors.
- OK: existen todos los archivos SQL listados en `MIGRATIONS`.

Tambien se ejecutaron validaciones tecnicas completas despues del cambio:

```bash
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

- OK: backend TypeScript.
- OK: backend tests, 103 passed.
- OK: backend build.
- OK: backend lint.
- OK: frontend TypeScript.
- OK: frontend tests, 50 passed.
- OK: frontend build.
- OK: frontend lint.

Nota: no se ejecuto `start.sh` completo contra la DB local para evitar re-aplicar migraciones de datos sobre una base ya alineada manualmente en Fase 8.

## 9. Riesgos

- El repo no tiene en raiz un `schema_farmacia_completo.sql` canonico actual.
- `docs/migrations/schema_farmacia_completo.sql` parece legacy/Supabase y no crea claramente el baseline `bot_*` usado por backend Fastify actual.
- Bootstrap desde DB totalmente vacia depende de proveer `BOTICA_SCHEMA_FILE` correcto.

## 10. Checklist final

- [x] `start.sh` revisado.
- [x] Migraciones `002-022` agregadas al bootstrap.
- [x] Orden duplicado `006` explicitado.
- [x] `019/020/021/022` incluidas.
- [x] Baseline requerido validado antes de migrar.
- [x] Migracion requerida faltante falla en vez de omitirse.
- [x] No se tocaron reglas de negocio.
- [x] Reporte Fase 9 creado.
