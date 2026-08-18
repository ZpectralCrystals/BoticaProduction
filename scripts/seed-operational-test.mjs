import fs from 'node:fs'

const API = process.env.BOTICA_API_URL || 'http://localhost:5175/api/v1'
const INPUT =
  process.env.BOTICA_SEED_INPUT ||
  '/Users/gg/.codex/attachments/48a00e8f-650c-4fe3-a1e3-2f21693351c7/pasted-text.txt'

function readSeedRows() {
  let text = fs.readFileSync(INPUT, 'utf8').trim()
  text = text.replace(/^json\s*/, '')
  text = text.replace(/Usa el código con precaución\.\"/g, '"')
  return JSON.parse(text)
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  }
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : {}
  if (!response.ok) {
    const message = data.message || data.error || `HTTP ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

function salePrice(cost) {
  const value = Math.max(Number(cost) * 1.85, 0.5)
  return Math.round(value * 100) / 100
}

function expiryDate(value) {
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-28`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return '2029-12-28'
}

function classifyProduct(description) {
  const text = description.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  if (/amoxicilina|azitromicina/.test(text)) return ['Medicamentos', 'Antibioticos']
  if (/paracetamol|ibuprofeno|diclofenaco/.test(text)) return ['Medicamentos', 'Analgesicos']
  if (/omeprazol|ranitidina/.test(text)) return ['Medicamentos', 'Gastrointestinal']
  if (/cetirizina|loratadina/.test(text)) return ['Medicamentos', 'Antialergicos']
  if (/metformina/.test(text)) return ['Medicamentos', 'Antidiabeticos']
  if (/losartan|enalapril|atorvastatina|simvastatina/.test(text)) return ['Medicamentos', 'Cardiometabolicos']
  if (/prednisona/.test(text)) return ['Medicamentos', 'Corticoides']
  if (/clonazepam/.test(text)) return ['Medicamentos', 'Controlados']
  if (/fluconazol/.test(text)) return ['Medicamentos', 'Antimicoticos']
  return ['Medicamentos', 'General']
}

function productName(row) {
  return `${row.item.descripcion} (${row.item.marca_laboratorio})`
}

async function ensureProvider(row, token, cache) {
  const ruc = row.proveedor.ruc
  if (cache.has(ruc)) return cache.get(ruc)

  const existing = await api(`/proveedores?q=${encodeURIComponent(ruc)}&includeInactive=true`, { token })
  const found = existing.find((provider) => String(provider.cruc || '').trim() === ruc)
  if (found) {
    cache.set(ruc, Number(found.nid))
    return Number(found.nid)
  }

  try {
    const created = await api('/proveedores', {
      token,
      method: 'POST',
      body: {
        ruc,
        nombre: row.proveedor.razon_social,
        contacto: 'Area comercial',
        telefono: '999888777',
        email: `compras+${ruc}@botica.local`,
        direccion: 'Lima',
        notas: 'Seed local operativo',
        estado: 'ACTIVO',
      },
    })
    cache.set(ruc, Number(created.id))
    return Number(created.id)
  } catch (error) {
    if (error.status !== 409) throw error
    const retry = await api(`/proveedores?q=${encodeURIComponent(ruc)}&includeInactive=true`, { token })
    const duplicate = retry.find((provider) => String(provider.cruc || '').trim() === ruc)
    if (!duplicate) throw error
    cache.set(ruc, Number(duplicate.nid))
    return Number(duplicate.nid)
  }
}

async function ensureProduct(row, providerId, token, inventoryCache) {
  const name = productName(row)
  const existing = inventoryCache.find((item) => item.name === name)
  if (existing) return Number(existing.id)

  const [family, category] = classifyProduct(row.item.descripcion)
  const created = await api('/inventario', {
    token,
    method: 'POST',
    body: {
      name,
      tipoProducto: 'MEDICAMENTO',
      generico: row.item.descripcion,
      category,
      family,
      presentacion: 'UND',
      laboratorio: row.item.marca_laboratorio,
      precioVenta1: salePrice(row.item.precio_unitario),
      precioVenta2: salePrice(row.item.precio_unitario) * 2,
      precioVenta3: null,
      stock: 0,
      minStock: Math.max(10, Math.round(row.item.cantidad * 0.08)),
      expiresAt: expiryDate(row.item.fecha_vencimiento),
      location: 'Mostrador',
      supplierId: providerId,
      rotation: 'Alta',
      receta: /clonazepam|amoxicilina|azitromicina/i.test(row.item.descripcion) ? 'S' : 'N',
    },
  })
  inventoryCache.push({ id: created.id, name })
  return Number(created.id)
}

async function ensureCaja(token) {
  const caja = await api('/caja', { token })
  if (caja.cajaAbierta) return caja.cajaAbierta.nid

  const opened = await api('/caja', {
    token,
    method: 'POST',
    body: {
      action: 'abrir',
      montoApertura: 250,
      caja: 'Caja prueba local',
      usuarioId: 1,
    },
  })
  return opened.id
}

async function main() {
  const rows = readSeedRows()
  const login = await api('/auth/login', {
    method: 'POST',
    body: { dni: '00000000', clave: '12345678' },
  })
  const token = login.token
  await ensureCaja(token)

  const providerCache = new Map()
  const inventoryCache = await api('/inventario', { token })
  const purchases = await api('/compras', { token })
  const existingDocs = new Set(purchases.map((purchase) => String(purchase.cdocumento || '').trim()))

  let providers = 0
  let products = 0
  let purchasesCreated = 0
  let purchasesSkipped = 0

  for (const row of rows) {
    const beforeProviders = providerCache.size
    const providerId = await ensureProvider(row, token, providerCache)
    if (providerCache.size > beforeProviders) providers += 1

    const beforeProducts = inventoryCache.length
    const productId = await ensureProduct(row, providerId, token, inventoryCache)
    if (inventoryCache.length > beforeProducts) products += 1

    const doc = row.factura_nro.toUpperCase()
    if (existingDocs.has(doc)) {
      purchasesSkipped += 1
      continue
    }

    const tipoPago = row.id % 3 === 0 ? 'CREDITO' : 'CONTADO'
    await api('/compras', {
      token,
      method: 'POST',
      body: {
        proveedorId: providerId,
        tipoComprobante: 'FACTURA',
        numeroDocumento: doc,
        almacenId: 1,
        tipoPago,
        fechaVencimientoFactura: tipoPago === 'CREDITO' ? '2026-09-30' : undefined,
        notas: `Seed local factura ${doc}. Emision original ${row.fecha_emision}. Codigo interno ${row.item.codigo_interno}.`,
        items: [
          {
            productoId: productId,
            cantidad: row.item.cantidad,
            precioUnit: row.item.precio_unitario,
            codigoLote: row.item.lote,
            fechaVencimiento: expiryDate(row.item.fecha_vencimiento),
            notasLote: `Proveedor ${row.proveedor.razon_social}`,
          },
        ],
      },
    })
    existingDocs.add(doc)
    purchasesCreated += 1
  }

  const inventoryAfter = await api('/inventario', { token })
  const seededProducts = inventoryAfter.filter((item) => /\(.+\)$/.test(item.name)).slice(0, 14)
  const paymentMethods = ['Efectivo', 'Yape', 'Mixto']
  let salesCreated = 0
  let salesSkipped = 0

  for (let i = 0; i < seededProducts.length; i += 1) {
    const product = seededProducts[i]
    const quantity = Math.min(3 + (i % 4), Math.max(1, Number(product.stock || 0)))
    if (quantity <= 0) {
      salesSkipped += 1
      continue
    }
    const price = Number(product.precioVenta1 || product.precioVenta || 0)
    if (price <= 0) {
      salesSkipped += 1
      continue
    }
    const total = Math.round(quantity * price * 100) / 100
    const paymentMethod = paymentMethods[i % paymentMethods.length]
    await api('/ventas', {
      token,
      method: 'POST',
      body: {
        customer: i % 3 === 0 ? 'Consumidor final' : `Cliente prueba ${i + 1}`,
        documentId: i % 3 === 0 ? '99999999' : `7${String(i + 1).padStart(7, '0')}`,
        customerMode: 'generico',
        paymentMethod,
        total,
        cashier: 'Caja principal',
        area: 'Botica',
        notes: `Seed venta local ${i + 1}`,
        almacenId: 1,
        montoEfectivo: paymentMethod === 'Mixto' ? Math.round((total / 2) * 100) / 100 : total,
        metodoPagoSecundario: 'Yape',
        items: [
          {
            productoId: Number(product.id),
            productoNombre: product.name,
            cantidad: quantity,
            precioUnitario: price,
            total,
          },
        ],
      },
    })
    salesCreated += 1
  }

  const dashboard = await api('/dashboard', { token })
  const caja = await api('/caja', { token })

  console.log(JSON.stringify({
    ok: true,
    inputRows: rows.length,
    providersTouched: providers,
    productsCreated: products,
    purchasesCreated,
    purchasesSkipped,
    salesCreated,
    salesSkipped,
    dashboard: dashboard.metrics,
    caja: caja.ventasHoy,
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    stack: error.stack,
    status: error.status,
    data: error.data,
  }, null, 2))
  process.exit(1)
})
