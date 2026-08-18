import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function dashboardRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const todayResult = await fastify.db.query<{ today: string }>('SELECT CURRENT_DATE::TEXT AS today')
    const today = todayResult.rows[0]?.today ?? new Date().toISOString().slice(0, 10)

    const [
      totalProductsResult,
      lowStockResult,
      expiringSoonResult,
      todaySalesResult,
      cashBreakdownResult,
      appointmentsResult,
      totalPatientsResult,
      doctorsResult,
      recentSalesResult,
      priorityProductsResult,
      lowStockAlertsResult,
      expiringAlertsResult,
    ] = await Promise.all([
      fastify.db.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM bot_productos WHERE cestado = 'A'",
      ),
      fastify.db.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM bot_productos WHERE cestado = 'A' AND nstock <= nstockmin",
      ),
      fastify.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM bot_productos
         WHERE cestado = 'A'
           AND tvencimien IS NOT NULL
           AND tvencimien <= CURRENT_DATE + INTERVAL '45 days'`,
      ),
      fastify.db.query<{ count: string; total: string }>(
        `SELECT COUNT(*)::text AS count, COALESCE(SUM(ntotal), 0)::text AS total
         FROM bot_ventas
         WHERE tcreado::DATE = $1`,
        [today],
      ),
      fastify.db.query<{ cmetpago: string | null; total: string }>(
        `SELECT cmetpago, COALESCE(SUM(ntotal), 0)::text AS total
         FROM bot_ventas
         WHERE tcreado::DATE = $1
         GROUP BY cmetpago`,
        [today],
      ),
      fastify.db.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM bot_citas WHERE tinicio::DATE = $1',
        [today],
      ),
      fastify.db.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM bot_pacientes WHERE cestado = 'A' AND COALESCE(cesgenerico, 'N') = 'N'",
      ),
      fastify.db.query<{ count: string }>(
        'SELECT COUNT(DISTINCT cdoctor)::text AS count FROM bot_citas',
      ),
      fastify.db.query<{
        nid: number
        ccliente: string
        cmetpago: string
        ntotal: string
        cnotas: string | null
        tcreado: string
      }>(
        `SELECT nid, ccliente, cmetpago, ntotal, cnotas, tcreado::TEXT
         FROM bot_ventas
         ORDER BY tcreado DESC
         LIMIT 4`,
      ),
      fastify.db.query<{
        nid: number
        cnombre: string
        cfamilia: string | null
        nstock: number
        nstockmin: number
        tvencimien: string | null
      }>(
        `SELECT nid, cnombre, cfamilia, nstock, nstockmin, tvencimien::TEXT
         FROM bot_productos
         WHERE cestado = 'A'
         ORDER BY nstock ASC
         LIMIT 4`,
      ),
      fastify.db.query<{
        cnombre: string
        nstock: number
        nstockmin: number
        cubicacion: string | null
      }>(
        `SELECT cnombre, nstock, nstockmin, cubicacion
         FROM bot_productos
         WHERE cestado = 'A' AND nstock <= nstockmin
         ORDER BY nstock ASC
         LIMIT 2`,
      ),
      fastify.db.query<{
        cnombre: string
        tvencimien: string
      }>(
        `SELECT cnombre, tvencimien::TEXT
         FROM bot_productos
         WHERE cestado = 'A'
           AND tvencimien IS NOT NULL
           AND tvencimien <= CURRENT_DATE + INTERVAL '45 days'
         ORDER BY tvencimien ASC
         LIMIT 2`,
      ),
    ])

    const cash = { Yape: 0, Efectivo: 0, Mixto: 0 }
    for (const row of cashBreakdownResult.rows) {
      const key = String(row.cmetpago || '').trim() as keyof typeof cash
      if (key in cash) cash[key] = Number(row.total || 0)
    }

    const alerts = [
      ...lowStockAlertsResult.rows.map((row) => ({
        id: `low-${row.cnombre.trim()}`,
        title: `${row.cnombre.trim()} esta bajo minimo`,
        detail: `${Number(row.nstock || 0)} unidades vs minimo ${Number(row.nstockmin || 0)} en ${String(row.cubicacion || '').trim()}.`,
        tone: 'warning',
        tag: 'Stock',
      })),
      ...expiringAlertsResult.rows.map((row) => {
        const expiresAt = row.tvencimien
        const days =
          expiresAt === null
            ? 0
            : Math.max(
                0,
                Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
              )
        return {
          id: `exp-${row.cnombre.trim()}`,
          title: `${row.cnombre.trim()} requiere revision`,
          detail: `Vence en ${days} dias. Revisar rotacion y compras.`,
          tone: 'danger',
          tag: 'Vencimiento',
        }
      }),
    ]

    return {
      metrics: {
        totalProducts: Number(totalProductsResult.rows[0]?.count || 0),
        lowStock: Number(lowStockResult.rows[0]?.count || 0),
        expiringSoon: Number(expiringSoonResult.rows[0]?.count || 0),
        todayRevenue: Number(todaySalesResult.rows[0]?.total || 0),
        todaySalesCount: Number(todaySalesResult.rows[0]?.count || 0),
        todayAppointments: Number(appointmentsResult.rows[0]?.count || 0),
        totalPatients: Number(totalPatientsResult.rows[0]?.count || 0),
        doctors: Number(doctorsResult.rows[0]?.count || 0),
      },
      cashBreakdown: {
        yape: cash.Yape,
        efectivo: cash.Efectivo,
        mixto: cash.Mixto,
      },
      recentSales: recentSalesResult.rows.map((row) => ({
        id: String(row.nid),
        concept: String(row.cnotas || '').trim(),
        customer: row.ccliente.trim(),
        paymentMethod: row.cmetpago.trim(),
        total: Number(row.ntotal || 0),
        at: row.tcreado,
      })),
      priorityProducts: priorityProductsResult.rows.map((row) => ({
        id: String(row.nid),
        name: row.cnombre.trim(),
        family: String(row.cfamilia || '').trim(),
        stock: Number(row.nstock || 0),
        minStock: Number(row.nstockmin || 0),
        expiresAt: row.tvencimien,
      })),
      alerts,
    }
  })
}
