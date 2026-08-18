# FIX_ERROR_COMPRAS_500

## 1. Causa raíz real

La causa real del fallo no estaba en el frontend.

El backend de compras ya dependía de columnas y tablas introducidas por migraciones nuevas, pero la base real todavía no estaba alineada.

Hallazgo confirmado en la base local `botica_db`:

- `bot_compras` no tenía `ctipo_comprobante`
- `bot_compras` no tenía `nalmacen_id`

Eso provocaba:

- `GET /api/v1/compras` fallando al hacer `SELECT c.nalmacen_id, c.ctipo_comprobante`
- `POST /api/v1/compras` fallando al hacer `INSERT INTO bot_compras (..., nalmacen_id, ctipo_comprobante, ...)`

El síntoma visible era exactamente el reportado:

1. frontend mostraba `No se pudieron cargar las compras`
2. al registrar compra, el frontend mostraba `Error del servidor`

## 2. Archivo(s) corregidos

- `backend-fastify/src/routes/purchases.routes.ts`
- `backend-fastify/src/plugins/error-handler.ts`
- `backend-fastify/src/__tests__/purchases.test.ts`
- `backend-fastify/src/__tests__/catalogos-compras.test.ts`

## 3. Migraciones faltantes

En la base real:

- `010_locales_almacenes.sql` ya estaba aplicada en lo esencial
- `011_compras_tipo_comprobante_factura.sql` faltaba
- `012_compras_almacen_destino.sql` faltaba

Acción realizada:

- se aplicó `ops/migrations/011_compras_tipo_comprobante_factura.sql`
- se aplicó `ops/migrations/012_compras_almacen_destino.sql`

Resultado:

- `bot_compras.ctipo_comprobante` ya existe
- `bot_compras.nalmacen_id` ya existe

## 4. Columnas faltantes detectadas

Antes del fix, en `bot_compras` faltaban:

- `ctipo_comprobante`
- `nalmacen_id`

Además, el backend de compras depende también de que existan:

- `bot_almacenes`
- `bot_locales`
- `bot_movimientos_almacen`
- `bot_lotes.nalmacen_id`
- `bot_kardex.nalmacen_id`

Esas piezas sí estaban presentes en la base local.

## 5. Qué rompía GET /compras

Ruta afectada:

```text
GET /api/v1/compras
```

Query problemática original:

```sql
SELECT c.nid, c.ccodigo, c.nproveedor_id, c.nalmacen_id,
       c.cproveedor, c.ctipo_comprobante, c.cdocumento, ...
FROM bot_compras c
LEFT JOIN bot_almacenes a ON a.nid = c.nalmacen_id
LEFT JOIN bot_locales l ON l.nid = a.nlocal_id
```

Error real confirmado contra PostgreSQL:

```text
ERROR: column c.nalmacen_id does not exist
```

Corrección aplicada:

- la ruta ahora inspecciona el schema real antes de consultar
- si faltan columnas nuevas, hace fallback seguro para listar compras viejas sin caer en 500
- si faltan migraciones, deja warning en logs

Resultado:

- `GET /api/v1/compras` ya lista compras reales sin 500

## 6. Qué rompía POST /compras

Ruta afectada:

```text
POST /api/v1/compras
```

Problema original:

- el `INSERT` de compra ya escribía `nalmacen_id` y `ctipo_comprobante`
- la base no tenía esas columnas
- el backend devolvía un 500 genérico hacia el frontend

También había riesgos adicionales de 500 evitable:

- producto inexistente terminando en error SQL posterior
- fecha inválida llegando al motor en vez de validarse antes
- schema desalineado terminando como error interno genérico

Correcciones aplicadas:

- validación explícita de schema de compras antes de registrar
- si falta schema, respuesta clara:
  - `PURCHASE_SCHEMA_OUTDATED`
  - con migraciones faltantes y elementos ausentes
- validación explícita de:
  - `proveedorId`
  - `almacenId`
  - `tipoComprobante`
  - `numeroDocumento`
  - productos existentes
  - fecha de vencimiento válida
- mantenimiento de 400 para errores de negocio
- mantenimiento de 503 claro cuando el problema es de schema/migración

## 7. Manejo de errores mejorado

En `backend-fastify/src/plugins/error-handler.ts` se agregó manejo claro para:

- `42703` (`undefined_column`)
- `42P01` (`undefined_table`)

Ahora, si una ruta cae por schema desalineado, responde:

- `DATABASE_SCHEMA_ERROR`
- con mensaje explícito de migraciones/columnas faltantes

en vez de un genérico `Error interno del servidor`.

## 8. Validación final realizada

### Validación de base real

Se confirmó con `psql`:

- antes del fix faltaban columnas en `bot_compras`
- después del fix esas columnas ya existen

### Validación real de endpoints

Con el backend corriendo en `127.0.0.1:3000`:

- `GET /api/v1/compras` respondió correctamente
- `POST /api/v1/compras` respondió correctamente con:

```json
{"ok":true,"id":"6","codigo":"CMP-20260412-0006","total":1.23}
```

También se verificó que esa compra generó correctamente:

- cabecera en `bot_compras`
- detalle en `bot_compras_det`
- lote en `bot_lotes`
- movimiento en `bot_movimientos_almacen`
- kardex en `bot_kardex`

Luego la compra de prueba fue eliminada para no dejar basura operativa.

### Validación automatizada

Comandos ejecutados:

- `cd backend-fastify && npm test -- --run src/__tests__/purchases.test.ts src/__tests__/catalogos-compras.test.ts`
- `cd backend-fastify && npm run build`

Resultado:

- tests compras: `16/16` OK
- build backend: OK

## 9. Estado final

El problema real quedó corregido.

Estado final de compras:

- `GET /api/v1/compras` funciona
- `POST /api/v1/compras` funciona
- si faltan migraciones en otro entorno, el error ya no queda oculto
- el backend ahora distingue mejor entre:
  - error de negocio (`400`)
  - schema desalineado (`503`)
  - error interno real (`500`)
