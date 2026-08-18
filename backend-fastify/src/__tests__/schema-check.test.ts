import { describe, it, expect } from 'vitest'
import { checkSchema, formatSchemaReport } from '../lib/schema-check.js'

function mockPool(responses: Array<{ rows: any[] }>) {
  const queue = [...responses]
  return {
    query: async (_sql: string, _params?: any[]) => {
      const next = queue.shift()
      if (!next) return { rows: [] }
      return next
    },
  }
}

const requiredTables = [
  'bot_productos',
  'bot_lotes',
  'bot_kardex',
  'bot_movimientos_almacen',
  'bot_ventas',
  'bot_ventas_det',
  'bot_compras',
  'bot_compras_det',
  'bot_caja',
  'bot_almacenes',
  'bot_locales',
  'bot_auditoria',
  'bot_familias_producto',
  'bot_categorias_producto',
  'bot_componentes_producto',
  'bot_producto_componentes',
  'bot_producto_precios',
  'bot_producto_precios_hist',
  'bot_caja_movimientos',
  'bot_cuentas_por_pagar',
  'bot_pagos_compras',
]

const requiredColumns = [
  ['bot_productos', 'npreventa_2'],
  ['bot_productos', 'npreventa_3'],
  ['bot_productos', 'nfamilia_id'],
  ['bot_productos', 'ncategoria_id'],
  ['bot_productos', 'ctipo_producto'],
  ['bot_productos', 'lrequiere_lote'],
  ['bot_productos', 'lrequiere_vencimiento'],
  ['bot_producto_precios', 'nproducto_id'],
  ['bot_producto_precios', 'cnombre'],
  ['bot_producto_precios', 'nprecio'],
  ['bot_producto_precios', 'lactivo'],
  ['bot_producto_precios_hist', 'nproducto_id'],
  ['bot_producto_precios_hist', 'cnombre'],
  ['bot_producto_precios_hist', 'nprecio_nuevo'],
  ['bot_producto_precios_hist', 'caccion'],
  ['bot_familias_producto', 'cnombre'],
  ['bot_familias_producto', 'cestado'],
  ['bot_categorias_producto', 'nfamilia_id'],
  ['bot_categorias_producto', 'cnombre'],
  ['bot_categorias_producto', 'cestado'],
  ['bot_componentes_producto', 'cnombre'],
  ['bot_componentes_producto', 'cestado'],
  ['bot_producto_componentes', 'nproducto_id'],
  ['bot_producto_componentes', 'ncomponente_id'],
  ['bot_producto_componentes', 'cconcentracion'],
  ['bot_compras', 'nalmacen_id'],
  ['bot_compras', 'ctipo_comprobante'],
  ['bot_compras', 'ctipo_pago'],
  ['bot_compras', 'tfecha_vencimiento'],
  ['bot_compras_det', 'ncompra_id'],
  ['bot_compras_det', 'nproducto_id'],
  ['bot_compras_det', 'npreunit'],
  ['bot_lotes', 'nalmacen_id'],
  ['bot_lotes', 'nprecio_compra'],
  ['bot_lotes', 'cestado'],
  ['bot_lotes', 'ncantidad'],
  ['bot_lotes', 'dfechavencimiento'],
  ['bot_kardex', 'nalmacen_id'],
  ['bot_kardex', 'nlote_id'],
  ['bot_ventas', 'nalmacen_id'],
  ['bot_ventas', 'cmetpago'],
  ['bot_ventas', 'nsubtotal'],
  ['bot_ventas', 'nigv'],
  ['bot_ventas', 'nmonto_efectivo'],
  ['bot_ventas', 'nmonto_digital'],
  ['bot_ventas', 'nvuelto'],
  ['bot_ventas', 'cmetodo_pago_secundario'],
  ['bot_ventas', 'nusuario_id'],
  ['bot_ventas_det', 'npreunit'],
  ['bot_ventas_det', 'nlote_id'],
  ['bot_ventas_det', 'clote_codigo'],
  ['bot_movimientos_almacen', 'nproducto_id'],
  ['bot_movimientos_almacen', 'nlote_id'],
  ['bot_movimientos_almacen', 'nalmacen_origen_id'],
  ['bot_movimientos_almacen', 'nalmacen_destino_id'],
  ['bot_movimientos_almacen', 'ctipo_movimiento'],
  ['bot_movimientos_almacen', 'ncantidad'],
  ['bot_movimientos_almacen', 'tcreado'],
  ['bot_almacenes', 'nlocal_id'],
  ['bot_almacenes', 'ccodigo'],
  ['bot_almacenes', 'bpermite_venta'],
  ['bot_almacenes', 'bpermite_consumo_clinico'],
  ['bot_almacenes', 'brequiere_revision'],
  ['bot_almacenes', 'ctipo_almacen'],
  ['bot_caja', 'nusuario_id'],
  ['bot_caja', 'nventas_total'],
  ['bot_caja', 'ningresos_total'],
  ['bot_caja', 'negresos_total'],
  ['bot_caja', 'npagos_factura_total'],
  ['bot_caja', 'ngastos_total'],
  ['bot_caja', 'nsaldo_esperado'],
  ['bot_caja', 'ndiferencia'],
  ['bot_caja', 'ncerrado_por_id'],
  ['bot_caja', 'ccerrado_por'],
  ['bot_caja_movimientos', 'ncaja_id'],
  ['bot_caja_movimientos', 'ctipo'],
  ['bot_caja_movimientos', 'nmonto'],
  ['bot_caja_movimientos', 'cestado'],
  ['bot_cuentas_por_pagar', 'ncompra_id'],
  ['bot_cuentas_por_pagar', 'nmonto_total'],
  ['bot_cuentas_por_pagar', 'nmonto_pagado'],
  ['bot_cuentas_por_pagar', 'nsaldo'],
  ['bot_cuentas_por_pagar', 'cestado'],
  ['bot_pagos_compras', 'ncxp_id'],
  ['bot_pagos_compras', 'nmonto'],
  ['bot_pagos_compras', 'cmetodo_pago'],
  ['bot_pagos_compras', 'cestado'],
]

function tableRows(exclude: string[] = []) {
  return requiredTables
    .filter((table) => !exclude.includes(table))
    .map((tablename) => ({ tablename }))
}

function columnRows(exclude: Array<[string, string]> = []) {
  return requiredColumns
    .filter(([table, column]) => !exclude.some(([t, c]) => t === table && c === column))
    .map(([table_name, column_name]) => ({ table_name, column_name }))
}

function poolAllOk() {
  return mockPool([
    { rows: tableRows() },
    { rows: columnRows() },
  ])
}

describe('checkSchema', () => {
  it('returns ok=true when all tables and columns exist', async () => {
    const result = await checkSchema(poolAllOk())
    expect(result.ok).toBe(true)
    expect(result.missingTables).toHaveLength(0)
    expect(result.missingColumns).toHaveLength(0)
    expect(result.summary).toContain('Schema OK')
  })

  it('detects missing table bot_caja_movimientos from migration 020', async () => {
    const result = await checkSchema(mockPool([
      { rows: tableRows(['bot_caja_movimientos']) },
      { rows: columnRows() },
    ]))

    expect(result.ok).toBe(false)
    expect(result.missingTables).toHaveLength(1)
    expect(result.missingTables[0].table).toBe('bot_caja_movimientos')
    expect(result.missingColumns).toHaveLength(0)
  })

  it('detects missing column bot_compras.nalmacen_id', async () => {
    const result = await checkSchema(mockPool([
      { rows: tableRows() },
      { rows: columnRows([['bot_compras', 'nalmacen_id']]) },
    ]))

    expect(result.ok).toBe(false)
    expect(result.missingTables).toHaveLength(0)
    expect(result.missingColumns).toHaveLength(1)
    expect(result.missingColumns[0].table).toBe('bot_compras')
    expect(result.missingColumns[0].column).toBe('nalmacen_id')
  })

  it('checks real almacenes flags from baseline, not legacy lpermite names', async () => {
    const result = await checkSchema(poolAllOk())

    expect(result.ok).toBe(true)
    expect(requiredColumns).toContainEqual(['bot_almacenes', 'bpermite_venta'])
    expect(requiredColumns).toContainEqual(['bot_almacenes', 'bpermite_consumo_clinico'])
    expect(requiredColumns.some(([, column]) => column === 'lpermite_venta')).toBe(false)
    expect(requiredColumns.some(([, column]) => column === 'lpermite_consumo_clinico')).toBe(false)
  })

  it('detects multiple missing columns simultaneously', async () => {
    const result = await checkSchema(mockPool([
      { rows: tableRows() },
      { rows: [] },
    ]))

    expect(result.ok).toBe(false)
    expect(result.missingColumns.length).toBeGreaterThan(0)
    expect(result.summary).toContain('INCOMPLETO')
  })

  it('does not check columns for missing tables', async () => {
    const result = await checkSchema(mockPool([
      { rows: [] },
      { rows: [] },
    ]))

    expect(result.ok).toBe(false)
    expect(result.missingTables).toHaveLength(requiredTables.length)
    expect(result.missingColumns).toHaveLength(0)
  })
})

describe('formatSchemaReport', () => {
  it('includes OK status when schema is clean', async () => {
    const result = await checkSchema(poolAllOk())
    const report = formatSchemaReport(result)
    expect(report).toContain('OK')
    expect(report).toContain('Schema OK')
  })

  it('lists missing tables and columns when schema is broken', () => {
    const report = formatSchemaReport({
      ok: false,
      checkedAt: '2026-01-01T00:00:00.000Z',
      missingTables: [{ table: 'bot_caja_movimientos', description: 'Movimientos de caja' }],
      missingColumns: [{ table: 'bot_compras', column: 'nalmacen_id', description: 'Almacen de destino' }],
      summary: 'Schema INCOMPLETO - 1 tabla(s) y 1 columna(s) faltantes',
    })
    expect(report).toContain('INCOMPLETO')
    expect(report).toContain('bot_caja_movimientos')
    expect(report).toContain('bot_compras.nalmacen_id')
  })
})
