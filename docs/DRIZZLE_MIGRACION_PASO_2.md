# Drizzle ORM — Migración Progresiva: Paso 2

**Fecha:** Abril 2026  
**Estrategia:** Migración progresiva, segura e incremental  
**Principio rector:** _Migración parcial, segura y limpia, antes que una migración más grande pero frágil._

---

## Resumen ejecutivo

En esta fase se completó la integración de Drizzle ORM en el backend Fastify con los siguientes resultados:

| Aspecto            | Estado               |
|--------------------|----------------------|
| Build TypeScript   | ✅ Sin errores       |
| Tests backend      | ✅ 73/73 pasando     |
| Regresiones        | ✅ Cero              |
| Rutas migradas     | `inventory.routes.ts` |
| Rutas en raw SQL   | `purchases.routes.ts` |

---

## Infraestructura Drizzle establecida (Paso 1, ya completado)

Antes de esta fase se había configurado:

- `src/db/schema.ts` — schema Drizzle mapeando todas las tablas del ERP
- `src/db/index.ts` — `createDrizzle()` + re-exports de operadores
- `src/plugins/drizzle.ts` — plugin Fastify que decora `fastify.drizzle`
- `src/server.ts` — `drizzlePlugin` registrado tras el plugin `db`
- `drizzle.config.ts` — configuración para `drizzle-kit`
- `package.json` — scripts `db:generate`, `db:push`, `db:studio`

---

## Paso 2: Lo que se migró

### `inventory.routes.ts` — MIGRADO A DRIZZLE ✅

Archivo: `backend-fastify/src/routes/inventory.routes.ts`

#### Queries migradas

| Endpoint             | Query                         | Tipo Drizzle              | Razón de migración               |
|----------------------|-------------------------------|---------------------------|----------------------------------|
| `GET /search`        | SELECT con ilike + limit      | `.select().where().orderBy().limit()` | SELECT simple, sin joins, sin lógica de negocio crítica |
| `POST /` (proveedor) | SELECT validación proveedor   | `.select().where(and(eq, eq))` | Lookup de validación, sin transacción |
| `POST /` (update)    | UPDATE bot_productos          | `.update().set().where()`  | UPDATE directo por PK, sin dependencias |
| `POST /` (count)     | COUNT(*) para secuencia código| `.select({ cnt: count() })` | Agregación simple |
| `POST /` (insert)    | INSERT bot_productos          | `.insert().values().returning()` | INSERT con RETURNING, sin transacción |

#### Patrón establecido

```typescript
// Imports al inicio del archivo
import { eq, and, or, ilike, asc, count } from 'drizzle-orm'
import { productos, proveedores } from '../db/schema.js'

// SELECT con filtros
const rows = await fastify.drizzle
  .select({ nid: productos.nid, cnombre: productos.cnombre })
  .from(productos)
  .where(and(eq(productos.cestado, 'A'), ilike(productos.cnombre, `%${term}%`)))
  .orderBy(asc(productos.cnombre))
  .limit(limit)

// UPDATE por PK
await fastify.drizzle
  .update(productos)
  .set({ cnombre: payload.name, tmodifi: new Date() })
  .where(eq(productos.nid, id))

// INSERT con RETURNING
const [inserted] = await fastify.drizzle
  .insert(productos)
  .values({ ccodigo: code, cnombre: payload.name, ... })
  .returning({ nid: productos.nid })
```

#### Queries que permanecen en raw SQL (en inventory)

| Endpoint          | Query                                  | Razón                                              |
|-------------------|----------------------------------------|----------------------------------------------------|
| `GET /`           | SELECT con `json_agg` y subquery       | Drizzle no soporta `json_agg` sin `sql` template; la query actual es correcta y probada |
| `GET /distribucion` | Vista `vw_stock_por_almacen` + lot detalle | Usa una DB view y joins complejos; raw SQL más claro y verificado |

---

## Paso 2: Lo que quedó en raw SQL

### `purchases.routes.ts` — MANTENIDO EN RAW SQL ⚠️

Archivo: `backend-fastify/src/routes/purchases.routes.ts`

#### Decisión y razón

Durante esta fase se intentó migrar los 3 lookups pre-transacción a Drizzle:
- Validación de productos (`inArray`)
- Validación de proveedor (`eq`)
- Validación de almacén destino (`eq`)

**Los tests fallaron (6/73 con 500 en lugar de 400/200).**

La causa raíz identificada: el helper de tests (`buildTestApp.ts`) usa un mock pool de `pg` que espera `pool.query(sql: string, params[])`. Drizzle v0.45 llama internamente al pool con un formato potencialmente diferente (objeto `{ text, values }` o `{ text, values, rowMode: 'array' }`), lo que hace que `sql.trim()` del mock lance un `TypeError` antes de que el route handler pueda responder con 400.

**Decisión adoptada:** Se revirtieron los cambios en `purchases.routes.ts`. El archivo usa exclusivamente `fastify.db.query()`.

#### Queries que permanecen en raw SQL

| Sección                     | Query                                         | Razón para mantener |
|-----------------------------|-----------------------------------------------|---------------------|
| Pre-transacción: productos  | `SELECT nid, cnombre FROM bot_productos WHERE nid = ANY($1::INT[])` | Tests no compatibles con Drizzle internal pool format |
| Pre-transacción: proveedor  | `SELECT cnombre FROM bot_proveedores WHERE ...` | Mismo motivo |
| Pre-transacción: almacén    | `SELECT nid, cnombre, ctipo_almacen FROM bot_almacenes WHERE ...` | Mismo motivo |
| Transacción completa        | `BEGIN / COMMIT / ROLLBACK` + todos los INSERTs/UPDATEs | Transacción con `FOR UPDATE` lock, FEFO, UPSERT de lotes — raw SQL obligatorio por atomicidad |
| Schema checks               | `information_schema.tables / columns`         | Consultas de introspección de schema, sin tabla Drizzle |

---

## Correcciones de infraestructura aplicadas en esta fase

### `schema.ts` — Columnas de `bot_productos` corregidas

Las columnas del schema Drizzle estaban incorrectas para `bot_productos`. Se corrigieron contra el SQL real de las rutas:

| Campo JS (antes)    | Columna DB (antes)   | Campo JS (ahora) | Columna DB (ahora) | Estado  |
|---------------------|----------------------|-------------------|--------------------|---------|
| `cpresentacion`     | `cpresentacion`      | `cpresenta`       | `cpresenta`        | ✅ Fix  |
| `claboratorio`      | `claboratorio`       | `claborat`        | `claborat`         | ✅ Fix  |
| `nprecioCompra`     | `nprecio_compra`     | `nprecompra`      | `nprecompra`       | ✅ Fix  |
| `nprecioVenta`      | `nprecio_venta`      | `npreventa`       | `npreventa`        | ✅ Fix  |
| `nstockMinimo`      | `nstock_minimo`      | `nstockmin`       | `nstockmin`        | ✅ Fix  |
| _(faltaba)_         | _(faltaba)_          | `cproveedor`      | `cproveedor`       | ✅ Add  |
| _(faltaba)_         | _(faltaba)_          | `tvencimien`      | `tvencimien`       | ✅ Add  |

### `buildTestApp.ts` — Correcciones

- Añadido `username` y `supervisor` a `TEST_USER` (campos faltantes de `AuthUser`)
- Registrado `drizzlePlugin` (sin efecto en tests actuales; listo para fase 3)

### `db/index.ts` — Operators añadidos

Añadidos `asc`, `desc`, `count` a los re-exports.

---

## Criterio de decisión: cuándo usar Drizzle vs raw SQL

| Tipo de operación                             | Usar Drizzle | Usar raw SQL |
|-----------------------------------------------|:------------:|:------------:|
| SELECT simple con filtros eq/ilike/inArray     | ✅           |              |
| INSERT con `.values()` + `.returning()`        | ✅           |              |
| UPDATE por PK con `.set()`                     | ✅           |              |
| COUNT, SUM, MIN/MAX simples                    | ✅           |              |
| SELECT con `ORDER BY` y `LIMIT`                | ✅           |              |
| Transacciones con `BEGIN/COMMIT/ROLLBACK`      |              | ✅           |
| `SELECT ... FOR UPDATE` (row-level lock)       |              | ✅           |
| Queries sobre vistas (`vw_*`)                  |              | ✅           |
| `json_agg`, `array_agg`, CTEs complejos        |              | ✅ (o `sql` template) |
| Introspección de `information_schema`          |              | ✅           |
| UPSERT con lógica condicional (FEFO, lotes)    |              | ✅           |
| Rutas con tests que usan mock pool pg          | ⚠️ Pendiente fase 3 | ✅ por ahora |

---

## Qué falta para migrar `purchases.routes.ts` en Fase 3

Para poder migrar los lookups pre-transacción de compras a Drizzle, se necesita **una de las siguientes**:

### Opción A — Actualizar el helper de tests (recomendada)
Hacer que `createMockClient()` y el `mockPool` en `buildTestApp.ts` soporten ambos formatos de llamada al pool:

```typescript
// Manejar tanto query(sql, params) como query({ text, values, rowMode })
type QueryInput = string | { text: string; values?: unknown[]; rowMode?: string }

async query(sqlOrConfig: QueryInput, _params?: unknown[]) {
  const sql = typeof sqlOrConfig === 'string' ? sqlOrConfig : sqlOrConfig.text
  // ... resto del mock
}
```

Adicionalmente, si Drizzle usa `rowMode: 'array'`, las respuestas del mock deben devolver filas como arrays en lugar de objetos. Esto requiere conocer el orden exacto de columnas del SELECT generado por Drizzle.

**Bloqueante:** requiere confirmar el formato exacto que Drizzle v0.45 usa al llamar al pool (leer `node_modules/drizzle-orm/node-postgres/session.js`).

### Opción B — Mock de Drizzle separado en tests
Crear un mock de `fastify.drizzle` en `buildTestApp.ts` que implemente el builder pattern (`.select().from().where()`) pero internamente use el mock pool de pg.

```typescript
// buildTestApp.ts
const mockDrizzle = createMockDrizzleBuilder(mockClient)
fastify.decorate('drizzle', mockDrizzle)
```

Esta opción no depende de los internals de Drizzle pero requiere implementar el builder pattern completo.

### Opción C — Tests de integración reales
Usar un servidor PostgreSQL en los tests (e.g., `testcontainers` o Docker) en lugar del mock pool. Esto elimina la dependencia de formatos internos de pg completamente.

---

## Estado final de archivos

```
backend-fastify/src/
├── db/
│   ├── schema.ts          ← Columnas de bot_productos corregidas
│   └── index.ts           ← Exports: eq, and, or, ilike, asc, desc, count, inArray...
├── plugins/
│   └── drizzle.ts         ← Plugin registrado en server.ts → fastify.drizzle disponible
├── routes/
│   ├── inventory.routes.ts  ← MIGRADO a Drizzle (5 queries: select, update, insert, count, proveedor lookup)
│   └── purchases.routes.ts  ← Raw SQL (toda la ruta; TODO Fase 3)
└── __tests__/
    └── helpers/
        └── buildTestApp.ts  ← drizzlePlugin registrado + TEST_USER corregido
```

---

## Métricas de la fase

- **Queries migradas a Drizzle:** 5 (en `inventory.routes.ts`)
- **Queries mantenidas en raw SQL:** ~20 (en `purchases.routes.ts` completa)
- **Nuevas tablas con schema correcto:** `bot_productos` (7 columnas corregidas/añadidas)
- **Tests:** 73/73 ✅
- **Build TypeScript:** limpio ✅
- **Regresiones:** 0 ✅
