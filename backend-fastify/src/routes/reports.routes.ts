import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

const PERMISSION_ERROR = 'No tienes permiso para realizar esta acción.'
const REPORT_READ_PERMISSIONS = ['reportes_ver', 'reportes_financieros']
const REPORT_FINANCIAL_PERMISSIONS = ['reportes_financieros']
const FINANCIAL_REPORT_TYPES = new Set(['utilidad-ventas', 'ganancias', 'perdidas'])

export default async function reportsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const query = request.query as Record<string, string | undefined>
    const tipo = String(query.tipo || '').trim()
    const requiredPermissions = FINANCIAL_REPORT_TYPES.has(tipo)
      ? REPORT_FINANCIAL_PERMISSIONS
      : REPORT_READ_PERMISSIONS
    if (!(await fastify.requireAnyPermission(request, reply, requiredPermissions, {
      errorMessage: PERMISSION_ERROR,
    }))) return

    if (tipo === 'vencimiento') {
      const dias = Number(query.dias || 90)
      const familia = String(query.familia || '').trim()
      const rotacion = String(query.rotacion || '').trim()
      const params: Array<string | number> = [dias]
      const filters = [
        `p.cestado = 'A'`,
        `l.cestado = 'ACTIVO'`,
        `l.ncantidad > 0`,
        `l.dfechavencimiento IS NOT NULL`,
        `l.dfechavencimiento <= CURRENT_DATE + ($1 * INTERVAL '1 day')`,
      ]

      if (familia) {
        params.push(`%${familia}%`)
        filters.push(`p.cfamilia ILIKE $${params.length}`)
      }
      if (rotacion) {
        params.push(rotacion)
        filters.push(`p.crotacion = $${params.length}`)
      }

      const result = await fastify.db.query(
        `SELECT p.nid AS producto_id,
                p.ccodigo,
                p.cnombre,
                p.ccategoria,
                p.cfamilia,
                p.crotacion,
                p.nstock,
                p.nstockmin,
                p.npreventa,
                p.cubicacion,
                p.cproveedor,
                l.nid AS lote_id,
                l.ccodigo_lote,
                l.ncantidad AS stock_lote,
                l.nprecio_compra::TEXT AS costo_lote,
                l.dfechavencimiento::TEXT AS tvencimien,
                l.dfechavencimiento::TEXT AS fecha_vencimiento_lote,
                (l.dfechavencimiento - CURRENT_DATE) AS dias_restantes,
                a.cnombre AS almacen_nombre,
                lo.cnombre AS local_nombre
         FROM bot_lotes l
         JOIN bot_productos p ON p.nid = l.nproducto_id
         LEFT JOIN bot_almacenes a ON a.nid = l.nalmacen_id
         LEFT JOIN bot_locales lo ON lo.nid = a.nlocal_id
         WHERE ${filters.join(' AND ')}
         ORDER BY l.dfechavencimiento ASC, p.cnombre ASC, l.ccodigo_lote ASC`,
        params,
      )

      return {
        tipo: 'vencimiento',
        filtros: { dias, familia, rotacion },
        total: result.rows.length,
        items: result.rows,
      }
    }

    if (tipo === 'faltantes') {
      const familia = String(query.familia || '').trim()
      const params: Array<string> = []
      let sql = `
        SELECT nid, ccodigo, cnombre, ccategoria, cfamilia, crotacion, nstock, nstockmin, npreventa, cubicacion, cproveedor
        FROM bot_productos
        WHERE cestado = 'A' AND nstock <= nstockmin
      `
      if (familia) {
        params.push(`%${familia}%`)
        sql += ' AND cfamilia ILIKE $1'
      }
      sql += ' ORDER BY (nstockmin - nstock) DESC'

      const result = await fastify.db.query(sql, params)
      const items = result.rows.map((row) => ({
        ...row,
        faltante: Number(row.nstockmin || 0) - Number(row.nstock || 0),
      }))
      return { tipo: 'faltantes', total: items.length, items }
    }

    if (tipo === 'rotacion') {
      const result = await fastify.db.query(
        `SELECT cfamilia, crotacion, COUNT(*) AS productos, SUM(nstock) AS stock_total,
                SUM(nstock * npreventa) AS valor_inventario
         FROM bot_productos
         WHERE cestado = 'A'
         GROUP BY cfamilia, crotacion
         ORDER BY cfamilia, crotacion`,
      )
      return { tipo: 'rotacion', items: result.rows }
    }

    if (tipo === 'utilidad-ventas') {
      const desde = String(query.desde || new Date().toISOString().slice(0, 8) + '01')
      const hasta = String(query.hasta || new Date().toISOString().slice(0, 10))

      if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
        return reply.code(400).send({ error: 'RANGO DE FECHAS INVALIDO' })
      }

      const result = await fastify.db.query<{
        venta_id: number
        venta_codigo: string
        venta_fecha: string
        cliente: string | null
        metodo_pago: string | null
        total_venta: string
        producto_id: number | null
        producto_codigo: string | null
        producto_nombre: string | null
        lote_id: number | null
        lote_codigo: string | null
        fecha_vencimiento: string | null
        cantidad: string
        precio_unitario: string
        ingreso_linea: string
        costo_unitario: string
        costo_linea: string
        utilidad_linea: string
        costo_fuente: string
        costo_incompleto: boolean
      }>(
        `WITH detalle_producto AS (
           SELECT nventa_id,
                  nproducto_id,
                  SUM(COALESCE(ncantidad, 0))::NUMERIC AS cantidad_detalle,
                  SUM(COALESCE(nsubtotal, 0))::NUMERIC AS ingreso_detalle,
                  CASE
                    WHEN SUM(COALESCE(ncantidad, 0)) = 0 THEN 0
                    ELSE SUM(COALESCE(nsubtotal, 0)) / SUM(COALESCE(ncantidad, 0))
                  END AS precio_promedio
           FROM bot_ventas_det
           WHERE nproducto_id IS NOT NULL
           GROUP BY nventa_id, nproducto_id
         ),
         kardex_lotes AS (
           SELECT k.nref_id AS venta_id,
                  k.nproducto_id,
                  k.nlote_id,
                  COALESCE(k.ccodigo_lote, l.ccodigo_lote) AS lote_codigo,
                  SUM(ABS(k.ncantidad))::NUMERIC AS cantidad
           FROM bot_kardex k
           LEFT JOIN bot_lotes l ON l.nid = k.nlote_id
           WHERE k.ctipo = 'VENTA'
             AND k.cref_tabla = 'bot_ventas'
             AND k.ncantidad < 0
           GROUP BY k.nref_id, k.nproducto_id, k.nlote_id, COALESCE(k.ccodigo_lote, l.ccodigo_lote)
         )
         SELECT v.nid AS venta_id,
                v.ccodigo AS venta_codigo,
                v.tcreado::TEXT AS venta_fecha,
                v.ccliente AS cliente,
                v.cmetpago AS metodo_pago,
                v.ntotal::TEXT AS total_venta,
                p.nid AS producto_id,
                p.ccodigo AS producto_codigo,
                p.cnombre AS producto_nombre,
                kl.nlote_id AS lote_id,
                kl.lote_codigo,
                l.dfechavencimiento::TEXT AS fecha_vencimiento,
                COALESCE(kl.cantidad, dp.cantidad_detalle)::TEXT AS cantidad,
                COALESCE(dp.precio_promedio, 0)::TEXT AS precio_unitario,
                (COALESCE(kl.cantidad, dp.cantidad_detalle) * COALESCE(dp.precio_promedio, 0))::TEXT AS ingreso_linea,
                CASE WHEN kl.nlote_id IS NULL THEN '0' ELSE COALESCE(l.nprecio_compra, 0)::TEXT END AS costo_unitario,
                CASE WHEN kl.nlote_id IS NULL THEN '0' ELSE (kl.cantidad * COALESCE(l.nprecio_compra, 0))::TEXT END AS costo_linea,
                (
                  (COALESCE(kl.cantidad, dp.cantidad_detalle) * COALESCE(dp.precio_promedio, 0))
                  - CASE WHEN kl.nlote_id IS NULL THEN 0 ELSE (kl.cantidad * COALESCE(l.nprecio_compra, 0)) END
                )::TEXT AS utilidad_linea,
                CASE WHEN kl.nlote_id IS NULL THEN 'SIN_LOTE' ELSE 'LOTE' END AS costo_fuente,
                (kl.nlote_id IS NULL) AS costo_incompleto
         FROM detalle_producto dp
         JOIN bot_ventas v ON v.nid = dp.nventa_id
         LEFT JOIN kardex_lotes kl ON kl.venta_id = dp.nventa_id AND kl.nproducto_id = dp.nproducto_id
         LEFT JOIN bot_productos p ON p.nid = dp.nproducto_id
         LEFT JOIN bot_lotes l ON l.nid = kl.nlote_id
         WHERE v.tcreado::DATE BETWEEN $1 AND $2
           AND v.cestado = 'A'
         ORDER BY v.tcreado DESC, v.nid DESC, p.cnombre ASC, l.dfechavencimiento ASC NULLS LAST`,
        [desde, hasta],
      )

      const ventas = new Map<string, {
        ventaId: string
        codigo: string
        fecha: string
        cliente: string
        metodoPago: string
        totalVenta: number
        ingresoReconstruido: number
        costoTotal: number
        utilidad: number
        margenPct: number
        lineas: Array<Record<string, unknown>>
      }>()
      const lineas = result.rows.map((row, index) => {
        const ingreso = Number(row.ingreso_linea || 0)
        const costo = Number(row.costo_linea || 0)
        const utilidad = Number(row.utilidad_linea || 0)
        const margenPct = ingreso > 0 ? (utilidad / ingreso) * 100 : 0
        const linea = {
          id: `${row.venta_id}-${row.producto_id ?? 'sin-producto'}-${row.lote_id ?? 'sin-lote'}-${index}`,
          ventaId: String(row.venta_id),
          ventaCodigo: row.venta_codigo,
          ventaFecha: row.venta_fecha,
          cliente: String(row.cliente || 'Consumidor final').trim() || 'Consumidor final',
          metodoPago: String(row.metodo_pago || '').trim(),
          totalVenta: Number(row.total_venta || 0),
          productoId: row.producto_id ? String(row.producto_id) : null,
          productoCodigo: row.producto_codigo,
          productoNombre: String(row.producto_nombre || '').trim(),
          loteId: row.lote_id ? String(row.lote_id) : null,
          loteCodigo: row.lote_codigo,
          fechaVencimiento: row.fecha_vencimiento,
          cantidad: Number(row.cantidad || 0),
          precioUnitario: Number(row.precio_unitario || 0),
          ingreso,
          costoUnitario: Number(row.costo_unitario || 0),
          costo,
          utilidad,
          margenPct,
          costoFuente: String(row.costo_fuente || (row.lote_id ? 'LOTE' : 'SIN_LOTE')),
          costoIncompleto: row.costo_incompleto,
        }

        const ventaKey = String(row.venta_id)
        const venta = ventas.get(ventaKey) ?? {
          ventaId: ventaKey,
          codigo: row.venta_codigo,
          fecha: row.venta_fecha,
          cliente: String(row.cliente || 'Consumidor final').trim() || 'Consumidor final',
          metodoPago: String(row.metodo_pago || '').trim(),
          totalVenta: Number(row.total_venta || 0),
          ingresoReconstruido: 0,
          costoTotal: 0,
          utilidad: 0,
          margenPct: 0,
          lineas: [],
        }
        venta.ingresoReconstruido += ingreso
        venta.costoTotal += costo
        venta.utilidad += utilidad
        venta.margenPct = venta.ingresoReconstruido > 0 ? (venta.utilidad / venta.ingresoReconstruido) * 100 : 0
        venta.lineas.push(linea)
        ventas.set(ventaKey, venta)

        return linea
      })

      const ingresoTotal = lineas.reduce((sum, row) => sum + Number(row.ingreso || 0), 0)
      const costoTotal = lineas.reduce((sum, row) => sum + Number(row.costo || 0), 0)
      const utilidadTotal = ingresoTotal - costoTotal

      return {
        tipo: 'utilidad-ventas',
        periodo: { desde, hasta },
        resumen: {
          ventasCantidad: ventas.size,
          lineasCantidad: lineas.length,
          ingresoTotal,
          costoTotal,
          utilidadTotal,
          margenPct: ingresoTotal > 0 ? (utilidadTotal / ingresoTotal) * 100 : 0,
          lineasSinCosto: lineas.filter((row) => row.costoFuente !== 'LOTE').length,
        },
        ventas: Array.from(ventas.values()),
        lineas,
      }
    }

    if (tipo === 'ganancias') {
      const desde = String(query.desde || new Date().toISOString().slice(0, 8) + '01')
      const hasta = String(query.hasta || new Date().toISOString().slice(0, 10))

      const [ventasResult, comprasResult, costoResult, porDiaResult, porMetodoResult] = await Promise.all([
        fastify.db.query<{ total_ventas: string; n_ventas: string }>(
          `SELECT COALESCE(SUM(ntotal), 0)::text AS total_ventas, COUNT(*)::text AS n_ventas
           FROM bot_ventas
           WHERE tcreado::DATE BETWEEN $1 AND $2 AND cestado = 'A'`,
          [desde, hasta],
        ),
        fastify.db.query<{ total_compras: string; n_compras: string }>(
          `SELECT COALESCE(SUM(ntotal), 0)::text AS total_compras, COUNT(*)::text AS n_compras
           FROM bot_compras
           WHERE tcreado::DATE BETWEEN $1 AND $2 AND cestado = 'A'`,
          [desde, hasta],
        ),
        fastify.db.query<{ costo_ventas: string }>(
          `SELECT COALESCE(SUM(ABS(k.ncantidad) * COALESCE(l.nprecio_compra, 0)), 0)::TEXT AS costo_ventas
           FROM bot_kardex k
           JOIN bot_ventas v ON v.nid = k.nref_id
           LEFT JOIN bot_lotes l ON l.nid = k.nlote_id
           WHERE k.ctipo = 'VENTA'
             AND k.cref_tabla = 'bot_ventas'
             AND v.tcreado::DATE BETWEEN $1 AND $2
             AND v.cestado = 'A'`,
          [desde, hasta],
        ),
        fastify.db.query(
          `SELECT tcreado::DATE::TEXT AS fecha, SUM(ntotal) AS total, COUNT(*) AS n
           FROM bot_ventas
           WHERE tcreado::DATE BETWEEN $1 AND $2 AND cestado = 'A'
           GROUP BY tcreado::DATE
           ORDER BY tcreado::DATE`,
          [desde, hasta],
        ),
        fastify.db.query(
          `SELECT cmetpago, SUM(ntotal) AS total, COUNT(*) AS n
           FROM bot_ventas
           WHERE tcreado::DATE BETWEEN $1 AND $2 AND cestado = 'A'
           GROUP BY cmetpago`,
          [desde, hasta],
        ),
      ])

      const totalVentas = Number(ventasResult.rows[0]?.total_ventas || 0)
      const totalCompras = Number(comprasResult.rows[0]?.total_compras || 0)
      const costoVentas = Number(costoResult.rows[0]?.costo_ventas || 0)

      return {
        tipo: 'ganancias',
        periodo: { desde, hasta },
        ventas: { total: totalVentas, cantidad: Number(ventasResult.rows[0]?.n_ventas || 0) },
        compras: { total: totalCompras, cantidad: Number(comprasResult.rows[0]?.n_compras || 0) },
        costoVentas,
        ganancia: totalVentas - costoVentas,
        gananciaBrutaFlujo: totalVentas - totalCompras,
        porDia: porDiaResult.rows,
        porMetodo: porMetodoResult.rows,
      }
    }

    if (tipo === 'perdidas') {
      const [vencidosResult, mermasResult] = await Promise.all([
        fastify.db.query(
          `SELECT nid, ccodigo, cnombre, cfamilia, nstock, npreventa, (nstock * npreventa) AS valor_perdida, tvencimien::TEXT
           FROM bot_productos
           WHERE cestado = 'A' AND tvencimien IS NOT NULL AND tvencimien < CURRENT_DATE
           ORDER BY tvencimien`,
        ),
        fastify.db.query(
          `SELECT t.ccodigo, t.cmotivo, t.tcreado::TEXT, d.ncantidad, p.cnombre, p.npreventa, (d.ncantidad * p.npreventa) AS valor
           FROM bot_transferencias t
           JOIN bot_transferencias_det d ON d.ntransf_id = t.nid
           JOIN bot_productos p ON p.nid = d.nproducto_id
           WHERE t.ctipo = 'Merma'
           ORDER BY t.tcreado DESC`,
        ),
      ])

      const totalVencidos = vencidosResult.rows.reduce((sum, row) => sum + Number(row.valor_perdida || 0), 0)
      const totalMermas = mermasResult.rows.reduce((sum, row) => sum + Number(row.valor || 0), 0)

      return {
        tipo: 'perdidas',
        vencidos: { total: totalVencidos, items: vencidosResult.rows },
        mermas: { total: totalMermas, items: mermasResult.rows },
        totalPerdida: totalVencidos + totalMermas,
      }
    }

    return reply.code(400).send({
      error: 'TIPO DE REPORTE NO VALIDO. Usar: vencimiento, faltantes, rotacion, ganancias, utilidad-ventas, perdidas',
    })
  })
}
