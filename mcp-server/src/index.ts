#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import pg from 'pg'

const { Pool } = pg

// ── DB Connection ──
const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  database: process.env.DB_NAME ?? 'botica_db',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  user: process.env.DB_USER ?? 'gustavogalvez',
  password: process.env.DB_PASS ?? '',
})

async function query(sql: string, params?: unknown[]) {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result
  } finally {
    client.release()
  }
}

// ── MCP Server ──
const server = new McpServer({
  name: 'botica-el-pueblo',
  version: '1.0.0',
})

// ═══════════════════════════════════════════
// RESOURCES - Datos estáticos / esquema
// ═══════════════════════════════════════════

server.resource('schema', 'botica://schema', async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: 'text/plain',
      text: `Botica El Pueblo - Esquema de BD PostgreSQL

Tablas principales:
- bot_usuarios: nid, cnrodni(8), cnombre, cclave(bcrypt), crol(etiqueta libre), cestado(A|I), lsuper(bool), ladmin(bool)
- bot_permisos: nid, nusuario_id, cseccion (UNIQUE por usuario+seccion)
  Secciones: dashboard, inventario, ventas, caja, compras, pacientes, procedimientos, medicos, reportes, transferencias, alquileres, deudores, inventario-var, auditoria, usuarios
- bot_productos: nid, ccodigo, cnombre, cgenerico, ccategoria, cfamilia, cpresenta, claborat, nprecompra, npreventa, nstock, nstockmin, cubicacion, cproveedor, crotacion(Alta|Media|Baja), tvencimien, creceta(S|N), cestado
- bot_ventas: nid, ccodigo, cnrodni_cli, ccliente, cmetpago(Efectivo|Yape|Mixto), carea, ccaja, nsubtotal, nigv, ntotal, cnotas, cestado(A|F|C), nusuario_id, tcreado
- bot_ventas_det: nid, nventa_id, nproducto_id, ncantidad, npreunit, nsubtotal
- bot_pacientes: nid, cnombre, cnrodni, ctelefono, nedad, cnotas, cestado, tultvisita
- bot_citas: nid, npaciente_id, cpaciente, cdoctor, cespeciali, csala, tinicio, cestado(Confirmada|En espera|Atendida)
- bot_caja: nid, ccaja, napertura, ncierre, nusuario_id, cestado(A|C), tapertura, tcierre
- bot_proveedores: nid, cruc, cnombre, ccontacto, ctelefono, cemail, cnotas, cestado
- bot_compras: nid, ccodigo, nproveedor_id, cproveedor, cdocumento, ntotal, cestado, nusuario_id
- bot_compras_det: nid, ncompra_id, nproducto_id, ncantidad, npreunit, nsubtotal
- bot_medicos: nid, cnombre, ccmp, cespeciali, ctelefono, cemail, cnotas, cestado
- bot_servicios: nid, cnombre, ccategoria, nprecio, cdescripcion, cestado
- bot_historial: nid, npaciente_id, nmedico_id, cdoctor, cfecha, cdiagnostico, ctratamiento, cobservacion, csignos
- bot_recetas: nid, npaciente_id, nmedico_id, ccodigo, tcreado + bot_recetas_det
- bot_transferencias: nid, ccodigo, ctipo, corigen, cdestino, cmotivo, cestado, nusuario_id + bot_transferencias_det
- bot_inventario_var: nid, cnombre, ccategoria, cdescripcion, ncantidad, nvalor, cubicacion, cestado
- bot_alquileres: nid, cconcepto, carrendatario, cdni, ctelefono, nperiodo_monto, cperiodo, finicio, ffin, cestado
- bot_deudores: nid, cnombre, cdni, ctelefono, cconcepto, nmonto, nabonado, cestado(P|A|C), ffecha
- bot_auditoria: nid, nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle, tcreado

Permisos: lsuper=superusuario (acceso total, no eliminable), ladmin=puede gestionar usuarios. Usuarios nunca se eliminan, solo se desactivan.`,
    },
  ],
}))

// ═══════════════════════════════════════════
// TOOLS - Operaciones del negocio
// ═══════════════════════════════════════════

// ── Consulta SQL libre (solo lectura) ──
server.tool(
  'consulta_sql',
  'Ejecutar una consulta SQL de solo lectura (SELECT) sobre la base de datos botica_db',
  { sql: z.string().describe('Consulta SQL SELECT a ejecutar') },
  async ({ sql: sqlText }) => {
    const trimmed = sqlText.trim().toUpperCase()
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
      return { content: [{ type: 'text', text: 'Error: Solo se permiten consultas SELECT o WITH (solo lectura).' }] }
    }
    try {
      const result = await query(sqlText)
      const rows = result.rows
      if (rows.length === 0) {
        return { content: [{ type: 'text', text: 'Consulta ejecutada. Sin resultados.' }] }
      }
      return {
        content: [
          {
            type: 'text',
            text: `${rows.length} fila(s) encontrada(s):\n\n${JSON.stringify(rows, null, 2)}`,
          },
        ],
      }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error SQL: ${(err as Error).message}` }] }
    }
  },
)

// ── Dashboard ──
server.tool(
  'dashboard',
  'Obtener métricas del dia: ventas, stock, pacientes, citas, alertas',
  {},
  async () => {
    try {
      const [prods, low, exp, sales, pts, citas] = await Promise.all([
        query("SELECT COUNT(*) AS n FROM bot_productos WHERE cestado='A'"),
        query("SELECT COUNT(*) AS n FROM bot_productos WHERE cestado='A' AND nstock <= nstockmin"),
        query("SELECT COUNT(*) AS n FROM bot_productos WHERE cestado='A' AND tvencimien IS NOT NULL AND tvencimien <= CURRENT_DATE + INTERVAL '45 days'"),
        query("SELECT COUNT(*) AS n, COALESCE(SUM(ntotal),0) AS total FROM bot_ventas WHERE tcreado::DATE = CURRENT_DATE"),
        query("SELECT COUNT(*) AS n FROM bot_pacientes WHERE cestado='A'"),
        query("SELECT COUNT(*) AS n FROM bot_citas WHERE tinicio::DATE = CURRENT_DATE"),
      ])

      const text = `📊 Dashboard Botica El Pueblo (${new Date().toLocaleDateString('es-PE')})

Productos activos: ${prods.rows[0].n}
Stock bajo mínimo: ${low.rows[0].n}
Próximos a vencer (45d): ${exp.rows[0].n}
Ventas hoy: ${sales.rows[0].n} (S/${parseFloat(sales.rows[0].total).toFixed(2)})
Pacientes registrados: ${pts.rows[0].n}
Citas hoy: ${citas.rows[0].n}`

      return { content: [{ type: 'text', text }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Listar inventario ──
server.tool(
  'listar_inventario',
  'Listar productos del inventario con stock, vencimiento y estado',
  {
    filtro: z.string().optional().describe('Filtro por nombre o categoría (opcional)'),
    solo_criticos: z.boolean().optional().describe('true para ver solo productos con stock bajo o próximos a vencer'),
  },
  async ({ filtro, solo_criticos }) => {
    let sql = "SELECT ccodigo, cnombre, ccategoria, cfamilia, nstock, nstockmin, npreventa, cubicacion, cproveedor, crotacion, tvencimien::TEXT FROM bot_productos WHERE cestado='A'"
    const params: string[] = []

    if (filtro) {
      params.push(`%${filtro}%`)
      sql += ` AND (cnombre ILIKE $${params.length} OR ccategoria ILIKE $${params.length})`
    }
    if (solo_criticos) {
      sql += " AND (nstock <= nstockmin OR (tvencimien IS NOT NULL AND tvencimien <= CURRENT_DATE + INTERVAL '45 days'))"
    }
    sql += ' ORDER BY nstock ASC'

    try {
      const result = await query(sql, params)
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: 'No se encontraron productos con esos criterios.' }] }
      }
      const lines = result.rows.map((r: Record<string, unknown>) =>
        `[${r.ccodigo}] ${(r.cnombre as string).trim()} | Cat: ${(r.ccategoria as string).trim()} | Stock: ${r.nstock}/${r.nstockmin} | S/${r.npreventa} | Vence: ${r.tvencimien ?? 'N/A'} | ${(r.cubicacion as string).trim()}`
      )
      return { content: [{ type: 'text', text: `${result.rows.length} producto(s):\n\n${lines.join('\n')}` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Agregar producto ──
server.tool(
  'agregar_producto',
  'Agregar un nuevo producto al inventario de la botica',
  {
    nombre: z.string().describe('Nombre del producto'),
    categoria: z.string().default('Medicamentos').describe('Categoría'),
    familia: z.string().optional().describe('Familia terapéutica'),
    precioVenta: z.number().describe('Precio de venta'),
    stock: z.number().int().describe('Stock inicial'),
    stockMinimo: z.number().int().describe('Stock mínimo para alerta'),
    ubicacion: z.string().optional().describe('Ubicación en farmacia'),
    proveedor: z.string().optional().describe('Proveedor'),
    vencimiento: z.string().optional().describe('Fecha de vencimiento YYYY-MM-DD'),
  },
  async ({ nombre, categoria, familia, precioVenta, stock, stockMinimo, ubicacion, proveedor, vencimiento }) => {
    try {
      const countRes = await query('SELECT COUNT(*) AS n FROM bot_productos')
      const num = parseInt(countRes.rows[0].n) + 1
      const codigo = `${categoria.substring(0, 3).toUpperCase()}-${String(num).padStart(3, '0')}`

      const result = await query(
        `INSERT INTO bot_productos (ccodigo, cnombre, ccategoria, cfamilia, npreventa, nstock, nstockmin, cubicacion, cproveedor, tvencimien)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING nid, ccodigo`,
        [codigo, nombre, categoria, familia ?? '', precioVenta, stock, stockMinimo, ubicacion ?? '', proveedor ?? '', vencimiento ?? null],
      )

      return { content: [{ type: 'text', text: `Producto creado: ${codigo} - ${nombre} (ID: ${result.rows[0].nid})` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Reponer stock ──
server.tool(
  'reponer_stock',
  'Reponer stock de un producto existente',
  {
    producto_id: z.number().int().describe('ID del producto'),
    cantidad: z.number().int().positive().describe('Cantidad a agregar'),
  },
  async ({ producto_id, cantidad }) => {
    try {
      const result = await query(
        'UPDATE bot_productos SET nstock = nstock + $1, tmodifi = NOW() WHERE nid = $2 RETURNING cnombre, nstock',
        [cantidad, producto_id],
      )
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: 'Producto no encontrado.' }] }
      }
      const r = result.rows[0]
      return { content: [{ type: 'text', text: `Stock actualizado: ${(r.cnombre as string).trim()} ahora tiene ${r.nstock} unidades.` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Registrar venta ──
server.tool(
  'registrar_venta',
  'Registrar una nueva venta en la botica',
  {
    concepto: z.string().describe('Descripción o concepto de la venta'),
    cliente: z.string().default('Consumidor final').describe('Nombre del cliente'),
    metodoPago: z.enum(['Efectivo', 'Yape', 'Mixto']).describe('Método de pago'),
    total: z.number().positive().describe('Monto total'),
    notas: z.string().optional().describe('Notas adicionales'),
  },
  async ({ concepto, cliente, metodoPago, total, notas }) => {
    try {
      const countRes = await query('SELECT COUNT(*) AS n FROM bot_ventas')
      const num = parseInt(countRes.rows[0].n) + 1
      const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const codigo = `VTA-${fecha}-${String(num).padStart(4, '0')}`

      const result = await query(
        `INSERT INTO bot_ventas (ccodigo, ccliente, cmetpago, ntotal, cnotas, nusuario_id)
         VALUES ($1, $2, $3, $4, $5, 1) RETURNING nid, ccodigo`,
        [codigo, cliente, metodoPago, total, `${concepto}${notas ? ' - ' + notas : ''}`],
      )

      return { content: [{ type: 'text', text: `Venta registrada: ${codigo} | S/${total.toFixed(2)} | ${metodoPago} | ${cliente}` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Listar ventas ──
server.tool(
  'listar_ventas',
  'Listar las ventas recientes',
  {
    limite: z.number().int().default(10).describe('Cantidad de ventas a mostrar'),
  },
  async ({ limite }) => {
    try {
      const result = await query(
        'SELECT ccodigo, ccliente, cmetpago, ntotal, cnotas, tcreado::TEXT FROM bot_ventas ORDER BY tcreado DESC LIMIT $1',
        [limite],
      )
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: 'No hay ventas registradas.' }] }
      }
      const lines = result.rows.map((r: Record<string, unknown>) =>
        `[${(r.ccodigo as string).trim()}] ${r.tcreado} | S/${r.ntotal} | ${(r.cmetpago as string).trim()} | ${(r.ccliente as string).trim()} | ${(r.cnotas as string).trim()}`
      )
      return { content: [{ type: 'text', text: `${result.rows.length} venta(s):\n\n${lines.join('\n')}` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Registrar paciente ──
server.tool(
  'registrar_paciente',
  'Registrar o actualizar un paciente en el padrón médico',
  {
    nombre: z.string().describe('Nombre completo'),
    dni: z.string().length(8).describe('DNI de 8 dígitos'),
    telefono: z.string().optional().describe('Teléfono'),
    edad: z.number().int().optional().describe('Edad'),
    notas: z.string().optional().describe('Observaciones clínicas'),
  },
  async ({ nombre, dni, telefono, edad, notas }) => {
    try {
      const result = await query(
        `INSERT INTO bot_pacientes (cnombre, cnrodni, ctelefono, nedad, cnotas)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cnrodni) DO UPDATE SET cnombre=EXCLUDED.cnombre, ctelefono=EXCLUDED.ctelefono, nedad=EXCLUDED.nedad, cnotas=EXCLUDED.cnotas, tultvisita=CURRENT_DATE
         RETURNING nid`,
        [nombre, dni, telefono ?? '', edad ?? 0, notas ?? ''],
      )
      return { content: [{ type: 'text', text: `Paciente registrado: ${nombre} (DNI: ${dni}, ID: ${result.rows[0].nid})` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Listar pacientes ──
server.tool(
  'listar_pacientes',
  'Listar pacientes registrados',
  {
    buscar: z.string().optional().describe('Buscar por nombre o DNI'),
  },
  async ({ buscar }) => {
    let sql = "SELECT cnombre, cnrodni, ctelefono, nedad, cnotas, tultvisita::TEXT FROM bot_pacientes WHERE cestado='A'"
    const params: string[] = []
    if (buscar) {
      params.push(`%${buscar}%`)
      sql += ` AND (cnombre ILIKE $1 OR cnrodni LIKE $1)`
    }
    sql += ' ORDER BY cnombre'

    try {
      const result = await query(sql, params)
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: 'No se encontraron pacientes.' }] }
      }
      const lines = result.rows.map((r: Record<string, unknown>) =>
        `${(r.cnombre as string).trim()} | DNI: ${(r.cnrodni as string).trim()} | Tel: ${(r.ctelefono as string).trim()} | Edad: ${r.nedad} | Última visita: ${r.tultvisita}`
      )
      return { content: [{ type: 'text', text: `${result.rows.length} paciente(s):\n\n${lines.join('\n')}` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Agendar cita ──
server.tool(
  'agendar_cita',
  'Agendar una cita o procedimiento médico',
  {
    paciente: z.string().describe('Nombre del paciente'),
    doctor: z.string().describe('Nombre del doctor'),
    especialidad: z.string().optional().describe('Especialidad'),
    sala: z.string().optional().describe('Sala o consultorio'),
    fecha_hora: z.string().describe('Fecha y hora ISO (YYYY-MM-DDTHH:MM)'),
  },
  async ({ paciente, doctor, especialidad, sala, fecha_hora }) => {
    try {
      const result = await query(
        `INSERT INTO bot_citas (cpaciente, cdoctor, cespeciali, csala, tinicio)
         VALUES ($1, $2, $3, $4, $5) RETURNING nid`,
        [paciente, doctor, especialidad ?? '', sala ?? '', fecha_hora],
      )
      return { content: [{ type: 'text', text: `Cita agendada (ID: ${result.rows[0].nid}): ${paciente} con ${doctor} el ${fecha_hora}` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ── Agenda del día ──
server.tool(
  'agenda_hoy',
  'Ver las citas y procedimientos del día',
  {},
  async () => {
    try {
      const result = await query(
        "SELECT cpaciente, cdoctor, cespeciali, csala, tinicio::TEXT, cestado FROM bot_citas WHERE tinicio::DATE = CURRENT_DATE ORDER BY tinicio",
      )
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: 'No hay citas agendadas para hoy.' }] }
      }
      const lines = result.rows.map((r: Record<string, unknown>) =>
        `${r.tinicio} | ${(r.cpaciente as string).trim()} → ${(r.cdoctor as string).trim()} | ${(r.cespeciali as string).trim()} | ${(r.csala as string).trim()} | ${(r.cestado as string).trim()}`
      )
      return { content: [{ type: 'text', text: `Agenda de hoy (${result.rows.length} cita(s)):\n\n${lines.join('\n')}` }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }] }
    }
  },
)

// ═══════════════════════════════════════════
// NUEVOS TOOLS - Módulos completos
// ═══════════════════════════════════════════

// ── Proveedores ──
server.tool(
  'listar_proveedores',
  'Listar proveedores registrados',
  { buscar: z.string().optional().describe('Buscar por nombre o RUC') },
  async ({ buscar }) => {
    let sql = "SELECT nid, cruc, cnombre, ccontacto, ctelefono, cemail FROM bot_proveedores WHERE cestado='A'"
    const params: string[] = []
    if (buscar) { params.push(`%${buscar}%`); sql += ` AND (cnombre ILIKE $1 OR cruc LIKE $1)` }
    sql += ' ORDER BY cnombre'
    try {
      const result = await query(sql, params)
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'No se encontraron proveedores.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `[${r.nid}] ${(r.cnombre as string).trim()} | RUC: ${(r.cruc as string ?? '').trim()} | ${(r.ccontacto as string ?? '').trim()} | ${(r.ctelefono as string ?? '').trim()}`)
      return { content: [{ type: 'text' as const, text: `${result.rows.length} proveedor(es):\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Compras ──
server.tool(
  'registrar_compra',
  'Registrar una compra a proveedor (incrementa stock)',
  {
    proveedor: z.string().describe('Nombre del proveedor'),
    proveedorId: z.number().int().optional().describe('ID del proveedor'),
    documento: z.string().optional().describe('Número de factura/boleta'),
    items: z.array(z.object({
      productoId: z.number().int().describe('ID del producto'),
      cantidad: z.number().int().describe('Cantidad comprada'),
      precioUnit: z.number().describe('Precio unitario de compra'),
    })).describe('Productos comprados'),
  },
  async ({ proveedor, proveedorId, documento, items }) => {
    try {
      const total = items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0)
      const countRes = await query('SELECT COUNT(*)+1 AS n FROM bot_compras')
      const codigo = `CMP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(countRes.rows[0].n).padStart(4,'0')}`
      await query('BEGIN')
      const res = await query(
        `INSERT INTO bot_compras (ccodigo, nproveedor_id, cproveedor, cdocumento, ntotal, nusuario_id) VALUES ($1,$2,$3,$4,$5,1) RETURNING nid`,
        [codigo, proveedorId ?? null, proveedor, documento ?? '', total]
      )
      const compraId = res.rows[0].nid
      for (const it of items) {
        await query('INSERT INTO bot_compras_det (ncompra_id,nproducto_id,ncantidad,npreunit,nsubtotal) VALUES ($1,$2,$3,$4,$5)', [compraId, it.productoId, it.cantidad, it.precioUnit, it.cantidad*it.precioUnit])
        await query('UPDATE bot_productos SET nstock=nstock+$1, nprecompra=$2, tmodifi=NOW() WHERE nid=$3', [it.cantidad, it.precioUnit, it.productoId])
      }
      await query('COMMIT')
      return { content: [{ type: 'text' as const, text: `Compra registrada: ${codigo} | S/${total.toFixed(2)} | ${proveedor} | ${items.length} producto(s)` }] }
    } catch (err) { await query('ROLLBACK'); return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Caja ──
server.tool(
  'estado_caja',
  'Ver estado actual de caja: apertura, ventas del día, desglose',
  {},
  async () => {
    try {
      const [cajaRes, ventasRes, desgloseRes] = await Promise.all([
        query("SELECT nid, ccaja, napertura, tapertura::TEXT FROM bot_caja WHERE cestado='A' ORDER BY tapertura DESC LIMIT 1"),
        query("SELECT COALESCE(SUM(ntotal),0) AS total, COUNT(*) AS n FROM bot_ventas WHERE tcreado::DATE=CURRENT_DATE"),
        query("SELECT cmetpago, COALESCE(SUM(ntotal),0) AS total FROM bot_ventas WHERE tcreado::DATE=CURRENT_DATE GROUP BY cmetpago"),
      ])
      const caja = cajaRes.rows[0]
      const ventas = ventasRes.rows[0]
      const desglose = desgloseRes.rows.map((r: Record<string, unknown>) => `${(r.cmetpago as string).trim()}: S/${r.total}`).join(', ')
      const text = caja
        ? `Caja abierta: ${(caja.ccaja as string).trim()} | Apertura: S/${caja.napertura} (${caja.tapertura})\nVentas hoy: ${ventas.n} por S/${ventas.total}\nDesglose: ${desglose || 'Sin ventas'}`
        : `No hay caja abierta.\nVentas hoy: ${ventas.n} por S/${ventas.total}\nDesglose: ${desglose || 'Sin ventas'}`
      return { content: [{ type: 'text' as const, text }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Médicos ──
server.tool(
  'listar_medicos',
  'Listar médicos registrados',
  {},
  async () => {
    try {
      const result = await query("SELECT nid, cnombre, ccmp, cespeciali, ctelefono FROM bot_medicos WHERE cestado='A' ORDER BY cnombre")
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'No hay médicos registrados.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `[${r.nid}] ${(r.cnombre as string).trim()} | CMP: ${(r.ccmp as string ?? '').trim()} | ${(r.cespeciali as string ?? '').trim()} | ${(r.ctelefono as string ?? '').trim()}`)
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Servicios ──
server.tool(
  'listar_servicios',
  'Listar servicios disponibles (consultas, ecografías, etc)',
  {},
  async () => {
    try {
      const result = await query("SELECT nid, cnombre, ccategoria, nprecio FROM bot_servicios WHERE cestado='A' ORDER BY ccategoria, cnombre")
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'No hay servicios registrados.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `[${r.nid}] ${(r.cnombre as string).trim()} | ${(r.ccategoria as string).trim()} | S/${r.nprecio}`)
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Historial clínico ──
server.tool(
  'historial_paciente',
  'Ver historial clínico de un paciente',
  { pacienteId: z.number().int().describe('ID del paciente') },
  async ({ pacienteId }) => {
    try {
      const result = await query("SELECT h.cfecha::TEXT, h.cdoctor, h.cdiagnostico, h.ctratamiento, h.cobservacion, h.csignos FROM bot_historial h WHERE h.npaciente_id=$1 ORDER BY h.cfecha DESC", [pacienteId])
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'Sin historial clínico para este paciente.' }] }
      const entries = result.rows.map((r: Record<string, unknown>) => `📋 ${r.cfecha} - ${(r.cdoctor as string).trim()}\n  Dx: ${(r.cdiagnostico as string ?? '').trim()}\n  Tx: ${(r.ctratamiento as string ?? '').trim()}\n  Obs: ${(r.cobservacion as string ?? '').trim()}\n  Signos: ${(r.csignos as string ?? '').trim()}`)
      return { content: [{ type: 'text' as const, text: `Historial (${result.rows.length} registro(s)):\n\n${entries.join('\n\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Reportes ──
server.tool(
  'reporte_vencimiento',
  'Reporte de productos próximos a vencer',
  {
    dias: z.number().int().default(90).describe('Días para considerar próximo a vencer'),
    familia: z.string().optional().describe('Filtrar por familia terapéutica'),
    rotacion: z.enum(['Alta', 'Media', 'Baja']).optional().describe('Filtrar por rotación'),
  },
  async ({ dias, familia, rotacion }) => {
    try {
      let sql = "SELECT ccodigo, cnombre, cfamilia, crotacion, nstock, tvencimien::TEXT, (tvencimien-CURRENT_DATE) AS dias_restantes FROM bot_productos WHERE cestado='A' AND tvencimien IS NOT NULL AND tvencimien <= CURRENT_DATE + ($1 || ' days')::INTERVAL"
      const params: unknown[] = [dias]
      if (familia) { params.push(`%${familia}%`); sql += ` AND cfamilia ILIKE $${params.length}` }
      if (rotacion) { params.push(rotacion); sql += ` AND crotacion = $${params.length}` }
      sql += ' ORDER BY tvencimien ASC'
      const result = await query(sql, params)
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: `No hay productos por vencer en ${dias} días.` }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `[${r.ccodigo}] ${(r.cnombre as string).trim()} | ${(r.cfamilia as string ?? '').trim()} | Rot: ${r.crotacion} | Stock: ${r.nstock} | Vence: ${r.tvencimien} (${r.dias_restantes}d)`)
      return { content: [{ type: 'text' as const, text: `${result.rows.length} producto(s) por vencer:\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

server.tool(
  'reporte_ganancias',
  'Reporte de ganancias: ventas vs compras en un período',
  {
    desde: z.string().optional().describe('Fecha inicio YYYY-MM-DD'),
    hasta: z.string().optional().describe('Fecha fin YYYY-MM-DD'),
  },
  async ({ desde, hasta }) => {
    try {
      const d = desde ?? new Date().toISOString().slice(0,8) + '01'
      const h = hasta ?? new Date().toISOString().slice(0,10)
      const [ventasRes, comprasRes] = await Promise.all([
        query("SELECT COALESCE(SUM(ntotal),0) AS total, COUNT(*) AS n FROM bot_ventas WHERE tcreado::DATE BETWEEN $1 AND $2 AND cestado='A'", [d, h]),
        query("SELECT COALESCE(SUM(ntotal),0) AS total, COUNT(*) AS n FROM bot_compras WHERE tcreado::DATE BETWEEN $1 AND $2 AND cestado='A'", [d, h]),
      ])
      const v = ventasRes.rows[0], c = comprasRes.rows[0]
      const ganancia = parseFloat(v.total) - parseFloat(c.total)
      return { content: [{ type: 'text' as const, text: `📊 Reporte ${d} a ${h}\n\nVentas: ${v.n} operaciones por S/${parseFloat(v.total).toFixed(2)}\nCompras: ${c.n} operaciones por S/${parseFloat(c.total).toFixed(2)}\nGanancia bruta: S/${ganancia.toFixed(2)}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

server.tool(
  'reporte_faltantes',
  'Reporte de productos con stock bajo mínimo',
  {},
  async () => {
    try {
      const result = await query("SELECT ccodigo, cnombre, cfamilia, nstock, nstockmin, (nstockmin-nstock) AS faltante, cproveedor FROM bot_productos WHERE cestado='A' AND nstock<=nstockmin ORDER BY (nstockmin-nstock) DESC")
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'No hay productos con stock bajo mínimo.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `[${r.ccodigo}] ${(r.cnombre as string).trim()} | Stock: ${r.nstock}/${r.nstockmin} (faltan ${r.faltante}) | ${(r.cproveedor as string ?? '').trim()}`)
      return { content: [{ type: 'text' as const, text: `${result.rows.length} producto(s) faltantes:\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Deudores ──
server.tool(
  'listar_deudores',
  'Listar deudores pendientes',
  { estado: z.enum(['P', 'A', 'C']).optional().describe('P=Pendiente, A=Abonando, C=Cancelado') },
  async ({ estado }) => {
    try {
      let sql = "SELECT cnombre, cdni, cconcepto, nmonto, nabonado, (nmonto-nabonado) AS saldo, ffecha::TEXT, cestado FROM bot_deudores"
      if (estado) sql += ` WHERE cestado='${estado}'`
      sql += ' ORDER BY cestado ASC, ffecha DESC'
      const result = await query(sql)
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'No hay deudores.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `${(r.cnombre as string).trim()} | DNI: ${(r.cdni as string ?? '').trim()} | Concepto: ${(r.cconcepto as string).trim()} | Deuda: S/${r.nmonto} | Abonado: S/${r.nabonado} | Saldo: S/${r.saldo} | ${r.cestado}`)
      return { content: [{ type: 'text' as const, text: `${result.rows.length} deudor(es):\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Alquileres ──
server.tool(
  'listar_alquileres',
  'Listar alquileres de consultorios y espacios',
  {},
  async () => {
    try {
      const result = await query("SELECT cconcepto, carrendatario, nperiodo_monto, cperiodo, finicio::TEXT, ffin::TEXT, cestado FROM bot_alquileres ORDER BY cestado ASC")
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'No hay alquileres.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `${(r.cconcepto as string).trim()} | ${(r.carrendatario as string ?? '').trim()} | S/${r.nperiodo_monto} ${(r.cperiodo as string).trim()} | ${r.finicio ?? '?'} - ${r.ffin ?? '?'} | ${r.cestado}`)
      return { content: [{ type: 'text' as const, text: `${result.rows.length} alquiler(es):\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Auditoría ──
server.tool(
  'ver_auditoria',
  'Ver registro de auditoría de acciones del sistema',
  { limite: z.number().int().default(20).describe('Cantidad de registros') },
  async ({ limite }) => {
    try {
      const result = await query("SELECT cusuario, caccion, ctabla, cdetalle, tcreado::TEXT FROM bot_auditoria ORDER BY tcreado DESC LIMIT $1", [limite])
      if (result.rows.length === 0) return { content: [{ type: 'text' as const, text: 'Sin registros de auditoría.' }] }
      const lines = result.rows.map((r: Record<string, unknown>) => `${r.tcreado} | ${(r.cusuario as string ?? '').trim()} | ${(r.caccion as string).trim()} | ${(r.ctabla as string ?? '').trim()} | ${(r.cdetalle as string ?? '').trim()}`)
      return { content: [{ type: 'text' as const, text: `Últimos ${result.rows.length} registro(s):\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Gestión de Usuarios ──
server.tool(
  'listar_usuarios',
  'Listar usuarios del sistema con sus permisos y estado',
  {},
  async () => {
    try {
      const result = await query("SELECT u.nid, u.cnrodni, u.cnombre, u.crol, u.cestado, u.lsuper, u.ladmin, u.tcreado::TEXT, array_agg(p.cseccion ORDER BY p.cseccion) FILTER (WHERE p.cseccion IS NOT NULL) AS permisos FROM bot_usuarios u LEFT JOIN bot_permisos p ON p.nusuario_id=u.nid GROUP BY u.nid ORDER BY u.nid")
      const lines = result.rows.map((r: Record<string, unknown>) => {
        const flags = [r.lsuper ? 'SUPER' : '', r.ladmin ? 'ADMIN' : ''].filter(Boolean).join(',')
        return `[${r.nid}] ${(r.cnombre as string).trim()} | DNI: ${(r.cnrodni as string).trim()} | Rol: ${(r.crol as string).trim()} | Estado: ${r.cestado} ${flags ? `| ${flags}` : ''} | Permisos: ${(r.permisos as string[] ?? []).join(', ') || 'ninguno'}`
      })
      return { content: [{ type: 'text' as const, text: `${result.rows.length} usuario(s):\n\n${lines.join('\n')}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

server.tool(
  'crear_usuario',
  'Crear un nuevo usuario. La clave inicial es el DNI. Nunca se eliminan, solo se desactivan.',
  {
    nombre: z.string().describe('Nombre completo'),
    dni: z.string().length(8).describe('DNI de 8 dígitos (también será la clave inicial)'),
    rol: z.string().default('usuario').describe('Etiqueta de rol (libre, ej: caja, almacenero, doctor)'),
    permisos: z.array(z.string()).default([]).describe('Lista de secciones permitidas: dashboard, inventario, ventas, caja, compras, pacientes, procedimientos, medicos, reportes, transferencias, alquileres, deudores, inventario-var, auditoria'),
  },
  async ({ nombre, dni, rol, permisos }) => {
    try {
      // Check if exists
      const existing = await query("SELECT nid, cestado FROM bot_usuarios WHERE cnrodni=$1", [dni])
      if (existing.rows.length > 0) {
        const ex = existing.rows[0]
        if (ex.cestado === 'I') {
          // Reactivate
          await query("UPDATE bot_usuarios SET cnombre=$1, crol=$2, cestado='A', tmodifi=NOW() WHERE nid=$3", [nombre, rol, ex.nid])
          await query("DELETE FROM bot_permisos WHERE nusuario_id=$1", [ex.nid])
          for (const sec of permisos) { await query("INSERT INTO bot_permisos (nusuario_id, cseccion) VALUES ($1,$2) ON CONFLICT DO NOTHING", [ex.nid, sec]) }
          return { content: [{ type: 'text' as const, text: `Usuario reactivado: ${nombre} (ID: ${ex.nid}) con ${permisos.length} permisos` }] }
        }
        return { content: [{ type: 'text' as const, text: 'Error: Ya existe un usuario activo con ese DNI.' }] }
      }
      // Create - password = DNI via PostgreSQL pgcrypto
      const res = await query(
        "INSERT INTO bot_usuarios (cnrodni, cnombre, cclave, crol) VALUES ($1,$2, crypt($1, gen_salt('bf')), $3) RETURNING nid",
        [dni, nombre, rol]
      )
      const uid = res.rows[0].nid
      for (const sec of permisos) { await query("INSERT INTO bot_permisos (nusuario_id, cseccion) VALUES ($1,$2) ON CONFLICT DO NOTHING", [uid, sec]) }
      return { content: [{ type: 'text' as const, text: `Usuario creado: ${nombre} (ID: ${uid}, DNI: ${dni}) con ${permisos.length} permisos. Clave = DNI.` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

server.tool(
  'actualizar_permisos',
  'Actualizar los permisos (secciones) de un usuario existente',
  {
    usuario_id: z.number().int().describe('ID del usuario'),
    permisos: z.array(z.string()).describe('Nueva lista completa de secciones permitidas'),
    admin: z.boolean().optional().describe('true para otorgar poderes de admin (gestionar usuarios)'),
  },
  async ({ usuario_id, permisos, admin }) => {
    try {
      await query("DELETE FROM bot_permisos WHERE nusuario_id=$1", [usuario_id])
      for (const sec of permisos) { await query("INSERT INTO bot_permisos (nusuario_id, cseccion) VALUES ($1,$2) ON CONFLICT DO NOTHING", [usuario_id, sec]) }
      if (admin !== undefined) {
        await query("UPDATE bot_usuarios SET ladmin=$1, tmodifi=NOW() WHERE nid=$2", [admin, usuario_id])
      }
      const nameRes = await query("SELECT cnombre FROM bot_usuarios WHERE nid=$1", [usuario_id])
      const name = nameRes.rows[0] ? (nameRes.rows[0].cnombre as string).trim() : `#${usuario_id}`
      return { content: [{ type: 'text' as const, text: `Permisos actualizados para ${name}: ${permisos.join(', ')}${admin !== undefined ? ` | Admin: ${admin}` : ''}` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

server.tool(
  'desactivar_usuario',
  'Desactivar un usuario (no se elimina, solo se desactiva). No se puede desactivar al super usuario.',
  { usuario_id: z.number().int().describe('ID del usuario a desactivar') },
  async ({ usuario_id }) => {
    try {
      const check = await query("SELECT cnombre, lsuper FROM bot_usuarios WHERE nid=$1", [usuario_id])
      if (check.rows.length === 0) return { content: [{ type: 'text' as const, text: 'Usuario no encontrado.' }] }
      if (check.rows[0].lsuper) return { content: [{ type: 'text' as const, text: 'No se puede desactivar al super usuario.' }] }
      await query("UPDATE bot_usuarios SET cestado='I', tmodifi=NOW() WHERE nid=$1", [usuario_id])
      return { content: [{ type: 'text' as const, text: `Usuario ${(check.rows[0].cnombre as string).trim()} desactivado.` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

server.tool(
  'activar_usuario',
  'Reactivar un usuario desactivado',
  { usuario_id: z.number().int().describe('ID del usuario a activar') },
  async ({ usuario_id }) => {
    try {
      await query("UPDATE bot_usuarios SET cestado='A', tmodifi=NOW() WHERE nid=$1", [usuario_id])
      const res = await query("SELECT cnombre FROM bot_usuarios WHERE nid=$1", [usuario_id])
      const name = res.rows[0] ? (res.rows[0].cnombre as string).trim() : `#${usuario_id}`
      return { content: [{ type: 'text' as const, text: `Usuario ${name} activado.` }] }
    } catch (err) { return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }] } }
  },
)

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Botica MCP Server v2 corriendo en stdio')
}

main().catch(console.error)
