import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { eq, and, or, ilike, asc, count } from 'drizzle-orm'
import { productos, proveedores } from '../db/schema.js'

function parseOptionalPrice(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return undefined
  return Number(price.toFixed(2))
}

function readTrimmedName(value: unknown) {
  return String(value || '').trim()
}

function readBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toUpperCase()
  if (['S', 'SI', 'TRUE', '1', 'YES'].includes(normalized)) return true
  if (['N', 'NO', 'FALSE', '0'].includes(normalized)) return false
  return fallback
}

function normalizeProductType(value: unknown) {
  const normalized = readTrimmedName(value).toUpperCase()
  return normalized === 'NO_MEDICAMENTO' ? 'NO_MEDICAMENTO' : 'MEDICAMENTO'
}

async function hasDuplicateActiveName(
  fastify: FastifyInstance,
  table: 'bot_familias_producto' | 'bot_categorias_producto' | 'bot_componentes_producto',
  name: string,
  excludeId = 0,
) {
  const result = await fastify.db.query(
    `SELECT nid
     FROM ${table}
     WHERE cestado = 'A'
       AND LOWER(BTRIM(cnombre)) = LOWER(BTRIM($1))
       AND ($2::INT = 0 OR nid <> $2)
     LIMIT 1`,
    [name, excludeId],
  )
  return result.rows.length > 0
}

async function resolveProductCatalogs(
  fastify: FastifyInstance,
  body: Record<string, unknown>,
  reply: any,
) {
  let familyId = Number(body.familyId || body.familiaId || 0)
  let categoryId = Number(body.categoryId || body.categoriaId || 0)
  let familyName = readTrimmedName(body.family)
  let categoryName = readTrimmedName(body.category) || 'Medicamentos'

  if (familyId > 0) {
    const family = await fastify.db.query<{ nid: number; cnombre: string }>(
      "SELECT nid, cnombre FROM bot_familias_producto WHERE nid = $1 AND cestado = 'A'",
      [familyId],
    )
    if (!family.rows[0]) {
      reply.code(400).send({ error: 'FAMILIA NO ENCONTRADA' })
      return null
    }
    familyName = family.rows[0].cnombre.trim()
  }

  if (categoryId > 0) {
    const category = await fastify.db.query<{
      nid: number
      cnombre: string
      nfamilia_id: number | null
      familia_nombre: string | null
    }>(
      `SELECT c.nid, c.cnombre, c.nfamilia_id, f.cnombre AS familia_nombre
       FROM bot_categorias_producto c
       LEFT JOIN bot_familias_producto f ON f.nid = c.nfamilia_id AND f.cestado = 'A'
       WHERE c.nid = $1 AND c.cestado = 'A'`,
      [categoryId],
    )
    const row = category.rows[0]
    if (!row) {
      reply.code(400).send({ error: 'CATEGORIA NO ENCONTRADA' })
      return null
    }
    if (row.nfamilia_id && familyId > 0 && row.nfamilia_id !== familyId) {
      reply.code(400).send({ error: 'CATEGORIA NO PERTENECE A LA FAMILIA' })
      return null
    }
    categoryName = row.cnombre.trim()
    if (row.nfamilia_id && familyId <= 0) {
      familyId = row.nfamilia_id
      familyName = row.familia_nombre?.trim() || familyName
    }
  }

  if (categoryId <= 0 && categoryName) {
    const category = await fastify.db.query<{
      nid: number
      cnombre: string
      nfamilia_id: number | null
      familia_nombre: string | null
    }>(
      `SELECT c.nid, c.cnombre, c.nfamilia_id, f.cnombre AS familia_nombre
       FROM bot_categorias_producto c
       LEFT JOIN bot_familias_producto f ON f.nid = c.nfamilia_id AND f.cestado = 'A'
       WHERE c.cestado = 'A'
         AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM($1))
       ORDER BY c.nid
       LIMIT 1`,
      [categoryName],
    )
    const row = category.rows[0]
    if (!row) {
      reply.code(400).send({ error: 'CATEGORIA NO ENCONTRADA' })
      return null
    }
    if (row.nfamilia_id && familyId > 0 && row.nfamilia_id !== familyId) {
      reply.code(400).send({ error: 'CATEGORIA NO PERTENECE A LA FAMILIA' })
      return null
    }
    categoryId = row.nid
    categoryName = row.cnombre.trim()
    if (row.nfamilia_id && familyId <= 0) {
      familyId = row.nfamilia_id
      familyName = row.familia_nombre?.trim() || familyName
    }
  }

  if (familyId <= 0 && familyName) {
    const family = await fastify.db.query<{ nid: number; cnombre: string }>(
      `SELECT nid, cnombre
       FROM bot_familias_producto
       WHERE cestado = 'A'
         AND LOWER(BTRIM(cnombre)) = LOWER(BTRIM($1))
       ORDER BY nid
       LIMIT 1`,
      [familyName],
    )
    if (family.rows[0]) {
      familyId = family.rows[0].nid
      familyName = family.rows[0].cnombre.trim()
    }
  }

  return {
    familyId: familyId > 0 ? familyId : null,
    categoryId: categoryId > 0 ? categoryId : null,
    familyName,
    categoryName,
  }
}

interface ProductComponentSelection {
  componenteId: number
  concentracion: string
  forma: string
  notas: string
}

function buildCompositionSummary(componentes: Array<{ nombre: string; concentracion?: string | null }>) {
  return componentes
    .map((component) => `${component.nombre}${component.concentracion ? ` ${component.concentracion}` : ''}`.trim())
    .filter(Boolean)
    .join(' + ')
}

async function resolveProductComponents(
  fastify: FastifyInstance,
  value: unknown,
  reply: any,
): Promise<ProductComponentSelection[] | null> {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    reply.code(400).send({ message: 'Componentes debe ser una lista' })
    return null
  }

  const selected: ProductComponentSelection[] = []
  const ids = new Set<number>()

  for (const raw of value) {
    const row = raw as Record<string, unknown>
    const componenteId = Number(row.componenteId || row.componentId || row.id || 0)
    if (!componenteId) {
      reply.code(400).send({ message: 'Componente invalido' })
      return null
    }
    if (ids.has(componenteId)) {
      reply.code(400).send({ message: 'No se puede repetir el mismo componente en el producto.' })
      return null
    }
    ids.add(componenteId)
    selected.push({
      componenteId,
      concentracion: readTrimmedName(row.concentracion),
      forma: readTrimmedName(row.forma),
      notas: readTrimmedName(row.notas),
    })
  }

  if (selected.length === 0) return selected

  const exists = await fastify.db.query<{ nid: number }>(
    "SELECT nid FROM bot_componentes_producto WHERE cestado = 'A' AND nid = ANY($1::INT[])",
    [[...ids]],
  )
  const activeIds = new Set(exists.rows.map((row) => Number(row.nid)))
  const missing = selected.find((row) => !activeIds.has(row.componenteId))
  if (missing) {
    reply.code(400).send({ message: 'Componente no encontrado o inactivo' })
    return null
  }

  return selected
}

async function replaceProductComponents(
  fastify: FastifyInstance,
  productId: number,
  components: ProductComponentSelection[],
) {
  await fastify.db.query('DELETE FROM bot_producto_componentes WHERE nproducto_id = $1', [productId])

  for (const component of components) {
    await fastify.db.query(
      `INSERT INTO bot_producto_componentes
         (nproducto_id, ncomponente_id, cconcentracion, cforma, cnotas)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        productId,
        component.componenteId,
        component.concentracion || null,
        component.forma || null,
        component.notas || null,
      ],
    )
  }
}

async function syncProductPrices(
  fastify: FastifyInstance,
  productId: number,
  prices: { precioVenta1: number; precioVenta2: number | null; precioVenta3: number | null },
  user: { id: number; nombre: string } | null | undefined,
) {
  const upsertPrecio = async (slot: string, value: number | null) => {
    if (value === null) {
      await fastify.db.query(
        `UPDATE bot_producto_precios
         SET lactivo = FALSE, nusuario_id = $1, cusuario = $2
         WHERE nproducto_id = $3 AND cnombre = $4`,
        [user?.id ?? null, user?.nombre ?? null, productId, slot],
      )
      return
    }

    await fastify.db.query(
      `INSERT INTO bot_producto_precios (nproducto_id, cnombre, nprecio, lactivo, nusuario_id, cusuario)
       VALUES ($1, $2, $3, TRUE, $4, $5)
       ON CONFLICT (nproducto_id, cnombre)
       DO UPDATE SET nprecio = EXCLUDED.nprecio,
                     lactivo = TRUE,
                     nusuario_id = EXCLUDED.nusuario_id,
                     cusuario = EXCLUDED.cusuario`,
      [productId, slot, value.toFixed(2), user?.id ?? null, user?.nombre ?? null],
    )
  }

  await upsertPrecio('PRECIO_1', prices.precioVenta1)
  await upsertPrecio('PRECIO_2', prices.precioVenta2)
  await upsertPrecio('PRECIO_3', prices.precioVenta3)
}

async function buildComponentSelectionSummary(
  fastify: FastifyInstance,
  components: ProductComponentSelection[],
) {
  if (components.length === 0) return ''
  const result = await fastify.db.query<{ nid: number; cnombre: string }>(
    "SELECT nid, cnombre FROM bot_componentes_producto WHERE nid = ANY($1::INT[])",
    [components.map((component) => component.componenteId)],
  )
  const names = new Map(result.rows.map((row) => [Number(row.nid), row.cnombre.trim()]))
  return buildCompositionSummary(components.map((component) => ({
    nombre: names.get(component.componenteId) || '',
    concentracion: component.concentracion,
  })))
}

export default async function inventoryRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/familias', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { search?: string; includeInactive?: string }
    const search = readTrimmedName(query.search)
    const includeInactive = query.includeInactive === 'true'
    const params: unknown[] = []
    let where = 'WHERE 1=1'

    if (!includeInactive) where += " AND f.cestado = 'A'"
    if (search) {
      params.push(`%${search}%`)
      where += ` AND f.cnombre ILIKE $${params.length}`
    }

    const result = await fastify.db.query(
      `SELECT f.nid, f.cnombre, f.cdescripcion, f.cestado,
              f.tcreado::TEXT, f.tmodifi::TEXT,
              COUNT(p.nid)::INT AS productos_count
       FROM bot_familias_producto f
       LEFT JOIN bot_productos p
         ON p.cestado = 'A'
        AND (
          p.nfamilia_id = f.nid
          OR (p.nfamilia_id IS NULL AND LOWER(BTRIM(p.cfamilia)) = LOWER(BTRIM(f.cnombre)))
        )
       ${where}
       GROUP BY f.nid, f.cnombre, f.cdescripcion, f.cestado, f.tcreado, f.tmodifi
       ORDER BY f.cnombre`,
      params,
    )

    return result.rows.map((row: any) => ({
      id: Number(row.nid),
      nombre: row.cnombre?.trim() || '',
      descripcion: row.cdescripcion || '',
      estado: row.cestado?.trim() || 'A',
      creado: row.tcreado,
      actualizado: row.tmodifi,
      productosCount: Number(row.productos_count || 0),
    }))
  })

  fastify.post('/familias', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar familias',
    }))) return

    const body = request.body as Record<string, unknown>
    const nombre = readTrimmedName(body.nombre)
    const descripcion = readTrimmedName(body.descripcion)

    if (!nombre) return reply.code(400).send({ message: 'Nombre obligatorio' })
    if (await hasDuplicateActiveName(fastify, 'bot_familias_producto', nombre)) {
      return reply.code(409).send({ message: 'Ya existe una familia activa con ese nombre' })
    }

    const inserted = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_familias_producto (cnombre, cdescripcion)
       VALUES ($1, $2)
       RETURNING nid`,
      [nombre, descripcion || null],
    )

    return { ok: true, id: String(inserted.rows[0].nid) }
  })

  fastify.patch('/familias/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar familias',
    }))) return

    const params = request.params as { id: string }
    const id = Number(params.id || 0)
    const body = request.body as Record<string, unknown>
    const nombre = readTrimmedName(body.nombre)
    const descripcion = readTrimmedName(body.descripcion)
    const estado = readTrimmedName(body.estado || 'A').toUpperCase() === 'I' ? 'I' : 'A'

    if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })
    if (!nombre) return reply.code(400).send({ message: 'Nombre obligatorio' })
    if (await hasDuplicateActiveName(fastify, 'bot_familias_producto', nombre, id)) {
      return reply.code(409).send({ message: 'Ya existe una familia activa con ese nombre' })
    }
    if (estado === 'I') {
      const used = await fastify.db.query(
        `SELECT p.nid
         FROM bot_productos p
         JOIN bot_familias_producto f ON f.nid = $1
         WHERE p.cestado = 'A'
           AND (p.nfamilia_id = f.nid OR LOWER(BTRIM(p.cfamilia)) = LOWER(BTRIM(f.cnombre)))
         LIMIT 1`,
        [id],
      )
      if (used.rows.length > 0) {
        return reply.code(409).send({ message: 'No se puede eliminar la familia porque está asociada a productos.' })
      }
    }

    await fastify.db.query(
      `UPDATE bot_familias_producto
       SET cnombre = $1, cdescripcion = $2, cestado = $3, tmodifi = NOW()
       WHERE nid = $4`,
      [nombre, descripcion || null, estado, id],
    )
    await fastify.db.query(
      "UPDATE bot_productos SET cfamilia = $1, tmodifi = NOW() WHERE nfamilia_id = $2 AND cestado = 'A'",
      [nombre, id],
    )

    return { ok: true, id: String(id) }
  })

  fastify.delete('/familias/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar familias',
    }))) return

    const params = request.params as { id: string }
    const id = Number(params.id || 0)
    if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })

    const used = await fastify.db.query(
      `SELECT p.nid
       FROM bot_productos p
       JOIN bot_familias_producto f ON f.nid = $1
       WHERE p.cestado = 'A'
         AND (p.nfamilia_id = f.nid OR LOWER(BTRIM(p.cfamilia)) = LOWER(BTRIM(f.cnombre)))
       LIMIT 1`,
      [id],
    )
    if (used.rows.length > 0) {
      return reply.code(409).send({ message: 'No se puede eliminar la familia porque está asociada a productos.' })
    }

    await fastify.db.query(
      "UPDATE bot_familias_producto SET cestado = 'I', tmodifi = NOW() WHERE nid = $1",
      [id],
    )

    return { ok: true, id: String(id) }
  })

  fastify.get('/categorias', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { search?: string; includeInactive?: string; familyId?: string }
    const search = readTrimmedName(query.search)
    const includeInactive = query.includeInactive === 'true'
    const familyId = Number(query.familyId || 0)
    const params: unknown[] = []
    let where = 'WHERE 1=1'

    if (!includeInactive) where += " AND c.cestado = 'A'"
    if (familyId > 0) {
      params.push(familyId)
      where += ` AND c.nfamilia_id = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      where += ` AND c.cnombre ILIKE $${params.length}`
    }

    const result = await fastify.db.query(
      `SELECT c.nid, c.nfamilia_id, c.cnombre, c.cdescripcion, c.cestado,
              c.tcreado::TEXT, c.tmodifi::TEXT,
              f.cnombre AS familia_nombre,
              COUNT(p.nid)::INT AS productos_count
       FROM bot_categorias_producto c
       LEFT JOIN bot_familias_producto f ON f.nid = c.nfamilia_id
       LEFT JOIN bot_productos p
         ON p.cestado = 'A'
        AND (
          p.ncategoria_id = c.nid
          OR (p.ncategoria_id IS NULL AND LOWER(BTRIM(p.ccategoria)) = LOWER(BTRIM(c.cnombre)))
        )
       ${where}
       GROUP BY c.nid, c.nfamilia_id, c.cnombre, c.cdescripcion, c.cestado, c.tcreado, c.tmodifi, f.cnombre
       ORDER BY c.cnombre`,
      params,
    )

    return result.rows.map((row: any) => ({
      id: Number(row.nid),
      familyId: row.nfamilia_id ? Number(row.nfamilia_id) : null,
      familyName: row.familia_nombre?.trim() || '',
      nombre: row.cnombre?.trim() || '',
      descripcion: row.cdescripcion || '',
      estado: row.cestado?.trim() || 'A',
      creado: row.tcreado,
      actualizado: row.tmodifi,
      productosCount: Number(row.productos_count || 0),
    }))
  })

  fastify.post('/categorias', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar categorías',
    }))) return

    const body = request.body as Record<string, unknown>
    const nombre = readTrimmedName(body.nombre)
    const descripcion = readTrimmedName(body.descripcion)
    const familyId = Number(body.familyId || body.familiaId || 0)

    if (!nombre) return reply.code(400).send({ message: 'Nombre obligatorio' })
    if (familyId > 0) {
      const family = await fastify.db.query("SELECT nid FROM bot_familias_producto WHERE nid = $1 AND cestado = 'A'", [familyId])
      if (!family.rows[0]) return reply.code(400).send({ message: 'Familia no encontrada' })
    }
    if (await hasDuplicateActiveName(fastify, 'bot_categorias_producto', nombre)) {
      return reply.code(409).send({ message: 'Ya existe una categoría activa con ese nombre' })
    }

    const inserted = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_categorias_producto (nfamilia_id, cnombre, cdescripcion)
       VALUES ($1, $2, $3)
       RETURNING nid`,
      [familyId > 0 ? familyId : null, nombre, descripcion || null],
    )

    return { ok: true, id: String(inserted.rows[0].nid) }
  })

  fastify.patch('/categorias/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar categorías',
    }))) return

    const params = request.params as { id: string }
    const id = Number(params.id || 0)
    const body = request.body as Record<string, unknown>
    const nombre = readTrimmedName(body.nombre)
    const descripcion = readTrimmedName(body.descripcion)
    const familyId = Number(body.familyId || body.familiaId || 0)
    const estado = readTrimmedName(body.estado || 'A').toUpperCase() === 'I' ? 'I' : 'A'

    if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })
    if (!nombre) return reply.code(400).send({ message: 'Nombre obligatorio' })
    if (familyId > 0) {
      const family = await fastify.db.query("SELECT nid FROM bot_familias_producto WHERE nid = $1 AND cestado = 'A'", [familyId])
      if (!family.rows[0]) return reply.code(400).send({ message: 'Familia no encontrada' })
    }
    if (await hasDuplicateActiveName(fastify, 'bot_categorias_producto', nombre, id)) {
      return reply.code(409).send({ message: 'Ya existe una categoría activa con ese nombre' })
    }
    if (estado === 'I') {
      const used = await fastify.db.query(
        `SELECT p.nid
         FROM bot_productos p
         JOIN bot_categorias_producto c ON c.nid = $1
         WHERE p.cestado = 'A'
           AND (p.ncategoria_id = c.nid OR LOWER(BTRIM(p.ccategoria)) = LOWER(BTRIM(c.cnombre)))
         LIMIT 1`,
        [id],
      )
      if (used.rows.length > 0) {
        return reply.code(409).send({ message: 'No se puede eliminar la categoría porque está asociada a productos.' })
      }
    }

    await fastify.db.query(
      `UPDATE bot_categorias_producto
       SET nfamilia_id = $1, cnombre = $2, cdescripcion = $3, cestado = $4, tmodifi = NOW()
       WHERE nid = $5`,
      [familyId > 0 ? familyId : null, nombre, descripcion || null, estado, id],
    )
    await fastify.db.query(
      `UPDATE bot_productos
       SET ccategoria = $1,
           nfamilia_id = $2,
           cfamilia = (SELECT cnombre FROM bot_familias_producto WHERE nid = $2),
           tmodifi = NOW()
       WHERE ncategoria_id = $3 AND cestado = 'A'`,
      [nombre, familyId > 0 ? familyId : null, id],
    )

    return { ok: true, id: String(id) }
  })

  fastify.delete('/categorias/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar categorías',
    }))) return

    const params = request.params as { id: string }
    const id = Number(params.id || 0)
    if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })

    const used = await fastify.db.query(
      `SELECT p.nid
       FROM bot_productos p
       JOIN bot_categorias_producto c ON c.nid = $1
       WHERE p.cestado = 'A'
         AND (p.ncategoria_id = c.nid OR LOWER(BTRIM(p.ccategoria)) = LOWER(BTRIM(c.cnombre)))
       LIMIT 1`,
      [id],
    )
    if (used.rows.length > 0) {
      return reply.code(409).send({ message: 'No se puede eliminar la categoría porque está asociada a productos.' })
    }

    await fastify.db.query(
      "UPDATE bot_categorias_producto SET cestado = 'I', tmodifi = NOW() WHERE nid = $1",
      [id],
    )

    return { ok: true, id: String(id) }
  })

  fastify.get('/componentes', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { search?: string; includeInactive?: string }
    const search = readTrimmedName(query.search)
    const includeInactive = query.includeInactive === 'true'
    const params: unknown[] = []
    let where = 'WHERE 1=1'

    if (!includeInactive) where += " AND c.cestado = 'A'"
    if (search) {
      params.push(`%${search}%`)
      where += ` AND c.cnombre ILIKE $${params.length}`
    }

    const result = await fastify.db.query(
      `SELECT c.nid, c.cnombre, c.cdescripcion, c.cestado,
              c.tcreado::TEXT, c.tmodifi::TEXT,
              COUNT(p.nid)::INT AS productos_count
       FROM bot_componentes_producto c
       LEFT JOIN bot_producto_componentes pc ON pc.ncomponente_id = c.nid
       LEFT JOIN bot_productos p ON p.nid = pc.nproducto_id AND p.cestado = 'A'
       ${where}
       GROUP BY c.nid, c.cnombre, c.cdescripcion, c.cestado, c.tcreado, c.tmodifi
       ORDER BY c.cnombre`,
      params,
    )

    return result.rows.map((row: any) => ({
      id: Number(row.nid),
      nombre: row.cnombre?.trim() || '',
      descripcion: row.cdescripcion || '',
      estado: row.cestado?.trim() || 'A',
      creado: row.tcreado,
      actualizado: row.tmodifi,
      productosCount: Number(row.productos_count || 0),
    }))
  })

  fastify.post('/componentes', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar componentes',
    }))) return

    const body = request.body as Record<string, unknown>
    const nombre = readTrimmedName(body.nombre)
    const descripcion = readTrimmedName(body.descripcion)

    if (!nombre) return reply.code(400).send({ message: 'Nombre obligatorio' })
    if (await hasDuplicateActiveName(fastify, 'bot_componentes_producto', nombre)) {
      return reply.code(409).send({ message: 'Ya existe un componente activo con ese nombre' })
    }

    const inserted = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_componentes_producto (cnombre, cdescripcion)
       VALUES ($1, $2)
       RETURNING nid`,
      [nombre, descripcion || null],
    )

    return { ok: true, id: String(inserted.rows[0].nid) }
  })

  fastify.patch('/componentes/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar componentes',
    }))) return

    const params = request.params as { id: string }
    const id = Number(params.id || 0)
    const body = request.body as Record<string, unknown>
    const nombre = readTrimmedName(body.nombre)
    const descripcion = readTrimmedName(body.descripcion)
    const estado = readTrimmedName(body.estado || 'A').toUpperCase() === 'I' ? 'I' : 'A'

    if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })
    if (!nombre) return reply.code(400).send({ message: 'Nombre obligatorio' })
    if (await hasDuplicateActiveName(fastify, 'bot_componentes_producto', nombre, id)) {
      return reply.code(409).send({ message: 'Ya existe un componente activo con ese nombre' })
    }
    if (estado === 'I') {
      const used = await fastify.db.query(
        `SELECT pc.nid
         FROM bot_producto_componentes pc
         JOIN bot_productos p ON p.nid = pc.nproducto_id
         WHERE pc.ncomponente_id = $1
           AND p.cestado = 'A'
         LIMIT 1`,
        [id],
      )
      if (used.rows.length > 0) {
        return reply.code(409).send({ message: 'No se puede eliminar el componente porque está asociado a productos.' })
      }
    }

    await fastify.db.query(
      `UPDATE bot_componentes_producto
       SET cnombre = $1, cdescripcion = $2, cestado = $3, tmodifi = NOW()
       WHERE nid = $4`,
      [nombre, descripcion || null, estado, id],
    )

    return { ok: true, id: String(id) }
  })

  fastify.delete('/componentes/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario'], {
      errorMessage: 'No tiene permisos para administrar componentes',
    }))) return

    const params = request.params as { id: string }
    const id = Number(params.id || 0)
    if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })

    const used = await fastify.db.query(
      `SELECT pc.nid
       FROM bot_producto_componentes pc
       JOIN bot_productos p ON p.nid = pc.nproducto_id
       WHERE pc.ncomponente_id = $1
         AND p.cestado = 'A'
       LIMIT 1`,
      [id],
    )
    if (used.rows.length > 0) {
      return reply.code(409).send({ message: 'No se puede eliminar el componente porque está asociado a productos.' })
    }

    await fastify.db.query(
      "UPDATE bot_componentes_producto SET cestado = 'I', tmodifi = NOW() WHERE nid = $1",
      [id],
    )

    return { ok: true, id: String(id) }
  })

  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { search?: string; limit?: string; sucursal_id?: string }
    const searchTerm = String(query.search || '').trim()
    const limit = Number(query.limit || 50)

    let sql = `
      SELECT p.nid, p.ccodigo, p.cnombre, p.cgenerico, p.ccategoria, p.cfamilia,
             COALESCE(p.ctipo_producto, 'MEDICAMENTO') AS ctipo_producto,
             p.nfamilia_id, p.ncategoria_id,
             p.cpresenta, p.claborat, p.nprecompra, p.npreventa, p.npreventa_2, p.npreventa_3, p.nstock, p.nstockmin,
             p.cubicacion, p.cproveedor, p.nproveedor_id, p.crotacion,
             p.tvencimien::TEXT, p.creceta,
             COALESCE(p.lrequiere_lote, TRUE) AS lrequiere_lote,
             COALESCE(p.lrequiere_vencimiento, TRUE) AS lrequiere_vencimiento,
             prov.cnombre AS proveedor_nombre,
             (
               SELECT json_agg(json_build_object(
                 'id', l.nid, 'codigo', l.ccodigo_lote,
                 'vencimiento', l.dfechavencimiento::TEXT,
                 'cantidad', l.ncantidad, 'estado', l.cestado,
                 'diasParaVencer', l.dfechavencimiento - CURRENT_DATE
               ) ORDER BY l.dfechavencimiento ASC)
               FROM bot_lotes l
               WHERE l.nproducto_id = p.nid AND l.cestado = 'ACTIVO' AND l.ncantidad > 0
             ) AS lotes_json,
             (
               SELECT json_agg(json_build_object(
                 'id', c.nid,
                 'nombre', c.cnombre,
                 'concentracion', pc.cconcentracion,
                 'forma', pc.cforma,
                 'notas', pc.cnotas
               ) ORDER BY c.cnombre)
               FROM bot_producto_componentes pc
               JOIN bot_componentes_producto c ON c.nid = pc.ncomponente_id AND c.cestado = 'A'
               WHERE pc.nproducto_id = p.nid
             ) AS componentes_json
       FROM bot_productos p
       LEFT JOIN bot_proveedores prov ON prov.nid = p.nproveedor_id
       WHERE p.cestado = 'A'
    `
    const params: any[] = []

    if (searchTerm) {
      sql += ` AND (p.cnombre ILIKE $1 OR p.ccodigo ILIKE $2 OR p.cgenerico ILIKE $3)`
      const term = `%${searchTerm}%`
      params.push(term, term, term)
    }

    sql += ` ORDER BY p.cnombre LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await fastify.db.query(sql, params)

    return result.rows.map((row: any) => {
      const lotes = row.lotes_json || []
      const componentes = row.componentes_json || []
      const composicion = buildCompositionSummary(componentes)
      const lotePrincipal = lotes.length > 0 ? lotes[0] : null
      return {
        id: String(row.nid),
        codigo: row.ccodigo?.trim() || '',
        name: row.cnombre?.trim() || '',
        tipoProducto: row.ctipo_producto?.trim() || 'MEDICAMENTO',
        generico: row.cgenerico?.trim() || '',
        composicion: composicion || row.cgenerico?.trim() || '',
        componentes: componentes.map((component: any) => ({
          id: Number(component.id),
          componenteId: Number(component.id),
          nombre: component.nombre?.trim() || '',
          concentracion: component.concentracion?.trim() || '',
          forma: component.forma?.trim() || '',
          notas: component.notas?.trim() || '',
        })),
        category: row.ccategoria?.trim() || '',
        family: row.cfamilia?.trim() || '',
        categoryId: row.ncategoria_id ? Number(row.ncategoria_id) : null,
        familyId: row.nfamilia_id ? Number(row.nfamilia_id) : null,
        presentacion: row.cpresenta?.trim() || '',
        laboratorio: row.claborat?.trim() || '',
        precioCompra: Number(row.nprecompra || 0),
        precioVenta: Number(row.npreventa || 0),
        precioVenta1: Number(row.npreventa || 0),
        precioVenta2: row.npreventa_2 === null || row.npreventa_2 === undefined ? null : Number(row.npreventa_2),
        precioVenta3: row.npreventa_3 === null || row.npreventa_3 === undefined ? null : Number(row.npreventa_3),
        stock: Number(row.nstock || 0),
        minStock: Number(row.nstockmin || 0),
        location: row.cubicacion?.trim() || '',
        supplier: row.proveedor_nombre?.trim() || row.cproveedor?.trim() || '',
        supplierId: row.nproveedor_id ? String(row.nproveedor_id) : '',
        rotation: row.crotacion,
        expiresAt: row.tvencimien,
        receta: row.creceta?.trim() || 'N',
        requiereLote: row.lrequiere_lote !== false,
        requiereVencimiento: row.lrequiere_vencimiento !== false,
        lotes,
        lotePrincipal: lotePrincipal ? {
          codigo: lotePrincipal.codigo,
          vencimiento: lotePrincipal.vencimiento,
          cantidad: lotePrincipal.cantidad,
          diasParaVencer: lotePrincipal.diasParaVencer,
        } : null,
        totalLotes: lotes.length,
      }
    })
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['inventario', 'almacenes'], {
      errorMessage: 'No tiene permisos para crear o ajustar inventario',
    }))) {
      return
    }

    const body = request.body as Record<string, unknown>
    const action = String(body.action || 'create')

    if (action === 'restock') {
      return reply.code(410).send({
        error: 'FLUJO_ELIMINADO',
        message: 'El reabastecimiento directo fue eliminado. Registre una compra en /api/v1/compras para ingresar stock con lote, fecha de vencimiento y trazabilidad completa.',
      })
    }

    if (action === 'updatePrices') {
      const user = request.authUser
      const id = Number(body.id || 0)
      const precioVenta1 = Number(body.precioVenta1 ?? body.precioVenta ?? 0)
      const precioVenta2 = parseOptionalPrice(body.precioVenta2)
      const precioVenta3 = parseOptionalPrice(body.precioVenta3)

      if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })
      if (!Number.isFinite(precioVenta1) || precioVenta2 === undefined || precioVenta3 === undefined) {
        return reply.code(400).send({ error: 'PRECIOS INVALIDOS' })
      }
      if (precioVenta1 < 0) {
        return reply.code(400).send({ error: 'LOS PRECIOS NO PUEDEN SER NEGATIVOS' })
      }
      if (precioVenta1 <= 0) {
        return reply.code(400).send({ error: 'PRECIO VENTA 1 DEBE SER MAYOR A CERO' })
      }

      // Escribimos en bot_producto_precios (canónico). Los triggers SQL:
      //   - sincronizan bot_productos.npreventa* (compat legacy)
      //   - registran cambio en bot_producto_precios_hist (auditoría)
      const client = await fastify.db.connect()
      try {
        await client.query('BEGIN')

        // Verifica producto existe + activo
        const prodRow = await client.query<{ nid: number }>(
          `SELECT nid FROM bot_productos WHERE nid = $1 AND cestado = 'A' FOR UPDATE`,
          [id],
        )
        if (!prodRow.rows[0]) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'PRODUCTO NO ENCONTRADO' })
        }

        const upsertPrecio = async (slot: string, value: number | null) => {
          if (value === null) {
            // Desactivar slot
            await client.query(
              `UPDATE bot_producto_precios
               SET lactivo = FALSE, nusuario_id = $1, cusuario = $2
               WHERE nproducto_id = $3 AND cnombre = $4`,
              [user?.id ?? null, user?.nombre ?? null, id, slot],
            )
            return
          }
          await client.query(
            `INSERT INTO bot_producto_precios (nproducto_id, cnombre, nprecio, lactivo, nusuario_id, cusuario)
             VALUES ($1, $2, $3, TRUE, $4, $5)
             ON CONFLICT (nproducto_id, cnombre)
             DO UPDATE SET nprecio = EXCLUDED.nprecio,
                           lactivo = TRUE,
                           nusuario_id = EXCLUDED.nusuario_id,
                           cusuario = EXCLUDED.cusuario`,
            [id, slot, value.toFixed(2), user?.id ?? null, user?.nombre ?? null],
          )
        }

        await upsertPrecio('PRECIO_1', precioVenta1)
        await upsertPrecio('PRECIO_2', precioVenta2)
        await upsertPrecio('PRECIO_3', precioVenta3)

        await client.query('COMMIT')
        return { ok: true, id: String(id) }
      } catch (error) {
        await client.query('ROLLBACK')
        request.log.error({ error }, 'Error actualizando precios')
        return reply.code(500).send({ error: 'No se pudieron actualizar los precios' })
      } finally {
        client.release()
      }
    }

    const requestedName = String(body.name || '').trim()
    const requestedTipoProducto = normalizeProductType(body.tipoProducto)
    const requestedGenerico = String(body.generico || '').trim()
    const requestedPrecioVenta1 = Number(body.precioVenta1 ?? body.precioVenta ?? 0)
    const requestedPrecioVenta2 = parseOptionalPrice(body.precioVenta2)
    const requestedPrecioVenta3 = parseOptionalPrice(body.precioVenta3)
    const componentsProvided = Object.prototype.hasOwnProperty.call(body, 'componentes')
    const hasUsableComponents = Array.isArray(body.componentes) && body.componentes.length > 0
    const isMedicine = requestedTipoProducto === 'MEDICAMENTO'

    if (!requestedName) {
      return reply.code(400).send({ error: 'NOMBRE ES OBLIGATORIO' })
    }
    if (isMedicine && !requestedGenerico && !hasUsableComponents) {
      return reply.code(400).send({ error: 'COMPOSICION ES OBLIGATORIA' })
    }
    if (!Number.isFinite(requestedPrecioVenta1) || requestedPrecioVenta1 < 0 || requestedPrecioVenta2 === undefined || requestedPrecioVenta3 === undefined) {
      return reply.code(400).send({ error: 'PRECIOS INVALIDOS' })
    }
    if (requestedPrecioVenta1 <= 0) {
      return reply.code(400).send({ error: 'PRECIO VENTA 1 DEBE SER MAYOR A CERO' })
    }

    const supplierId = Number(body.supplierId || body.proveedorId || 0)
    let supplierName = ''
    if (supplierId > 0) {
      // DRIZZLE: validar proveedor activo
      const [provRow] = await fastify.drizzle
        .select({ cnombre: proveedores.cnombre })
        .from(proveedores)
        .where(and(eq(proveedores.nid, supplierId), eq(proveedores.cestado, 'A')))
      if (!provRow) {
        return reply.code(400).send({ error: 'PROVEEDOR NO ENCONTRADO' })
      }
      supplierName = provRow.cnombre.trim()
    }

    const catalogSelection = await resolveProductCatalogs(fastify, body, reply)
    if (!catalogSelection) return
    const componentSelection = componentsProvided
      ? await resolveProductComponents(fastify, body.componentes, reply)
      : []
    if (componentSelection === null) return
    const componentSummary = componentsProvided
      ? await buildComponentSelectionSummary(fastify, componentSelection)
      : ''

    const payload = {
      name: requestedName,
      tipoProducto: requestedTipoProducto,
      generico: String(requestedGenerico || componentSummary || '').trim(),
      category: catalogSelection.categoryName,
      family: catalogSelection.familyName,
      categoryId: catalogSelection.categoryId,
      familyId: catalogSelection.familyId,
      presentacion: String(body.presentacion || '').trim(),
      laboratorio: String(body.laboratorio || '').trim(),
      precioVenta1: requestedPrecioVenta1,
      precioVenta2: requestedPrecioVenta2,
      precioVenta3: requestedPrecioVenta3,
      stock: Number(body.stock || 0),
      minStock: Number(body.minStock || 0),
      expiresAt: String(body.expiresAt || '').trim() || null,
      location: String(body.location || '').trim(),
      supplierId: supplierId || null,
      supplierName,
      rotation: String(body.rotation || 'Media').trim(),
      receta: String(body.receta || 'N').trim(),
      requiereLote: true,
      requiereVencimiento: true,
    }
    payload.requiereLote = isMedicine ? true : readBoolean(body.requiereLote ?? body.lrequiereLote, false)
    payload.requiereVencimiento = isMedicine ? true : readBoolean(body.requiereVencimiento ?? body.lrequiereVencimiento, false)
    const productPrices = {
      precioVenta1: payload.precioVenta1,
      precioVenta2: payload.precioVenta2 ?? null,
      precioVenta3: payload.precioVenta3 ?? null,
    }

    if (action === 'update') {
      const id = Number(body.id || 0)
      if (!id) return reply.code(400).send({ error: 'ID INVALIDO' })

      // DRIZZLE: actualizar producto por ID
      await fastify.drizzle
        .update(productos)
        .set({
          cnombre: payload.name,
          ctipoProducto: payload.tipoProducto,
          cgenerico: payload.generico || null,
          ccategoria: payload.category,
          cfamilia: payload.family || null,
          nfamiliaId: payload.familyId,
          ncategoriaId: payload.categoryId,
          cpresenta: payload.presentacion || null,
          claborat: payload.laboratorio || null,
          npreventa: String(payload.precioVenta1),
          npreventa2: payload.precioVenta2 === null ? null : String(payload.precioVenta2),
          npreventa3: payload.precioVenta3 === null ? null : String(payload.precioVenta3),
          nstockmin: payload.minStock,
          cubicacion: payload.location || null,
          nproveedorId: payload.supplierId,
          cproveedor: payload.supplierName || null,
          crotacion: payload.rotation,
          tvencimien: payload.expiresAt,
          creceta: payload.receta,
          lrequiereLote: payload.requiereLote,
          lrequiereVencimiento: payload.requiereVencimiento,
          tmodifi: new Date(),
        })
        .where(eq(productos.nid, id))
      if (componentsProvided) {
        await replaceProductComponents(fastify, id, componentSelection)
      }
      await syncProductPrices(fastify, id, productPrices, request.authUser)

      return { ok: true, id: String(id) }
    }

    // DRIZZLE: contar productos para generar código único
    const [countRow] = await fastify.drizzle.select({ cnt: count() }).from(productos)
    const sequence = Number(countRow?.cnt ?? 0) + 1
    const code = `${payload.category.slice(0, 3).toUpperCase()}-${String(sequence).padStart(3, '0')}`

    // DRIZZLE: insertar nuevo producto
    const [inserted] = await fastify.drizzle
      .insert(productos)
      .values({
        ccodigo: code,
        cnombre: payload.name,
        ctipoProducto: payload.tipoProducto,
        cgenerico: payload.generico || null,
        ccategoria: payload.category,
        cfamilia: payload.family || null,
        nfamiliaId: payload.familyId,
        ncategoriaId: payload.categoryId,
        cpresenta: payload.presentacion || null,
        claborat: payload.laboratorio || null,
        npreventa: String(payload.precioVenta1),
        npreventa2: payload.precioVenta2 === null ? null : String(payload.precioVenta2),
        npreventa3: payload.precioVenta3 === null ? null : String(payload.precioVenta3),
        nstock: payload.stock,
        nstockmin: payload.minStock,
        cubicacion: payload.location || null,
        nproveedorId: payload.supplierId,
        cproveedor: payload.supplierName || null,
        crotacion: payload.rotation,
        tvencimien: payload.expiresAt,
        creceta: payload.receta,
        lrequiereLote: payload.requiereLote,
        lrequiereVencimiento: payload.requiereVencimiento,
      })
      .returning({ nid: productos.nid })
    if (componentsProvided) {
      await replaceProductComponents(fastify, inserted.nid, componentSelection)
    }
    await syncProductPrices(fastify, inserted.nid, productPrices, request.authUser)

    return { ok: true, id: String(inserted.nid), codigo: code }
  })

  // GET /inventario/distribucion - Stock por almacén y lote
  fastify.get('/distribucion', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { search?: string; localId?: string; almacenId?: string }
    const searchTerm = String(query.search || '').trim()
    const localId = Number(query.localId || 0)
    const almacenId = Number(query.almacenId || 0)

    // 1. Aggregated stock per product × almacén from view
    let vwSql = `
      SELECT v.producto_id, v.producto_codigo, v.producto_nombre,
             v.almacen_id, v.almacen_nombre, v.ctipo_almacen,
             v.bpermite_venta, v.bpermite_consumo_clinico,
             v.local_id, v.local_nombre, v.ctipo_local,
             v.stock_disponible, v.lotes_activos, v.proximo_vencimiento::TEXT
      FROM vw_stock_por_almacen v
      WHERE 1=1
    `
    const params: unknown[] = []
    let idx = 1

    if (searchTerm) {
      vwSql += ` AND (v.producto_nombre ILIKE $${idx} OR v.producto_codigo ILIKE $${idx + 1})`
      const term = `%${searchTerm}%`
      params.push(term, term)
      idx += 2
    }
    if (localId > 0) {
      vwSql += ` AND v.local_id = $${idx}`
      params.push(localId)
      idx += 1
    }
    if (almacenId > 0) {
      vwSql += ` AND v.almacen_id = $${idx}`
      params.push(almacenId)
      idx += 1
    }

    vwSql += ` ORDER BY v.producto_nombre, v.local_nombre, v.almacen_nombre`

    const vwResult = await fastify.db.query(vwSql, params)

    // 2. For each product×almacen, get lote details
    const productIds = [...new Set(vwResult.rows.map((r: any) => r.producto_id))]

    let lotesMap: Record<string, any[]> = {}
    if (productIds.length > 0) {
      const lotesResult = await fastify.db.query(
        `SELECT l.nproducto_id, l.nalmacen_id, l.nid, l.ccodigo_lote,
                l.dfechavencimiento::TEXT AS vencimiento,
                l.ncantidad, l.cestado,
                (l.dfechavencimiento - CURRENT_DATE) AS dias_para_vencer
         FROM bot_lotes l
         WHERE l.nproducto_id = ANY($1)
           AND l.cestado = 'ACTIVO'
           AND l.ncantidad > 0
         ORDER BY l.dfechavencimiento ASC`,
        [productIds],
      )
      for (const lote of lotesResult.rows as any[]) {
        const key = `${lote.nproducto_id}-${lote.nalmacen_id}`
        if (!lotesMap[key]) lotesMap[key] = []
        lotesMap[key].push({
          id: lote.nid,
          codigoLote: lote.ccodigo_lote?.trim() || 'SIN-LOTE',
          vencimiento: lote.vencimiento,
          cantidad: Number(lote.ncantidad),
          diasParaVencer: Number(lote.dias_para_vencer),
        })
      }
    }

    // 3. Group by product
    type AlmacenEntry = {
      almacenId: number; almacenNombre: string; tipoAlmacen: string
      permiteVenta: boolean; permiteConsumoClinico: boolean
      localId: number; localNombre: string; tipoLocal: string
      stock: number; lotesActivos: number; proximoVencimiento: string | null
      lotes: any[]
    }
    type ProductEntry = {
      productoId: number; productoCodigo: string; productoNombre: string
      stockTotal: number; stockVendible: number; stockNoVendible: number
      almacenes: AlmacenEntry[]
    }

    const productMap: Record<number, ProductEntry> = {}
    for (const row of vwResult.rows as any[]) {
      const pid = row.producto_id
      if (!productMap[pid]) {
        productMap[pid] = {
          productoId: pid,
          productoCodigo: row.producto_codigo?.trim() || '',
          productoNombre: row.producto_nombre?.trim() || '',
          stockTotal: 0,
          stockVendible: 0,
          stockNoVendible: 0,
          almacenes: [],
        }
      }
      const stock = Number(row.stock_disponible || 0)
      productMap[pid].stockTotal += stock
      if (row.bpermite_venta) productMap[pid].stockVendible += stock
      else productMap[pid].stockNoVendible += stock

      const key = `${pid}-${row.almacen_id}`
      productMap[pid].almacenes.push({
        almacenId: row.almacen_id,
        almacenNombre: row.almacen_nombre?.trim() || '',
        tipoAlmacen: row.ctipo_almacen?.trim() || '',
        permiteVenta: !!row.bpermite_venta,
        permiteConsumoClinico: !!row.bpermite_consumo_clinico,
        localId: row.local_id,
        localNombre: row.local_nombre?.trim() || '',
        tipoLocal: row.ctipo_local?.trim() || '',
        stock,
        lotesActivos: Number(row.lotes_activos || 0),
        proximoVencimiento: row.proximo_vencimiento || null,
        lotes: lotesMap[key] || [],
      })
    }

    const listaProductos = Object.values(productMap).sort((a, b) => a.productoNombre.localeCompare(b.productoNombre))

    return {
      success: true,
      totalProductos: listaProductos.length,
      totalStockVendible: listaProductos.reduce((s, p) => s + p.stockVendible, 0),
      totalStockNoVendible: listaProductos.reduce((s, p) => s + p.stockNoVendible, 0),
      productos: listaProductos,
    }
  })

  // GET /inventario/search - Buscar productos por nombre/código
  // DRIZZLE: migrado completamente — SELECT simple con ilike + limit
  fastify.get('/search', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const query = request.query as { search?: string; limit?: string }
    const searchTerm = String(query.search || '').trim()
    const limit = Math.max(1, Math.min(Number(query.limit || 10), 100))

    try {
      const baseCondition = eq(productos.cestado, 'A')
      const whereClause = searchTerm
        ? and(
            baseCondition,
            or(
              ilike(productos.cnombre, `%${searchTerm}%`),
              ilike(productos.ccodigo, `%${searchTerm}%`),
              ilike(productos.cgenerico, `%${searchTerm}%`),
            ),
          )
        : baseCondition

      const rows = await fastify.drizzle
        .select({
          nid: productos.nid,
          ccodigo: productos.ccodigo,
          cnombre: productos.cnombre,
          cgenerico: productos.cgenerico,
          ccategoria: productos.ccategoria,
          cfamilia: productos.cfamilia,
          nfamiliaId: productos.nfamiliaId,
          ncategoriaId: productos.ncategoriaId,
          cpresenta: productos.cpresenta,
          claborat: productos.claborat,
          nprecompra: productos.nprecompra,
          npreventa: productos.npreventa,
          npreventa2: productos.npreventa2,
          npreventa3: productos.npreventa3,
          nstock: productos.nstock,
          nstockmin: productos.nstockmin,
          cubicacion: productos.cubicacion,
          cproveedor: productos.cproveedor,
          crotacion: productos.crotacion,
          tvencimien: productos.tvencimien,
          creceta: productos.creceta,
          cestado: productos.cestado,
        })
        .from(productos)
        .where(whereClause)
        .orderBy(asc(productos.cnombre))
        .limit(limit)

      return {
        success: true,
        data: rows.map((row) => ({
          id: row.nid,
          codigo: row.ccodigo?.trim() || '',
          nombre: row.cnombre?.trim() || '',
          generico: row.cgenerico?.trim() || '',
          categoria: row.ccategoria?.trim() || '',
          familia: row.cfamilia?.trim() || '',
          categoryId: row.ncategoriaId ? Number(row.ncategoriaId) : null,
          familyId: row.nfamiliaId ? Number(row.nfamiliaId) : null,
          presentacion: row.cpresenta?.trim() || '',
          laboratorio: row.claborat?.trim() || '',
          precioCompra: Number(row.nprecompra || 0),
          precioVenta: Number(row.npreventa || 0),
          precioVenta1: Number(row.npreventa || 0),
          precioVenta2: row.npreventa2 === null || row.npreventa2 === undefined ? null : Number(row.npreventa2),
          precioVenta3: row.npreventa3 === null || row.npreventa3 === undefined ? null : Number(row.npreventa3),
          stock: Number(row.nstock || 0),
          minStock: Number(row.nstockmin || 0),
          location: row.cubicacion?.trim() || '',
          supplier: row.cproveedor?.trim() || '',
          rotation: row.crotacion,
          expiresAt: row.tvencimien,
          receta: row.creceta?.trim() || 'N',
        })),
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({
        success: false,
        error: 'Error al buscar productos',
      })
    }
  })

  // GET /precios/historial/:productoId — historial de cambios de precios por producto
  fastify.get('/precios/historial/:productoId', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { productoId } = request.params as { productoId: string }
    const id = Number(productoId)
    if (!id) return reply.code(400).send({ error: 'ID inválido' })

    const result = await fastify.db.query<{
      nid: number
      cnombre: string
      nprecio_anterior: string | null
      nprecio_nuevo: string
      caccion: string
      cusuario: string | null
      tcreado: string
    }>(
      `SELECT nid, cnombre, nprecio_anterior::TEXT, nprecio_nuevo::TEXT,
              caccion, cusuario, tcreado::TEXT
       FROM bot_producto_precios_hist
       WHERE nproducto_id = $1
       ORDER BY tcreado DESC
       LIMIT 100`,
      [id],
    )

    return result.rows.map((row) => ({
      nid: String(row.nid),
      slot: row.cnombre,
      precioAnterior: row.nprecio_anterior !== null ? Number(row.nprecio_anterior) : null,
      precioNuevo: Number(row.nprecio_nuevo),
      accion: row.caccion,
      usuario: row.cusuario,
      fecha: row.tcreado,
    }))
  })
}
