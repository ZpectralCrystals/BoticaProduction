import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
interface VentaItemInput {
  productoId?: number
  productoNombre?: string
  cantidad?: number
  cantidadUnidades?: number
  precioUnitario?: number
  total?: number
}

interface VentaInput {
  customer?: string
  customerId?: number | string
  patient?: string
  patientId?: number | string
  documentId?: string
  customerMode?: 'generico' | 'clinica' | 'paciente' | string
  paymentMethod?: string
  total?: number
  cashier?: string
  area?: string
  notes?: string
  clienteNombre?: string
  metodoPago?: string
  montoEfectivo?: number | string
  montoDigital?: number | string
  vuelto?: number | string
  metodoPagoSecundario?: string
  paymentMethodSecondary?: string
  observaciones?: string
  almacenId?: number
  items?: VentaItemInput[]
}

function moneyCents(value: number) {
  return Math.round(value * 100)
}

function buildAllowedSalePrices(product: {
  npreventa: string | number | null
  npreventa_2: string | number | null
  npreventa_3: string | number | null
}) {
  return [product.npreventa, product.npreventa_2, product.npreventa_3]
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
}

function normalizarMetodoPago(metodo: string | undefined) {
  const value = String(metodo || 'Efectivo').trim().toUpperCase()

  if (value === 'YAPE') return 'Yape'
  if (value === 'PLIN') return 'Plin'
  if (value === 'TARJETA') return 'Tarjeta'
  if (value === 'MIXTO') return 'Mixto'
  return 'Efectivo'
}

function normalizarMetodoPagoSecundario(metodo: string | undefined) {
  const value = String(metodo || 'Yape').trim().toUpperCase()

  if (value === 'PLIN') return 'Plin'
  if (value === 'TARJETA') return 'Tarjeta'
  if (value === 'OTRO') return 'Otro'
  return 'Yape'
}

function parseMoneyField(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') {
    return { ok: true as const, value: 0 }
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return { ok: false as const, error: `${field} inválido` }
  }
  if (parsed < 0) {
    return { ok: false as const, error: `${field} no puede ser negativo` }
  }
  return { ok: true as const, value: Math.round(parsed * 100) / 100 }
}

function extraerConcepto(notes: string, codigo: string) {
  const firstLine = notes
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine || `Venta ${codigo}`
}

export default async function salesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // GET /ventas - Listar ventas del día
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    try {
      const { rows } = await fastify.db.query<{
        nid: number
        ccodigo: string
        ccliente: string | null
        cmetpago: string | null
        carea: string | null
        ccaja: string | null
        ntotal: string
        cnotas: string | null
        cestado: string
        tcreado: string
        cantidad_items: string
      }>(`
        SELECT v.nid, v.ccodigo, v.ccliente, v.cmetpago, v.carea, v.ccaja,
               v.ntotal::TEXT, v.cnotas, v.cestado, v.tcreado::TEXT,
               COUNT(vd.nid)::TEXT AS cantidad_items
        FROM bot_ventas v
        LEFT JOIN bot_ventas_det vd ON vd.nventa_id = v.nid
        GROUP BY v.nid, v.ccodigo, v.ccliente, v.cmetpago, v.carea, v.ccaja, v.ntotal, v.cnotas, v.cestado, v.tcreado
        ORDER BY v.tcreado DESC
      `)
      
      return rows.map((row) => ({
        id: String(row.nid),
        codigo: row.ccodigo,
        concept: extraerConcepto(String(row.cnotas || ''), row.ccodigo),
        customer: String(row.ccliente || 'Consumidor final').trim() || 'Consumidor final',
        paymentMethod: normalizarMetodoPago(row.cmetpago ?? undefined),
        area: String(row.carea || 'Botica').trim() || 'Botica',
        cashier: String(row.ccaja || 'Caja principal').trim() || 'Caja principal',
        total: Number(row.ntotal || 0),
        notes: String(row.cnotas || ''),
        estado: String(row.cestado || 'A').trim(),
        at: row.tcreado,
        itemsCount: Number(row.cantidad_items || 0),
      }))
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ 
        success: false, 
        error: 'Error al obtener ventas' 
      })
    }
  })

  // POST /ventas - Crear venta con FEFO y bloqueo optimista
  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['ventas'], {
      errorMessage: 'No tiene permisos para registrar ventas',
    }))) {
      return
    }

    const body = request.body as VentaInput
    const customerMode = body.customerMode === 'clinica' || body.customerMode === 'paciente' ? 'clinica' : 'generico'
    const inputName = String(body.customer || body.patient || body.clienteNombre || 'Consumidor final').trim()
    const inputDocument = String(body.documentId || '').trim()
    const customer = inputName || 'Consumidor final'
    const paymentMethod = normalizarMetodoPago(body.paymentMethod || body.metodoPago)
    const total = Number(body.total || 0)
    const cashier = String(body.cashier || 'Caja principal').trim() || 'Caja principal'
    const area = String(body.area || 'Botica').trim() || 'Botica'
    const notes = String(body.notes || body.observaciones || '').trim()
    const items = Array.isArray(body.items) ? body.items : []

    if (!Number.isFinite(total) || total <= 0) {
      return reply.code(400).send({ 
        ok: false,
        error: 'TOTAL INVALIDO' 
      })
    }

    if (items.length === 0) {
      return reply.code(400).send({ ok: false, error: 'VENTA SIN DETALLE' })
    }

    const productIds = new Set<number>()
    let calculatedTotalCents = 0
    for (const item of items) {
      const cantidad = Number(item.cantidadUnidades ?? item.cantidad ?? 0)
      const precioUnitario = Number(item.precioUnitario ?? 0)
      const subtotalCalculadoCents = moneyCents(cantidad * precioUnitario)
      const subtotalDeclarado = item.total === undefined ? cantidad * precioUnitario : Number(item.total)

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return reply.code(400).send({ ok: false, error: 'CANTIDAD DE ITEM INVALIDA' })
      }
      if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) {
        return reply.code(400).send({ ok: false, error: 'PRECIO DE ITEM INVALIDO' })
      }
      if (!Number.isFinite(subtotalDeclarado) || moneyCents(subtotalDeclarado) !== subtotalCalculadoCents) {
        return reply.code(400).send({ ok: false, error: 'SUBTOTAL DE ITEM INVALIDO' })
      }

      if (item.productoId !== undefined && item.productoId !== null) {
        const productoId = Number(item.productoId)
        if (!Number.isInteger(productoId) || productoId <= 0) {
          return reply.code(400).send({ ok: false, error: 'PRODUCTO DE ITEM INVALIDO' })
        }
        if (productIds.has(productoId)) {
          return reply.code(400).send({ ok: false, error: 'PRODUCTO DUPLICADO EN DETALLE' })
        }
        productIds.add(productoId)
      } else if (!String(item.productoNombre || '').trim()) {
        return reply.code(400).send({ ok: false, error: 'DESCRIPCION DE SERVICIO OBLIGATORIA' })
      }

      calculatedTotalCents += subtotalCalculadoCents
    }

    if (moneyCents(total) !== calculatedTotalCents) {
      return reply.code(400).send({ ok: false, error: 'TOTAL NO COINCIDE CON DETALLE' })
    }

    const efectivoInput = parseMoneyField(body.montoEfectivo, 'montoEfectivo')
    if (!efectivoInput.ok) return reply.code(400).send({ ok: false, error: efectivoInput.error })
    const digitalInput = parseMoneyField(body.montoDigital, 'montoDigital')
    if (!digitalInput.ok) return reply.code(400).send({ ok: false, error: digitalInput.error })
    const vueltoInput = parseMoneyField(body.vuelto, 'vuelto')
    if (!vueltoInput.ok) return reply.code(400).send({ ok: false, error: vueltoInput.error })

    let montoEfectivo = 0
    let montoDigital = 0
    let vuelto = 0
    let metodoPagoSecundario: string | null = null

    if (paymentMethod === 'Mixto') {
      montoEfectivo = efectivoInput.value
      montoDigital = Math.max(0, Math.round((total - montoEfectivo) * 100) / 100)
      vuelto = Math.max(0, Math.round((montoEfectivo - total) * 100) / 100)
      metodoPagoSecundario = normalizarMetodoPagoSecundario(body.metodoPagoSecundario || body.paymentMethodSecondary)

      if (moneyCents(montoEfectivo + montoDigital) < moneyCents(total)) {
        return reply.code(400).send({ ok: false, error: 'PAGO MIXTO INSUFICIENTE' })
      }
    } else if (paymentMethod === 'Efectivo') {
      montoEfectivo = efectivoInput.value > 0 ? efectivoInput.value : total
      montoDigital = 0
      vuelto = Math.max(0, Math.round((montoEfectivo - total) * 100) / 100)
      if (moneyCents(montoEfectivo) < moneyCents(total)) {
        return reply.code(400).send({ ok: false, error: 'EFECTIVO INSUFICIENTE' })
      }
    } else {
      montoEfectivo = 0
      montoDigital = total
      vuelto = 0
    }

    // Resolve almacén origen
    let almacenId = Number(body.almacenId || 0)
    if (almacenId <= 0) {
      const defAlm = await fastify.db.query<{ nid: number }>(
        "SELECT nid FROM bot_almacenes WHERE bpermite_venta = TRUE AND cestado = 'A' ORDER BY nid LIMIT 1",
      )
      almacenId = defAlm.rows[0]?.nid || 0
    } else {
      const almCheck = await fastify.db.query<{ bpermite_venta: boolean }>(
        "SELECT bpermite_venta FROM bot_almacenes WHERE nid = $1 AND cestado = 'A'",
        [almacenId],
      )
      if (!almCheck.rows.length) {
        return reply.code(400).send({ ok: false, error: 'Almacén no encontrado' })
      }
      if (!almCheck.rows[0].bpermite_venta) {
        return reply.code(400).send({ ok: false, error: 'El almacén seleccionado no permite venta' })
      }
    }

    const user = request.authUser
    if (!user) {
      return reply.code(401).send({ 
        success: false,
        error: 'NO HA INICIADO SESION' 
      })
    }

    try {
      const client = await fastify.db.connect()

      try {
        await client.query('BEGIN')

        const cajaResult = await client.query<{ nid: number }>(
          `SELECT nid
           FROM bot_caja
           WHERE cestado = 'A' AND nusuario_id = $1
           ORDER BY tapertura DESC
           LIMIT 1
           FOR UPDATE`,
          [user.id],
        )

        if (!cajaResult.rows[0]) {
          await client.query('ROLLBACK')
          return reply.code(400).send({
            ok: false,
            error: 'NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas.',
          })
        }

        const subtotal = Math.round((total / 1.18) * 100) / 100
        const igv = Math.round((total - subtotal) * 100) / 100

        const todayResult = await client.query<{ today: string }>('SELECT CURRENT_DATE::TEXT AS today')
        const today = (todayResult.rows[0]?.today || '').replace(/-/g, '')
        const seqResult = await client.query<{ seq: string }>(
          "SELECT nextval('public.bot_ventas_codigo_seq')::TEXT AS seq",
        )
        const code = `VTA-${today}-${String(Number(seqResult.rows[0]?.seq || '1')).padStart(4, '0')}`

        let clinicalCustomerId: number | null = null
        let customerName = customer
        let customerDocument = inputDocument || null

        if (customerMode === 'clinica') {
          const requestedClinicalCustomerId = Number(body.customerId || body.patientId || 0)
          if (!requestedClinicalCustomerId) {
            await client.query('ROLLBACK')
            return reply.code(400).send({
              ok: false,
              error: 'CLIENTE DE CLINICA REQUERIDO',
            })
          }

          const patientResult = await client.query<{
            nid: number
            cnombre: string
            cnrodni: string
          }>(
            `SELECT nid, cnombre, cnrodni
             FROM bot_pacientes
             WHERE nid = $1
               AND cestado = 'A'
               AND COALESCE(cesgenerico, 'N') = 'N'
             LIMIT 1`,
            [requestedClinicalCustomerId],
          )

          const patientRow = patientResult.rows[0]
          if (!patientRow) {
            await client.query('ROLLBACK')
            return reply.code(400).send({
              ok: false,
              error: 'CLIENTE DE CLINICA NO ENCONTRADO',
            })
          }

          clinicalCustomerId = patientRow.nid
          customerName = patientRow.cnombre.trim()
          customerDocument = patientRow.cnrodni.trim()
        } else {
          customerName = customer || 'Consumidor final'
          customerDocument = inputDocument || (customerName === 'Consumidor final' ? '99999999' : null)
        }

        const saleInsert = await client.query<{ nid: number }>(
          `INSERT INTO bot_ventas
           (ccodigo, ncliente_clinico_id, cnrodni_cli, ccliente, cmetpago, carea, ccaja,
            nsubtotal, nigv, ntotal, nmonto_efectivo, nmonto_digital, nvuelto,
            cmetodo_pago_secundario, cnotas, cestado, nusuario_id, nalmacen_id)
           VALUES (
             $1,
             COALESCE(
               $2,
               (SELECT nid FROM bot_pacientes WHERE cnrodni = '00000000' AND cestado = 'A' ORDER BY nid LIMIT 1)
             ),
             $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'A', $16, $17
           )
           RETURNING nid`,
          [
            code,
            clinicalCustomerId,
            customerDocument,
            customerName,
            paymentMethod,
            area,
            cashier,
            subtotal,
            igv,
            total,
            montoEfectivo,
            montoDigital,
            vuelto,
            metodoPagoSecundario,
            notes,
            user.id,
            almacenId || null,
          ],
        )

        const saleId = saleInsert.rows[0].nid

        for (const item of items) {
          const cantidad = Number(item.cantidadUnidades ?? item.cantidad)
          const precioUnitario = Number(item.precioUnitario)
          const subtotalItem = Math.round(cantidad * precioUnitario * 100) / 100
          const nombreProducto = String(item.productoNombre || 'Producto').trim()

          if (!item.productoId) {
            await client.query(
              `INSERT INTO bot_ventas_det
               (nventa_id, nproducto_id, ncantidad, npreunit, nsubtotal, ctipo, cdescripcion)
               VALUES ($1, NULL, $2, $3, $4, 'Servicio', $5)`,
              [saleId, cantidad, precioUnitario, subtotalItem, nombreProducto],
            )
            continue
          }

          const productoId = item.productoId

          // ── 1. Bloqueo pesimista del producto ──────────────────
          const stockResult = await client.query<{
            cnombre: string
            nstock: number
            tvencimien: string | null
            npreventa: string | number | null
            npreventa_2: string | number | null
            npreventa_3: string | number | null
            lrequiere_lote: boolean | null
          }>(
            `SELECT cnombre, nstock, tvencimien::TEXT, npreventa, npreventa_2, npreventa_3,
                    COALESCE(lrequiere_lote, TRUE) AS lrequiere_lote
             FROM bot_productos
             WHERE nid = $1 AND cestado = 'A'
             FOR UPDATE`,
            [productoId],
          )
          const prod = stockResult.rows[0]
          if (!prod) {
            await client.query('ROLLBACK')
            return reply.code(400).send({
              ok: false,
              error: `Producto ID ${productoId} no encontrado o inactivo`,
            })
          }
          if (prod.nstock < cantidad) {
            await client.query('ROLLBACK')
            return reply.code(400).send({
              ok: false,
              error: `STOCK INSUFICIENTE: ${prod.cnombre.trim()} tiene ${prod.nstock} unidad(es), se requieren ${cantidad}`,
            })
          }
          const preciosPermitidos = buildAllowedSalePrices(prod)
          if (preciosPermitidos.length === 0) {
            await client.query('ROLLBACK')
            return reply.code(400).send({
              ok: false,
              error: `PRODUCTO SIN PRECIO DE VENTA CONFIGURADO: ${prod.cnombre.trim()}`,
            })
          }
          if (precioUnitario <= 0 || !preciosPermitidos.some((precio) => moneyCents(precio) === moneyCents(precioUnitario))) {
            await client.query('ROLLBACK')
            return reply.code(400).send({
              ok: false,
              error: `PRECIO DE VENTA INVALIDO PARA ${prod.cnombre.trim()}`,
            })
          }
          const stockAnteriorItem = prod.nstock

          // ── 2. FEFO: buscar y bloquear lotes vigentes (filtrado por almacén) ──
          const lotesResult = await client.query<{
            nid: number
            ccodigo_lote: string | null
            dfechavencimiento: string
            ncantidad: number
          }>(
            `SELECT nid, ccodigo_lote, dfechavencimiento::TEXT, ncantidad
             FROM bot_lotes
             WHERE nproducto_id = $1
               AND cestado = 'ACTIVO'
               AND ncantidad > 0
               AND dfechavencimiento >= CURRENT_DATE
               AND ($2::INT IS NULL OR nalmacen_id = $2)
             ORDER BY dfechavencimiento ASC, tcreado ASC
             FOR UPDATE`,
            [productoId, almacenId || null],
          )

          const tieneLottes = lotesResult.rows.length > 0
          const requiereLote = prod.lrequiere_lote !== false

          type LoteConsumo = { loteId: number; codigoLote: string; consumir: number }
          const lotesPorConsumir: LoteConsumo[] = []

          if (tieneLottes) {
            const totalEnLotes = lotesResult.rows.reduce((s, l) => s + Number(l.ncantidad), 0)
            if (totalEnLotes < cantidad) {
              await client.query('ROLLBACK')
              return reply.code(400).send({
                ok: false,
                error: `STOCK EN LOTES INSUFICIENTE: ${prod.cnombre.trim()} tiene ${totalEnLotes} unidad(es) en lotes vigentes, se requieren ${cantidad}`,
              })
            }
            let restante = cantidad
            for (const lote of lotesResult.rows) {
              if (restante <= 0) break
              const consumir = Math.min(Number(lote.ncantidad), restante)
              restante -= consumir
              lotesPorConsumir.push({
                loteId: lote.nid,
                codigoLote: lote.ccodigo_lote || 'SIN-LOTE',
                consumir,
              })
            }
          } else {
            if (requiereLote) {
              await client.query('ROLLBACK')
              return reply.code(400).send({
                ok: false,
                error: `NO HAY LOTES VIGENTES DISPONIBLES: ${prod.cnombre.trim()}`,
              })
            }
            // Sin lotes: validar vencimiento a nivel de producto
            if (prod.tvencimien && new Date(prod.tvencimien) < new Date()) {
              await client.query('ROLLBACK')
              return reply.code(400).send({
                ok: false,
                error: `PRODUCTO VENCIDO: ${prod.cnombre.trim()} venció el ${prod.tvencimien}`,
              })
            }
          }

          // ── 3. INSERT detalle de venta (lote primario si aplica) ─
          const primeroLote = lotesPorConsumir[0]
          await client.query(
            `INSERT INTO bot_ventas_det
             (nventa_id, nproducto_id, ncantidad, npreunit, nsubtotal,
              ctipo, cdescripcion, nlote_id, clote_codigo)
             VALUES ($1, $2, $3, $4, $5, 'Producto', $6, $7, $8)`,
            [
              saleId, productoId, cantidad, precioUnitario, subtotalItem,
              nombreProducto,
              primeroLote?.loteId ?? null,
              primeroLote?.codigoLote ?? null,
            ],
          )

          // ── 4. Descontar bot_productos.nstock ───────────────────
          await client.query(
            'UPDATE bot_productos SET nstock = nstock - $1, tmodifi = NOW() WHERE nid = $2',
            [cantidad, productoId],
          )

          // ── 5a. Con lotes FEFO: descontar cada lote + kardex por lote
          if (tieneLottes && lotesPorConsumir.length > 0) {
            let stockProductoActual = stockAnteriorItem
            for (const lc of lotesPorConsumir) {
              const stockProductoNuevo = stockProductoActual - lc.consumir
              await client.query(
                `UPDATE bot_lotes
                 SET ncantidad = ncantidad - $1,
                     cestado   = CASE WHEN ncantidad - $1 <= 0 THEN 'AGOTADO' ELSE 'ACTIVO' END,
                     tmodifi   = NOW()
                 WHERE nid = $2`,
                [lc.consumir, lc.loteId],
              )
              await client.query(
                `INSERT INTO bot_kardex
                 (nproducto_id, nlote_id, ccodigo_lote, ctipo, cref_tabla, nref_id,
                  ncantidad, nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
                 VALUES ($1, $2, $3, 'VENTA', 'bot_ventas', $4,
                         $5, $6, $7, $8, $9, $10, $11)`,
                [
                  productoId, lc.loteId, lc.codigoLote, saleId,
                  -lc.consumir,
                  stockProductoActual,
                  stockProductoNuevo,
                  `${nombreProducto} [Lote ${lc.codigoLote}]`,
                  user.id, user.nombre,
                  almacenId || null,
                ],
              )
              stockProductoActual = stockProductoNuevo
            }
          } else {
            // ── 5b. Sin lotes: kardex a nivel producto (compatible) ─
            await client.query(
              `INSERT INTO bot_kardex
               (nproducto_id, ctipo, cref_tabla, nref_id, ncantidad,
                nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
               VALUES ($1, 'VENTA', 'bot_ventas', $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                productoId, saleId, -cantidad,
                stockAnteriorItem, stockAnteriorItem - cantidad,
                nombreProducto, user.id, user.nombre,
                almacenId || null,
              ],
            )
          }

          // ── 6. Registrar movimiento de almacén ────────────────
          if (almacenId > 0) {
            await client.query(
              `INSERT INTO bot_movimientos_almacen
               (nproducto_id, nlote_id, nalmacen_origen_id, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
               VALUES ($1, $2, $3, 'VENTA', $4, $5, $6, $7)`,
              [
                productoId,
                lotesPorConsumir[0]?.loteId ?? null,
                almacenId,
                cantidad,
                `Venta ${code}`,
                user.id, user.nombre,
              ],
            )
          }
        }

        await client.query(
          `INSERT INTO bot_auditoria
           (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
           VALUES ($1, $2, 'VENTA', 'bot_ventas', $3, $4)`,
          [user.id, user.nombre, saleId, `Venta ${code} por S/${total.toFixed(2)}`],
        )

        await client.query('COMMIT')

        return { ok: true, id: String(saleId), codigo: code }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({
        ok: false,
        error: error.message || 'Error interno al procesar la venta'
      })
    }
  })

  // PATCH /ventas/:id/anular — Anular venta y revertir stock
  fastify.patch('/:id/anular', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['ventas'], {
      errorMessage: 'No tiene permisos para anular ventas',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ ok: false, error: 'NO HA INICIADO SESION' })

    if (!user.admin && !user.super) {
      return reply.code(403).send({ ok: false, error: 'Solo administradores pueden anular ventas' })
    }

    const { id } = request.params as { id: string }
    const body = (request.body ?? {}) as { motivo?: string }
    const motivo = String(body.motivo || '').trim() || 'Sin motivo indicado'
    const saleId = Number(id)

    if (!saleId || saleId <= 0) {
      return reply.code(400).send({ ok: false, error: 'ID de venta inválido' })
    }

    try {
      const client = await fastify.db.connect()
      try {
        await client.query('BEGIN')

        const ventaResult = await client.query<{ nid: number; ccodigo: string; cestado: string; nalmacen_id: number | null }>(
          `SELECT nid, ccodigo, cestado, nalmacen_id FROM bot_ventas WHERE nid = $1 FOR UPDATE`,
          [saleId],
        )
        const venta = ventaResult.rows[0]

        if (!venta) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ ok: false, error: 'Venta no encontrada' })
        }
        if (venta.cestado === 'C') {
          await client.query('ROLLBACK')
          return reply.code(409).send({ ok: false, error: `La venta ${venta.ccodigo} ya fue anulada` })
        }

        const detalleResult = await client.query<{
          nproducto_id: number | null
          ncantidad: number
          cdescripcion: string
        }>(
          `SELECT nproducto_id, ncantidad, cdescripcion FROM bot_ventas_det WHERE nventa_id = $1`,
          [saleId],
        )

        // Lotes FEFO consumidos en esta venta (puede ser multi-lote por ítem)
        const lotesResult = await client.query<{
          nlote_id: number
          ncantidad_abs: number
          ccodigo_lote: string
          nproducto_id: number
        }>(
          `SELECT nlote_id, ABS(ncantidad)::INT AS ncantidad_abs, ccodigo_lote, nproducto_id
           FROM bot_kardex
           WHERE cref_tabla = 'bot_ventas'
             AND nref_id    = $1
             AND ctipo      = 'VENTA'
             AND nlote_id IS NOT NULL
           ORDER BY nid ASC`,
          [saleId],
        )

        await client.query(`UPDATE bot_ventas SET cestado = 'C' WHERE nid = $1`, [saleId])

        const stockInicialPorProducto = new Map<number, number>()

        // ── Revertir stock de bot_productos ──────────────────────────────
        for (const det of detalleResult.rows) {
          if (!det.nproducto_id) continue
          const cantidad = Number(det.ncantidad || 0)
          if (cantidad <= 0) continue

          const stockResult = await client.query<{ nstock: number }>(
            'SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
            [det.nproducto_id],
          )
          if (!stockResult.rows[0]) {
            throw new Error(`Producto ID ${det.nproducto_id} no encontrado al anular venta`)
          }
          const stockActual = Number(stockResult.rows[0].nstock)
          if (!stockInicialPorProducto.has(det.nproducto_id)) {
            stockInicialPorProducto.set(det.nproducto_id, stockActual)
          }

          await client.query(
            'UPDATE bot_productos SET nstock = nstock + $1, tmodifi = NOW() WHERE nid = $2',
            [cantidad, det.nproducto_id],
          )

          // Kardex sin lote: solo si no hay movimientos FEFO para este producto en esta venta
          const tieneLoteMovimientos = lotesResult.rows.some(
            (l) => l.nproducto_id === det.nproducto_id,
          )
          if (!tieneLoteMovimientos) {
            await client.query(
              `INSERT INTO bot_kardex
               (nproducto_id, ctipo, cref_tabla, nref_id, ncantidad,
                nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
               VALUES ($1, 'ANULACION_VENTA', 'bot_ventas', $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                det.nproducto_id,
                saleId,
                cantidad,
                stockActual,
                stockActual + cantidad,
                `Anulación ${venta.ccodigo}: ${motivo}`,
                user.id,
                user.nombre,
                venta.nalmacen_id,
              ],
            )
          }
        }

        // ── Revertir lotes FEFO + kardex por lote ────────────────────────
        for (const lote of lotesResult.rows) {
          const loteResult = await client.query<{ ncantidad: number }>(
            'SELECT ncantidad FROM bot_lotes WHERE nid = $1 FOR UPDATE',
            [lote.nlote_id],
          )
          const cantidadLoteActual = Number(loteResult.rows[0]?.ncantidad ?? 0)
          const cantidadLoteNueva = cantidadLoteActual + lote.ncantidad_abs

          await client.query(
            `UPDATE bot_lotes
             SET ncantidad = $1,
                 cestado   = 'ACTIVO',
                 tmodifi   = NOW()
             WHERE nid = $2`,
            [cantidadLoteNueva, lote.nlote_id],
          )

          const stockAnteriorProducto = stockInicialPorProducto.get(lote.nproducto_id)
          if (stockAnteriorProducto === undefined) {
            throw new Error(`Stock inicial no encontrado para producto ID ${lote.nproducto_id}`)
          }
          const stockNuevoProducto = stockAnteriorProducto + lote.ncantidad_abs
          stockInicialPorProducto.set(lote.nproducto_id, stockNuevoProducto)

          await client.query(
            `INSERT INTO bot_kardex
             (nproducto_id, nlote_id, ccodigo_lote, ctipo, cref_tabla, nref_id,
              ncantidad, nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
             VALUES ($1, $2, $3, 'ANULACION_VENTA', 'bot_ventas', $4,
                     $5, $6, $7, $8, $9, $10, $11)`,
            [
              lote.nproducto_id,
              lote.nlote_id,
              lote.ccodigo_lote,
              saleId,
              lote.ncantidad_abs,
              stockAnteriorProducto,
              stockNuevoProducto,
              `Anulación ${venta.ccodigo} [Lote ${lote.ccodigo_lote}]: ${motivo}`,
              user.id,
              user.nombre,
              venta.nalmacen_id,
            ],
          )
        }

        // ── Revertir movimientos de almacén ─────────────────────────────
        if (venta.nalmacen_id) {
          for (const det of detalleResult.rows) {
            if (!det.nproducto_id) continue
            const cantidad = Number(det.ncantidad || 0)
            if (cantidad <= 0) continue
            await client.query(
              `INSERT INTO bot_movimientos_almacen
               (nproducto_id, nalmacen_destino_id, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
               VALUES ($1, $2, 'DEVOLUCION_CLIENTE', $3, $4, $5, $6)`,
              [
                det.nproducto_id,
                venta.nalmacen_id,
                cantidad,
                `Anulación ${venta.ccodigo}: ${motivo}`,
                user.id,
                user.nombre,
              ],
            )
          }
        }

        await client.query(
          `INSERT INTO bot_auditoria
           (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
           VALUES ($1, $2, 'ANULACION', 'bot_ventas', $3, $4)`,
          [user.id, user.nombre, saleId, `Venta ${venta.ccodigo} anulada. Motivo: ${motivo}`],
        )

        await client.query('COMMIT')
        return { ok: true, codigo: venta.ccodigo, message: `Venta ${venta.ccodigo} anulada correctamente` }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error: any) {
      fastify.log.error(error)
      return reply.code(500).send({ ok: false, error: error.message || 'Error al anular la venta' })
    }
  })

  // GET /ventas/:id - Obtener venta con detalles de lotes
  fastify.get('/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const { rows: ventaRows } = await fastify.db.query(
        `SELECT v.*, u.cnombre as cajero_nombre
         FROM bot_ventas v
         LEFT JOIN bot_usuarios u ON v.nusuario_id = u.nid
         WHERE v.nid = $1`,
        [id]
      )

      if (ventaRows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Venta no encontrada'
        })
      }

      const { rows: detalleRows } = await fastify.db.query(
        `SELECT vd.*, 
                p.cnombre as producto_nombre
         FROM bot_ventas_det vd
         JOIN bot_productos p ON vd.nproducto_id = p.nid
         WHERE vd.nventa_id = $1`,
        [id]
      )

      return {
        success: true,
        data: {
          ...ventaRows[0],
          detalles: detalleRows
        }
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({
        success: false,
        error: 'Error al obtener la venta'
      })
    }
  })
}
