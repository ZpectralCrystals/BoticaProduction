import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

const TIPOS_COMPROBANTE_PERMITIDOS = ['FACTURA'] as const
const PURCHASE_SCHEMA_MIGRATIONS = {
  almacenes: '010_locales_almacenes.sql',
  tipoComprobante: '011_compras_tipo_comprobante_factura.sql',
  almacenDestino: '012_compras_almacen_destino.sql',
} as const

type PurchaseSchemaStatus = {
  hasAlmacenesTable: boolean
  hasLocalesTable: boolean
  hasMovimientosAlmacenTable: boolean
  comprasTieneTipoComprobante: boolean
  comprasTieneAlmacenId: boolean
  lotesTieneAlmacenId: boolean
  kardexTieneAlmacenId: boolean
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

async function getPurchaseSchemaStatus(fastify: FastifyInstance): Promise<PurchaseSchemaStatus> {
  const tablesResult = await fastify.db.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('bot_almacenes', 'bot_locales', 'bot_movimientos_almacen')
  `)

  const columnsResult = await fastify.db.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'bot_compras' AND column_name IN ('ctipo_comprobante', 'nalmacen_id'))
        OR (table_name = 'bot_lotes' AND column_name = 'nalmacen_id')
        OR (table_name = 'bot_kardex' AND column_name = 'nalmacen_id')
      )
  `)

  const tables = new Set(tablesResult.rows.map((row) => row.table_name))
  const columns = new Set(columnsResult.rows.map((row) => `${row.table_name}.${row.column_name}`))

  return {
    hasAlmacenesTable: tables.has('bot_almacenes'),
    hasLocalesTable: tables.has('bot_locales'),
    hasMovimientosAlmacenTable: tables.has('bot_movimientos_almacen'),
    comprasTieneTipoComprobante: columns.has('bot_compras.ctipo_comprobante'),
    comprasTieneAlmacenId: columns.has('bot_compras.nalmacen_id'),
    lotesTieneAlmacenId: columns.has('bot_lotes.nalmacen_id'),
    kardexTieneAlmacenId: columns.has('bot_kardex.nalmacen_id'),
  }
}

function getMissingPurchaseMigrations(status: PurchaseSchemaStatus) {
  const missing = new Set<string>()

  if (
    !status.hasAlmacenesTable ||
    !status.hasLocalesTable ||
    !status.hasMovimientosAlmacenTable ||
    !status.lotesTieneAlmacenId ||
    !status.kardexTieneAlmacenId
  ) {
    missing.add(PURCHASE_SCHEMA_MIGRATIONS.almacenes)
  }
  if (!status.comprasTieneTipoComprobante) {
    missing.add(PURCHASE_SCHEMA_MIGRATIONS.tipoComprobante)
  }
  if (!status.comprasTieneAlmacenId) {
    missing.add(PURCHASE_SCHEMA_MIGRATIONS.almacenDestino)
  }

  return Array.from(missing)
}

function buildSchemaErrorMessage(status: PurchaseSchemaStatus) {
  const migrations = getMissingPurchaseMigrations(status)
  const missingElements: string[] = []

  if (!status.comprasTieneTipoComprobante) missingElements.push('bot_compras.ctipo_comprobante')
  if (!status.comprasTieneAlmacenId) missingElements.push('bot_compras.nalmacen_id')
  if (!status.lotesTieneAlmacenId) missingElements.push('bot_lotes.nalmacen_id')
  if (!status.kardexTieneAlmacenId) missingElements.push('bot_kardex.nalmacen_id')
  if (!status.hasAlmacenesTable) missingElements.push('tabla bot_almacenes')
  if (!status.hasLocalesTable) missingElements.push('tabla bot_locales')
  if (!status.hasMovimientosAlmacenTable) missingElements.push('tabla bot_movimientos_almacen')

  return {
    message: `La base de datos no está alineada con el backend de compras. Faltan aplicar migraciones: ${migrations.join(', ')}`,
    details: {
      missingMigrations: migrations,
      missingElements,
    },
  }
}

export default async function purchasesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const query = request.query as { id?: string }
    const schemaStatus = await getPurchaseSchemaStatus(fastify)
    const supportsWarehouseJoin =
      schemaStatus.comprasTieneAlmacenId &&
      schemaStatus.hasAlmacenesTable &&
      schemaStatus.hasLocalesTable

    const selectAlmacenId = schemaStatus.comprasTieneAlmacenId
      ? 'c.nalmacen_id'
      : 'NULL::INT AS nalmacen_id'
    const selectTipoComprobante = schemaStatus.comprasTieneTipoComprobante
      ? 'c.ctipo_comprobante'
      : `'FACTURA'::VARCHAR AS ctipo_comprobante`
    const selectWarehouseFields = supportsWarehouseJoin
      ? `a.cnombre AS almacen_nombre,
                a.ctipo_almacen AS almacen_tipo,
                l.cnombre AS local_nombre`
      : `NULL::VARCHAR AS almacen_nombre,
                NULL::VARCHAR AS almacen_tipo,
                NULL::VARCHAR AS local_nombre`
    const warehouseJoins = supportsWarehouseJoin
      ? `LEFT JOIN bot_almacenes a ON a.nid = c.nalmacen_id
         LEFT JOIN bot_locales l ON l.nid = a.nlocal_id`
      : ''

    const missingMigrations = getMissingPurchaseMigrations(schemaStatus)
    if (missingMigrations.length > 0) {
      request.log.warn(
        { missingMigrations, schemaStatus },
        'Purchase listing running with partial schema support',
      )
    }

    if (query.id) {
      const purchaseId = Number(query.id)
      const purchaseResult = await fastify.db.query(
        `SELECT c.*,
                ${selectAlmacenId},
                ${selectTipoComprobante},
                p.cnombre AS proveedor_nombre,
                ${selectWarehouseFields}
         FROM bot_compras c
         LEFT JOIN bot_proveedores p ON p.nid = c.nproveedor_id
         ${warehouseJoins}
         WHERE c.nid = $1`,
        [purchaseId],
      )
      const compra = purchaseResult.rows[0]
      if (!compra) {
        return reply.code(404).send({ error: 'COMPRA NO ENCONTRADA' })
      }

      const detailResult = await fastify.db.query(
        `SELECT d.*, pr.cnombre AS producto_nombre
         FROM bot_compras_det d
         LEFT JOIN bot_productos pr ON pr.nid = d.nproducto_id
         WHERE d.ncompra_id = $1`,
        [purchaseId],
      )

      return { compra, detalle: detailResult.rows }
    }

    const result = await fastify.db.query(
      `SELECT c.nid, c.ccodigo, c.nproveedor_id, ${selectAlmacenId},
              c.cproveedor, ${selectTipoComprobante}, c.cdocumento, c.ntotal, c.cestado,
              COALESCE(c.ctipo_pago, 'CONTADO') AS ctipo_pago,
              c.tfecha_vencimiento::TEXT       AS tfecha_vencimiento,
              c.tcreado::TEXT,
              ${selectWarehouseFields}
       FROM bot_compras c
       ${warehouseJoins}
       ORDER BY c.tcreado DESC
       LIMIT 50`,
    )

    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['compras'], {
      errorMessage: 'No tiene permisos para registrar compras',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      proveedorId?: number
      tipoComprobante?: string
      numeroDocumento?: string
      notas?: string
      almacenId?: number
      tipoPago?: string
      fechaVencimientoFactura?: string
      items?: Array<{
        productoId?: number
        cantidad?: number
        precioUnit?: number
        codigoLote?: string
        fechaVencimiento?: string
        notasLote?: string
      }>
    }

    const proveedorId = Number(body.proveedorId || 0)
    const tipoComprobante = String(body.tipoComprobante || '').trim().toUpperCase()
    const numeroDocumento = String(body.numeroDocumento || '').trim().toUpperCase()
    const notas = String(body.notas || '').trim()
    const tipoPago = String(body.tipoPago || 'CONTADO').trim().toUpperCase()
    const fechaVencimientoFactura = String(body.fechaVencimientoFactura || '').trim()
    const items = Array.isArray(body.items) ? body.items : []
    const validItems = items.filter((item) => Number(item.productoId || 0) > 0)

    if (!['CONTADO', 'CREDITO'].includes(tipoPago)) {
      return reply.code(400).send({ message: 'El tipo de pago debe ser CONTADO o CREDITO' })
    }

    if (tipoPago === 'CREDITO' && !fechaVencimientoFactura) {
      return reply.code(400).send({ message: 'La fecha de vencimiento de factura es obligatoria para compras a credito' })
    }

    if (tipoPago === 'CREDITO' && !isValidDateOnly(fechaVencimientoFactura)) {
      return reply.code(400).send({ message: 'La fecha de vencimiento de factura debe tener formato YYYY-MM-DD' })
    }

    if (!proveedorId || proveedorId <= 0) {
      return reply.code(400).send({ message: 'Debe seleccionar un proveedor' })
    }

    if (!tipoComprobante) {
      return reply.code(400).send({ message: 'El tipo de comprobante es obligatorio' })
    }

    if (!TIPOS_COMPROBANTE_PERMITIDOS.includes(tipoComprobante as typeof TIPOS_COMPROBANTE_PERMITIDOS[number])) {
      return reply.code(400).send({ message: 'En esta fase solo se permite FACTURA' })
    }

    if (!numeroDocumento) {
      return reply.code(400).send({ message: 'Debe ingresar el número de comprobante' })
    }

    if (validItems.length === 0) {
      return reply.code(400).send({ message: 'Debe agregar al menos un producto' })
    }

    for (const item of validItems) {
      const fVenc = String(item.fechaVencimiento || '').trim()
      const cantidad = Number(item.cantidad || 0)
      const precioUnit = Number(item.precioUnit || 0)
      if (fVenc && !isValidDateOnly(fVenc)) {
        return reply.code(400).send({ message: 'La fecha de vencimiento debe tener formato YYYY-MM-DD válido' })
      }
      if (cantidad <= 0) {
        return reply.code(400).send({ message: 'La cantidad de cada producto debe ser mayor a 0' })
      }
      if (precioUnit < 0) {
        return reply.code(400).send({ message: 'El precio unitario no puede ser negativo' })
      }
    }

    // Resolve almacen destino
    const almacenId = Number(body.almacenId || 0)
    if (!almacenId || almacenId <= 0) {
      return reply.code(400).send({ message: 'Debe seleccionar un almacén destino' })
    }

    const schemaStatus = await getPurchaseSchemaStatus(fastify)
    const missingMigrations = getMissingPurchaseMigrations(schemaStatus)
    if (missingMigrations.length > 0) {
      const schemaError = buildSchemaErrorMessage(schemaStatus)
      request.log.error(
        { schemaStatus, body },
        'Purchase creation blocked because database schema is outdated',
      )
      return reply.code(503).send({
        error: 'PURCHASE_SCHEMA_OUTDATED',
        message: schemaError.message,
        details: schemaError.details,
      })
    }

    const productIds = Array.from(
      new Set(validItems.map((item) => Number(item.productoId || 0)).filter((item) => item > 0)),
    )
    // RAW SQL: lookup de productos — mantenido en raw SQL por compatibilidad con mock de tests
    // TODO Fase 3: migrar a Drizzle una vez el test helper soporte el formato interno de Drizzle
    const productResult = await fastify.db.query<{
      nid: number
      cnombre: string
      lrequiere_lote: boolean | null
      lrequiere_vencimiento: boolean | null
    }>(
      `SELECT nid, cnombre,
              COALESCE(lrequiere_lote, TRUE)         AS lrequiere_lote,
              COALESCE(lrequiere_vencimiento, TRUE)  AS lrequiere_vencimiento
       FROM bot_productos
       WHERE nid = ANY($1::INT[]) AND cestado = 'A'`,
      [productIds],
    )
    const productMap = new Map(
      productResult.rows.map((row) => [
        row.nid,
        {
          nombre: row.cnombre.trim(),
          requiereLote: row.lrequiere_lote !== false,
          requiereVencimiento: row.lrequiere_vencimiento !== false,
        },
      ]),
    )
    const missingProductId = productIds.find((productId) => !productMap.has(productId))
    if (missingProductId) {
      return reply.code(400).send({ message: `Producto ${missingProductId} no encontrado o inactivo` })
    }

    // Re-validar lote/vencimiento contra flags reales del producto
    for (const item of validItems) {
      const meta = productMap.get(Number(item.productoId))
      if (!meta) continue
      const cLote = String(item.codigoLote || '').trim()
      const fVenc = String(item.fechaVencimiento || '').trim()
      if (meta.requiereLote && !cLote) {
        return reply.code(400).send({ message: `Producto ${meta.nombre} requiere código de lote` })
      }
      if (meta.requiereVencimiento && !fVenc) {
        return reply.code(400).send({ message: `Producto ${meta.nombre} requiere fecha de vencimiento` })
      }
      if (fVenc && !isValidDateOnly(fVenc)) {
        return reply.code(400).send({ message: 'La fecha de vencimiento debe tener formato YYYY-MM-DD válido' })
      }
    }

    // RAW SQL: validar proveedor activo
    const provResult = await fastify.db.query<{ cnombre: string }>(
      'SELECT cnombre FROM bot_proveedores WHERE nid = $1 AND cestado = $2',
      [proveedorId, 'A'],
    )
    if (!provResult.rows[0]) {
      return reply.code(400).send({ message: 'Proveedor no encontrado' })
    }
    const proveedor = provResult.rows[0].cnombre.trim()

    // RAW SQL: validar almacén destino activo
    const almCheck = await fastify.db.query<{ nid: number; cnombre: string; ctipo_almacen: string }>(
      "SELECT nid, cnombre, ctipo_almacen FROM bot_almacenes WHERE nid = $1 AND cestado = 'A'",
      [almacenId],
    )
    if (!almCheck.rows.length) {
      return reply.code(400).send({ message: 'Almacén destino no encontrado o inactivo' })
    }
    const almacen = almCheck.rows[0]
    const almacenDetalle = `${almacen.cnombre.trim()} (${almacen.ctipo_almacen.trim()})`

    const total = validItems.reduce(
      (sum, item) => sum + Number(item.cantidad || 1) * Number(item.precioUnit || 0),
      0,
    )

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      let cajaId: number | null = null
      if (tipoPago === 'CONTADO') {
        const cajaResult = await client.query<{ nid: number }>(
          `SELECT nid
           FROM bot_caja
           WHERE nusuario_id = $1
             AND cestado = 'A'
           ORDER BY tapertura DESC
           LIMIT 1
           FOR UPDATE`,
          [user.id],
        )
        cajaId = cajaResult.rows[0]?.nid ?? null
        if (!cajaId) {
          await client.query('ROLLBACK')
          return reply.code(400).send({
            error: 'NO_HAY_CAJA_ABIERTA',
            message: 'Debe abrir caja para registrar compras al contado',
          })
        }
      }

      const todayResult = await client.query<{ today: string }>('SELECT CURRENT_DATE::TEXT AS today')
      const today = (todayResult.rows[0]?.today || '').replace(/-/g, '')
      const seqResult = await client.query<{ seq: string }>(
        "SELECT nextval('public.bot_compras_codigo_seq')::TEXT AS seq",
      )
      const codigo = `CMP-${today}-${String(Number(seqResult.rows[0]?.seq || '1')).padStart(4, '0')}`

      const purchaseInsert = await client.query<{ nid: number }>(
        `INSERT INTO bot_compras
           (ccodigo, nproveedor_id, nalmacen_id, cproveedor, ctipo_comprobante, cdocumento,
            ctipo_pago, tfecha_vencimiento, ntotal, cnotas, nusuario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::DATE, $9, $10, $11)
         RETURNING nid`,
        [
          codigo, proveedorId, almacenId, proveedor, tipoComprobante, numeroDocumento,
          tipoPago,
          tipoPago === 'CREDITO' ? (fechaVencimientoFactura || null) : null,
          total, notas, user.id,
        ],
      )
      const compraId = purchaseInsert.rows[0]?.nid

      for (const item of validItems) {
        const productoId = Number(item.productoId || 0)
        const cantidad = Number(item.cantidad || 1)
        const precioUnit = Number(item.precioUnit || 0)
        const subtotal = cantidad * precioUnit
        const codigoLote = String(item.codigoLote || '').trim() || null
        const fechaVencimiento = String(item.fechaVencimiento || '').trim() || null
        const notasLote = String(item.notasLote || '').trim() || null

        await client.query(
          `INSERT INTO bot_compras_det (ncompra_id, nproducto_id, ncantidad, npreunit, nsubtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [compraId, productoId, cantidad, precioUnit, subtotal],
        )

        if (productoId > 0) {
          const stockPrevResult = await client.query<{ nstock: number }>(
            'SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
            [productoId],
          )
          const stockPrev = Number(stockPrevResult.rows[0]?.nstock ?? 0)

          await client.query(
            `UPDATE bot_productos
             SET nstock = nstock + $1, nprecompra = $2, tmodifi = NOW()
             WHERE nid = $3`,
            [cantidad, precioUnit, productoId],
          )

          // UPSERT bot_lotes (obligatorio si el producto requiere lote — el front ya lo valida)
          let loteId: number | null = null
          if (codigoLote) {
            const loteExistente = await client.query<{ nid: number }>(
              `SELECT nid FROM bot_lotes
               WHERE nproducto_id = $1 AND ccodigo_lote = $2 AND nalmacen_id = $3
               FOR UPDATE`,
              [productoId, codigoLote, almacenId],
            )

            if (loteExistente.rows.length > 0) {
              loteId = loteExistente.rows[0].nid
              await client.query(
                `UPDATE bot_lotes
                 SET ncantidad         = ncantidad + $1,
                     ncantidad_inicial = ncantidad_inicial + $1,
                     ncompra_id        = $2,
                     nprecio_compra    = $3,
                     tmodifi           = NOW()
                 WHERE nid = $4`,
                [cantidad, compraId, precioUnit, loteId],
              )
            } else {
              const insertedLote = await client.query<{ nid: number }>(
                `INSERT INTO bot_lotes
                 (nproducto_id, ncompra_id, ccodigo_lote, dfechavencimiento,
                  ncantidad, ncantidad_inicial, nprecio_compra, cestado, cnotas, nalmacen_id)
                 VALUES ($1, $2, $3, $4::DATE, $5, $5, $6, 'ACTIVO', $7, $8)
                 RETURNING nid`,
                [productoId, compraId, codigoLote, fechaVencimiento, cantidad, precioUnit, notasLote, almacenId || null],
              )
              loteId = insertedLote.rows[0]?.nid ?? null
            }
          }

          await client.query(
            `INSERT INTO bot_kardex
             (nproducto_id, nlote_id, ctipo, cref_tabla, nref_id, ncantidad,
              nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
             VALUES ($1, $2, 'COMPRA', 'bot_compras', $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              productoId,
              loteId,
              compraId,
              cantidad,
              stockPrev,
              stockPrev + cantidad,
              `Compra ${codigo}`,
              user.id,
              user.nombre,
              almacenId || null,
            ],
          )

          // Registrar movimiento de almacén
          if (almacenId > 0) {
            await client.query(
              `INSERT INTO bot_movimientos_almacen
               (nproducto_id, nlote_id, nalmacen_destino_id, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
               VALUES ($1, $2, $3, 'COMPRA', $4, $5, $6, $7)`,
              [productoId, loteId, almacenId, cantidad, `Compra ${codigo}`, user.id, user.nombre],
            )
          }
        }
      }

      // CXP o egreso de caja según tipoPago
      if (tipoPago === 'CREDITO' && total > 0) {
        await client.query(
          `INSERT INTO bot_cuentas_por_pagar
             (ncompra_id, nproveedor_id, nmonto_total, tfecha_emision, tfecha_vencimiento,
              cestado, cdocumento, cnotas, nusuario_id)
           VALUES ($1, $2, $3, CURRENT_DATE, $4::DATE, 'PENDIENTE', $5, $6, $7)
           ON CONFLICT (ncompra_id) DO NOTHING`,
          [
            compraId, proveedorId, total,
            fechaVencimientoFactura || null,
            numeroDocumento, notas || null, user.id,
          ],
        )
      } else if (tipoPago === 'CONTADO' && total > 0) {
        await client.query(
          `INSERT INTO bot_caja_movimientos
             (ncaja_id, ctipo, nmonto, cmetodo_pago, cref_tabla, nref_id, cdescripcion, nusuario_id, cusuario)
           VALUES ($1, 'EGRESO', $2, 'EFECTIVO', 'bot_compras', $3, $4, $5, $6)`,
          [cajaId, total, compraId, `Pago compra ${codigo} a ${proveedor}`, user.id, user.nombre],
        )
      }

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'COMPRA', 'bot_compras', $3, $4)`,
        [user.id, user.nombre, compraId, `Compra ${codigo} S/${total} de ${proveedor} -> ${almacenDetalle}`],
      )

      await client.query('COMMIT')
      return { ok: true, id: String(compraId), codigo, total }
    } catch (error) {
      await client.query('ROLLBACK')
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ((error as { code?: string }).code === '42703' ||
          (error as { code?: string }).code === '42P01')
      ) {
        const schemaError = buildSchemaErrorMessage(schemaStatus)
        request.log.error({ error, schemaStatus }, 'Purchase creation failed because of missing schema elements')
        return reply.code(503).send({
          error: 'PURCHASE_SCHEMA_OUTDATED',
          message: schemaError.message,
          details: schemaError.details,
        })
      }
      throw error
    } finally {
      client.release()
    }
  })
}
