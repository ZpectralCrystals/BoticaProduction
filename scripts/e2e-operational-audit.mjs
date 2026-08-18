#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const API = process.env.BOTICA_API_URL || 'http://localhost:3001/api/v1'
const FRONTEND = process.env.BOTICA_FRONTEND_URL || 'http://localhost:5175'
const DB_NAME = process.env.BOTICA_DB_NAME || 'botica_db'
const USER_DNI = process.env.BOTICA_TEST_DNI || '00000000'
const USER_PASS = process.env.BOTICA_TEST_PASS || '12345678'

const now = new Date()
const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
const runId = `E2E-${stamp}`
const repoRoot = process.cwd()
const backupDir = path.join(repoRoot, 'backups')
const reportDir = path.join(repoRoot, 'docs', 'reports')
const screenshotDir = path.join(reportDir, 'e2e-screenshots', runId)
const backupPath = path.join(backupDir, `local_e2e_audit_${stamp}.dump`)
const reportPath = path.join(reportDir, `INFORME_QA_FLUJOS_BOTICA_LOCAL_${stamp}.md`)

mkdirSync(backupDir, { recursive: true })
mkdirSync(reportDir, { recursive: true })
mkdirSync(screenshotDir, { recursive: true })

const results = []
const context = {
  runId,
  startedAt: now.toISOString(),
  api: API,
  frontend: FRONTEND,
  backupPath,
  reportPath,
  ids: {},
  screenshots: [],
  warnings: [],
}

let token = ''

function money(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function addResult(name, status, evidence = '', expected = '') {
  results.push({ name, status, evidence, expected })
}

function assertCase(name, condition, evidence, expected = '') {
  if (!condition) {
    addResult(name, 'FAIL', evidence, expected)
    throw new Error(`${name}: ${evidence}`)
  }
  addResult(name, 'PASS', evidence, expected)
}

async function request(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!res.ok && !options.allowError) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`
    const error = new Error(`${pathname} -> ${res.status}: ${msg}`)
    error.status = res.status
    error.data = data
    throw error
  }
  return { status: res.status, ok: res.ok, data }
}

async function step(name, fn) {
  try {
    await fn()
  } catch (error) {
    addResult(name, 'FAIL', error.message, '')
  }
}

async function getInventoryItem(productId) {
  const inv = await request(`/inventario?search=${encodeURIComponent(runId)}&limit=100`)
  return inv.data.find((item) => Number(item.id) === Number(productId))
}

async function getLotes(productId) {
  const res = await request(`/lotes?producto_id=${productId}&limit=50`)
  return res.data?.data || []
}

async function getCajaAbierta() {
  const caja = await request('/caja')
  return caja.data.cajaAbierta || caja.data.cajasAbiertas?.[0] || null
}

async function main() {
  execFileSync('pg_dump', ['-d', DB_NAME, '-Fc', '-f', backupPath], { stdio: 'pipe' })
  addResult('Backup pre-QA', 'PASS', backupPath, 'dump creado antes de tocar datos')

  const rawHealth = await fetch(API.replace('/api/v1', '/health/live'))
  assertCase('Backend vivo', rawHealth.ok, `HTTP ${rawHealth.status}`, '200 OK')

  const login = await request('/auth/login', {
    method: 'POST',
    body: { dni: USER_DNI, clave: USER_PASS },
  })
  token = login.data.token
  context.ids.userId = login.data.id
  assertCase('Login administrador', Boolean(token), `usuario=${login.data.nombre}, rol=${login.data.rol}`, 'token válido')

  const session = await request('/auth/session')
  assertCase('Sesión persistente API', session.data.dni === USER_DNI, `dni=${session.data.dni}`, USER_DNI)

  let caja = await getCajaAbierta()
  if (!caja) {
    const opened = await request('/caja', {
      method: 'POST',
      body: {
        action: 'abrir',
        montoApertura: 500,
        caja: `Caja QA ${runId}`,
        usuarioId: Number(context.ids.userId),
      },
    })
    context.ids.cajaId = opened.data.id
    addResult('Caja abierta', 'PASS', `cajaId=${opened.data.id}`, 'caja disponible para compras/ventas')
  } else {
    context.ids.cajaId = caja.nid
    addResult('Caja abierta', 'PASS', `cajaId=${caja.nid} existente`, 'caja disponible para compras/ventas')
  }

  const almacenes = await request('/almacenes')
  const almacenVenta = almacenes.data.find((a) => a.permiteVenta && a.id === 1) || almacenes.data.find((a) => a.permiteVenta)
  const almacenDestino = almacenes.data.find((a) => a.id !== almacenVenta.id && a.tipoAlmacen === 'CUARENTENA') || almacenes.data.find((a) => a.id !== almacenVenta.id)
  assertCase('Almacenes activos', Boolean(almacenVenta && almacenDestino), `venta=${almacenVenta?.nombre}, destino=${almacenDestino?.nombre}`, 'origen vendible y destino distinto')

  const providerRuc = `20${Date.now().toString().slice(-9)}`
  const provider = await request('/proveedores', {
    method: 'POST',
    body: {
      nombre: `Proveedor QA ${runId}`,
      ruc: providerRuc,
      contacto: 'Tester QA',
      telefono: '999888777',
      email: `qa.${stamp}@botica.local`,
      direccion: 'Av. QA 123',
      notas: `Creado por auditoria ${runId}`,
      estado: 'ACTIVO',
    },
  })
  context.ids.providerId = provider.data.id
  assertCase('Proveedor creado', provider.data.ok, `proveedorId=${provider.data.id}, ruc=${providerRuc}`, 'proveedor activo')

  const product = await request('/inventario', {
    method: 'POST',
    body: {
      name: `Producto QA Flujo Completo ${runId}`,
      tipoProducto: 'MEDICAMENTO',
      generico: 'Paracetamol QA 500mg',
      category: 'Medicamentos',
      family: 'Pruebas QA',
      presentacion: 'Caja x 10',
      laboratorio: 'LAB QA',
      precioVenta1: 12.5,
      precioVenta2: 11,
      precioVenta3: 10,
      stock: 0,
      minStock: 2,
      location: 'QA-A1',
      supplierId: Number(context.ids.providerId),
      rotation: 'Alta',
      receta: 'N',
    },
  })
  context.ids.productId = product.data.id
  assertCase('Producto creado', product.data.ok, `productoId=${product.data.id}, codigo=${product.data.codigo}`, 'stock inicial 0')

  const purchase1Doc = `FQA-${stamp}-01`
  const purchase1 = await request('/compras', {
    method: 'POST',
    body: {
      proveedorId: Number(context.ids.providerId),
      tipoComprobante: 'FACTURA',
      numeroDocumento: purchase1Doc,
      almacenId: almacenVenta.id,
      tipoPago: 'CONTADO',
      notas: `Compra contado QA ${runId}`,
      items: [{
        productoId: Number(context.ids.productId),
        cantidad: 10,
        precioUnit: 5.25,
        codigoLote: `${runId}-A`,
        fechaVencimiento: '2028-02-28',
        notasLote: 'Primer lote QA FEFO',
      }],
    },
  })
  context.ids.purchaseContadoId = purchase1.data.id
  assertCase('Factura compra contado', purchase1.data.ok && money(purchase1.data.total) === 52.5, `compraId=${purchase1.data.id}, total=${purchase1.data.total}`, 'stock + caja egreso')

  const purchase2Doc = `FQA-${stamp}-02`
  const purchase2 = await request('/compras', {
    method: 'POST',
    body: {
      proveedorId: Number(context.ids.providerId),
      tipoComprobante: 'FACTURA',
      numeroDocumento: purchase2Doc,
      almacenId: almacenVenta.id,
      tipoPago: 'CREDITO',
      fechaVencimientoFactura: '2026-09-30',
      notas: `Compra credito QA ${runId}`,
      items: [{
        productoId: Number(context.ids.productId),
        cantidad: 8,
        precioUnit: 4.8,
        codigoLote: `${runId}-B`,
        fechaVencimiento: '2030-03-28',
        notasLote: 'Segundo lote QA FEFO',
      }],
    },
  })
  context.ids.purchaseCreditoId = purchase2.data.id
  assertCase('Factura compra crédito', purchase2.data.ok && money(purchase2.data.total) === 38.4, `compraId=${purchase2.data.id}, total=${purchase2.data.total}`, 'stock + CXP')

  let item = await getInventoryItem(context.ids.productId)
  let lotes = await getLotes(context.ids.productId)
  assertCase('Stock almacenado tras facturas', item?.stock === 18, `stock=${item?.stock}, lotes=${lotes.map((l) => `${l.codigoLote}:${l.cantidad}:${l.estado}`).join(', ')}`, '18 unidades')

  const cxps = await request('/cuentas-por-pagar')
  const cxp = cxps.data.find((row) => row.documento === purchase2Doc)
  context.ids.cxpId = cxp?.nid
  assertCase('CXP creada por factura crédito', Boolean(cxp) && money(cxp.saldo) === 38.4, `cxpId=${cxp?.nid}, saldo=${cxp?.saldo}, estado=${cxp?.estado}`, 'saldo 38.40 pendiente')

  const sale = await request('/ventas', {
    method: 'POST',
    body: {
      customer: `Cliente QA ${runId}`,
      documentId: '76543210',
      paymentMethod: 'Mixto',
      montoEfectivo: 50,
      metodoPagoSecundario: 'Yape',
      total: 150,
      cashier: 'Caja QA',
      area: 'Botica',
      notes: `Venta FEFO QA ${runId}`,
      almacenId: almacenVenta.id,
      items: [{
        productoId: Number(context.ids.productId),
        productoNombre: `Producto QA Flujo Completo ${runId}`,
        cantidad: 12,
        precioUnitario: 12.5,
        total: 150,
      }],
    },
  })
  context.ids.saleId = sale.data.id
  assertCase('Venta FEFO registrada', sale.data.ok, `ventaId=${sale.data.id}, codigo=${sale.data.codigo}`, 'descuenta lote que vence antes')

  item = await getInventoryItem(context.ids.productId)
  lotes = await getLotes(context.ids.productId)
  const loteA = lotes.find((l) => l.codigoLote === `${runId}-A`)
  const loteB = lotes.find((l) => l.codigoLote === `${runId}-B`)
  assertCase('FEFO aplicado', item?.stock === 6 && Number(loteA?.cantidad || 0) === 0 && loteA?.estado === 'AGOTADO' && Number(loteB?.cantidad || 0) === 6, `stock=${item?.stock}, loteA=${loteA?.cantidad}/${loteA?.estado}, loteB=${loteB?.cantidad}/${loteB?.estado}`, 'lote A agotado, lote B con 6')

  const badSale = await request('/ventas', {
    method: 'POST',
    allowError: true,
    body: {
      customer: 'Cliente sin stock QA',
      paymentMethod: 'Efectivo',
      total: 124987.5,
      almacenId: almacenVenta.id,
      items: [{
        productoId: Number(context.ids.productId),
        productoNombre: `Producto QA Flujo Completo ${runId}`,
        cantidad: 9999,
        precioUnitario: 12.5,
        total: 124987.5,
      }],
    },
  })
  assertCase('Bloqueo venta sin stock', !badSale.ok && badSale.status === 400, `HTTP ${badSale.status}: ${badSale.data?.error || badSale.data?.message}`, 'HTTP 400 sin descontar stock')

  const transfer = await request('/traslados-almacen', {
    method: 'POST',
    body: {
      productoId: Number(context.ids.productId),
      almacenOrigenId: almacenVenta.id,
      almacenDestinoId: almacenDestino.id,
      cantidad: 2,
      motivo: `Traslado QA ${runId}`,
    },
  })
  assertCase('Traslado entre almacenes', transfer.data.ok, `origen=${transfer.data.almacenOrigen?.nombre}, destino=${transfer.data.almacenDestino?.nombre}, cantidad=${transfer.data.cantidad}`, 'producto stock total no cambia')

  const devolCliente = await request('/traslados-almacen/devolucion-cliente', {
    method: 'POST',
    body: {
      productoId: Number(context.ids.productId),
      almacenDestinoId: almacenDestino.id,
      cantidad: 1,
      motivo: `Devolucion cliente QA ${runId}`,
    },
  })
  assertCase('Devolución cliente', devolCliente.data.ok, `productoId=${devolCliente.data.productoId}, cantidad=${devolCliente.data.cantidad}`, 'stock +1')

  const devolProveedor = await request('/traslados-almacen/devolucion-proveedor', {
    method: 'POST',
    body: {
      productoId: Number(context.ids.productId),
      almacenOrigenId: almacenVenta.id,
      cantidad: 1,
      motivo: `Devolucion proveedor QA ${runId}`,
    },
  })
  assertCase('Devolución proveedor', devolProveedor.data.ok, `productoId=${devolProveedor.data.productoId}, cantidad=${devolProveedor.data.cantidad}`, 'stock -1')

  const ajuste = await request('/kardex/ajuste', {
    method: 'POST',
    body: {
      productoId: Number(context.ids.productId),
      cantidad: 1,
      motivo: `Ajuste positivo QA ${runId}`,
    },
  })
  assertCase('Ajuste inventario/kardex', ajuste.data.success === true, `productoId=${ajuste.data.productoId}, cantidad=${ajuste.data.cantidad}, kardexId=${ajuste.data.kardexId}`, 'stock +1 con kardex')

  const cxpPayment = await request(`/cuentas-por-pagar/${context.ids.cxpId}/pagar`, {
    method: 'POST',
    body: {
      monto: 10,
      metodoPago: 'YAPE',
      documento: `PAY-${stamp}`,
      notas: `Pago parcial QA ${runId}`,
    },
  })
  assertCase('Pago parcial CXP', cxpPayment.data.ok, `pagoId=${cxpPayment.data.pagoId}, cajaMov=${cxpPayment.data.cajaMovimientoId}`, 'saldo baja a 28.40')

  const cxpDetail = await request(`/cuentas-por-pagar/${context.ids.cxpId}`)
  assertCase('CXP saldo actualizado', money(cxpDetail.data.cxp.nsaldo) === 28.4, `saldo=${cxpDetail.data.cxp.nsaldo}, pagos=${cxpDetail.data.pagos.length}`, 'saldo 28.40')

  const sale2 = await request('/ventas', {
    method: 'POST',
    body: {
      customer: `Cliente Anulacion ${runId}`,
      documentId: '12345678',
      paymentMethod: 'Efectivo',
      montoEfectivo: 20,
      total: 12.5,
      cashier: 'Caja QA',
      area: 'Botica',
      notes: `Venta para anular QA ${runId}`,
      almacenId: almacenVenta.id,
      items: [{
        productoId: Number(context.ids.productId),
        productoNombre: `Producto QA Flujo Completo ${runId}`,
        cantidad: 1,
        precioUnitario: 12.5,
        total: 12.5,
      }],
    },
  })
  context.ids.saleAnnulId = sale2.data.id
  const annul = await request(`/ventas/${sale2.data.id}/anular`, {
    method: 'PATCH',
    body: { motivo: `QA anula venta ${runId}` },
  })
  assertCase('Anulación venta', annul.data.ok, `ventaId=${sale2.data.id}, codigo=${annul.data.codigo}, message=${annul.data.message}`, 'stock/lote restaurado')

  const movManual = await request('/caja/movimientos', {
    method: 'POST',
    body: {
      tipo: 'INGRESO',
      monto: 7.5,
      metodoPago: 'EFECTIVO',
      descripcion: `Ingreso manual QA ${runId}`,
      cajaId: Number(context.ids.cajaId),
    },
  })
  assertCase('Caja movimiento manual', movManual.data.ok, `movId=${movManual.data.id}`, 'ingreso registrado')

  const patientDni = stamp.slice(-8)
  const patient = await request('/pacientes', {
    method: 'POST',
    body: { fullName: `Paciente QA ${runId}`, documentId: patientDni, phone: '988777666', age: 34, notes: 'QA flujo clínico' },
  })
  const doctor = await request('/medicos', {
    method: 'POST',
    body: { nombre: `Medico QA ${runId}`, cmp: `CMP${stamp.slice(-6)}`, especialidad: 'Medicina General', telefono: '977666555', email: `med.${stamp}@botica.local`, notas: 'QA' },
  })
  const service = await request('/servicios', {
    method: 'POST',
    body: { nombre: `Consulta QA ${runId}`, categoria: 'Consulta', precio: 35, descripcion: 'QA servicio' },
  })
  const appointment = await request('/citas', {
    method: 'POST',
    body: { patient: `Paciente QA ${runId}`, doctor: `Medico QA ${runId}`, specialty: 'Medicina General', room: 'Consultorio QA', startsAt: '2026-08-12T09:30:00', status: 'Confirmada' },
  })
  context.ids.patientId = patient.data.id
  context.ids.doctorId = doctor.data.id
  context.ids.serviceId = service.data.id
  context.ids.appointmentId = appointment.data.id
  assertCase('Flujo clínico mínimo', patient.data.ok && doctor.data.ok && service.data.ok && appointment.data.ok, `paciente=${patient.data.id}, medico=${doctor.data.id}, servicio=${service.data.id}, cita=${appointment.data.id}`, 'alta de entidades clínicas')

  const smokeEndpoints = [
    '/dashboard',
    '/inventario',
    '/compras',
    '/ventas',
    '/caja',
    '/caja/resumen',
    '/cuentas-por-pagar',
    '/cuentas-por-pagar/resumen',
    '/kardex',
    '/lotes',
    '/almacenes',
    '/traslados-almacen',
    '/consistencia/stock',
    '/consistencia/lotes',
    '/consistencia/kardex',
    '/consistencia/resumen',
    '/consistencia/alertas',
    '/reportes?tipo=ganancias',
    '/auditoria',
  ]
  for (const endpoint of smokeEndpoints) {
    const res = await request(endpoint, { allowError: true })
    addResult(`API smoke ${endpoint}`, res.ok ? 'PASS' : 'FAIL', `HTTP ${res.status}`, '200 OK')
  }

  const frontendRoutes = [
    '/',
    '/panel',
    '/panel/inventario',
    '/panel/compras',
    '/panel/ventas',
    '/panel/caja',
    '/panel/reportes',
  ]
  for (const route of frontendRoutes) {
    const res = await fetch(`${FRONTEND}${route}`)
    const html = await res.text()
    const hasAppRoot = html.includes('id="root"') || html.includes('/src/')
    addResult(`Frontend smoke ${route}`, res.ok && hasAppRoot ? 'PASS' : 'FAIL', `HTTP ${res.status}, appRoot=${hasAppRoot}`, 'SPA responde')
  }

  const finalItem = await getInventoryItem(context.ids.productId)
  const finalLotes = await getLotes(context.ids.productId)
  const kardex = await request(`/kardex?producto_id=${context.ids.productId}`)
  const cajaResumen = await request('/caja/resumen')
  const consistencia = await request('/consistencia/resumen')
  context.finalState = {
    productStock: finalItem?.stock,
    lotes: finalLotes.map((l) => `${l.codigoLote}:${l.cantidad}:${l.estado}`),
    kardexCount: Array.isArray(kardex.data) ? kardex.data.length : kardex.data?.data?.length,
    cajaResumen: cajaResumen.data,
    consistencia: consistencia.data,
  }

  writeReport()
  console.log(JSON.stringify({
    ok: results.every((r) => r.status === 'PASS'),
    runId,
    backupPath,
    reportPath,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
  }, null, 2))
}

function writeReport() {
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const warn = results.filter((r) => r.status === 'WARN').length
  const lines = [
    `# Informe QA E2E - Botica Local`,
    ``,
    `Fecha: ${context.startedAt}`,
    `Run ID: ${context.runId}`,
    `Ambiente: local/lab`,
    `Frontend: ${context.frontend}`,
    `API: ${context.api}`,
    `Backup previo: \`${context.backupPath}\``,
    ``,
    `## Resumen`,
    ``,
    `- PASS: ${pass}`,
    `- FAIL: ${fail}`,
    `- WARN: ${warn}`,
    `- Resultado: ${fail === 0 ? 'APROBADO para pruebas operativas locales' : 'CON OBSERVACIONES'}`,
    ``,
    `## Alcance probado`,
    ``,
    `Se ejecutó flujo real completo: login, caja, proveedor, producto, factura contado, factura crédito, almacenamiento por lote, venta FEFO, bloqueo por stock insuficiente, traslado entre almacenes, devolución de cliente, devolución a proveedor, ajuste de inventario, pago parcial de CXP, anulación de venta, movimiento manual de caja, módulos clínicos mínimos, endpoints de reportes/auditoría/consistencia.`,
    ``,
    `## Casos`,
    ``,
    `| # | Caso | Estado | Evidencia | Esperado |`,
    `|---:|---|---|---|---|`,
    ...results.map((r, index) => `| ${index + 1} | ${escapeCell(r.name)} | ${r.status} | ${escapeCell(r.evidence)} | ${escapeCell(r.expected)} |`),
    ``,
    `## Datos creados`,
    ``,
    `| Entidad | ID / valor |`,
    `|---|---|`,
    ...Object.entries(context.ids).map(([key, value]) => `| ${escapeCell(key)} | ${escapeCell(String(value ?? ''))} |`),
    ``,
    `## Estado final producto QA`,
    ``,
    `- Stock producto: ${context.finalState?.productStock ?? 'N/D'}`,
    `- Lotes: ${(context.finalState?.lotes || []).join(', ') || 'N/D'}`,
    `- Movimientos Kardex consultados: ${context.finalState?.kardexCount ?? 'N/D'}`,
    ``,
    `## Observaciones tester`,
    ``,
    fail === 0
      ? `No se encontraron bloqueos funcionales en flujo principal local. La trazabilidad compra → lote → venta FEFO → kardex → caja/CXP respondió correctamente.`
      : `Hay fallas en casos marcados FAIL. Revisar evidencia antes de pasar cambios a nube/producción.`,
    ``,
    `## Recomendación`,
    ``,
    `Mantener este script como regresión local antes de mover cambios a producción. Si se cambia compras, ventas, lotes, caja o CXP, volver a ejecutar y guardar nuevo informe.`,
    ``,
  ]
  writeFileSync(reportPath, `${lines.join('\n')}\n`)
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>')
}

main().catch((error) => {
  addResult('Ejecución general', 'FAIL', error.message, '')
  try {
    writeReport()
  } catch {}
  console.error(error)
  process.exit(1)
})
