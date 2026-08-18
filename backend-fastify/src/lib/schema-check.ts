// Minimal queryable interface — pg.Pool satisfies this, and it's easy to mock in tests
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema requirements definition
// ─────────────────────────────────────────────────────────────────────────────

export interface ColumnRequirement {
  table: string
  column: string
  description: string
}

export interface TableRequirement {
  table: string
  description: string
}

export interface SchemaCheckResult {
  ok: boolean
  checkedAt: string
  missingTables: Array<{ table: string; description: string }>
  missingColumns: Array<{ table: string; column: string; description: string }>
  summary: string
}

// Tables that must exist
const REQUIRED_TABLES: TableRequirement[] = [
  { table: 'bot_productos',          description: 'Catálogo de productos' },
  { table: 'bot_lotes',              description: 'Lotes de productos por almacén' },
  { table: 'bot_kardex',             description: 'Libro de movimientos de stock' },
  { table: 'bot_movimientos_almacen',description: 'Movimientos físicos entre almacenes' },
  { table: 'bot_ventas',             description: 'Cabecera de ventas' },
  { table: 'bot_ventas_det',         description: 'Detalle de líneas de venta' },
  { table: 'bot_compras',            description: 'Cabecera de compras' },
  { table: 'bot_compras_det',        description: 'Detalle de líneas de compra' },
  { table: 'bot_caja',               description: 'Sesiones de caja' },
  { table: 'bot_almacenes',          description: 'Almacenes por local' },
  { table: 'bot_locales',            description: 'Locales/sedes' },
  { table: 'bot_auditoria',          description: 'Registro de auditoría' },
  { table: 'bot_familias_producto',  description: 'Catálogo de familias de productos' },
  { table: 'bot_categorias_producto', description: 'Catálogo de categorías de productos' },
  { table: 'bot_componentes_producto', description: 'Catálogo de componentes/principios activos' },
  { table: 'bot_producto_componentes', description: 'Relación de productos con componentes' },
  { table: 'bot_producto_precios', description: 'Precios comerciales por producto' },
  { table: 'bot_producto_precios_hist', description: 'Historial de cambios de precios' },
  { table: 'bot_caja_movimientos', description: 'Movimientos detallados de caja' },
  { table: 'bot_cuentas_por_pagar', description: 'Cuentas por pagar a proveedores' },
  { table: 'bot_pagos_compras', description: 'Pagos aplicados a cuentas por pagar' },
]

// Columns added in recent migrations — most likely culprits for runtime 500s
const REQUIRED_COLUMNS: ColumnRequirement[] = [
  // Precios comerciales multiples
  { table: 'bot_productos',          column: 'npreventa_2',        description: 'Precio de venta opcional 2' },
  { table: 'bot_productos',          column: 'npreventa_3',        description: 'Precio de venta opcional 3' },
  { table: 'bot_productos',          column: 'nfamilia_id',        description: 'Familia de catálogo asociada al producto' },
  { table: 'bot_productos',          column: 'ncategoria_id',      description: 'Categoría de catálogo asociada al producto' },
  { table: 'bot_productos',          column: 'ctipo_producto',      description: 'Clasificación MEDICAMENTO/NO_MEDICAMENTO' },
  { table: 'bot_productos',          column: 'lrequiere_lote',      description: 'Flag de control de lote por producto' },
  { table: 'bot_productos',          column: 'lrequiere_vencimiento', description: 'Flag de control de vencimiento por producto' },

  // Tablas canonicas de precios
  { table: 'bot_producto_precios',   column: 'nproducto_id',        description: 'Producto asociado al precio comercial' },
  { table: 'bot_producto_precios',   column: 'cnombre',             description: 'Slot de precio comercial' },
  { table: 'bot_producto_precios',   column: 'nprecio',             description: 'Monto del precio comercial' },
  { table: 'bot_producto_precios',   column: 'lactivo',             description: 'Estado activo del precio comercial' },
  { table: 'bot_producto_precios_hist', column: 'nproducto_id',      description: 'Producto asociado al historial de precio' },
  { table: 'bot_producto_precios_hist', column: 'cnombre',           description: 'Slot de precio auditado' },
  { table: 'bot_producto_precios_hist', column: 'nprecio_nuevo',     description: 'Nuevo precio auditado' },
  { table: 'bot_producto_precios_hist', column: 'caccion',           description: 'Acción de historial de precio' },

  // Catálogos de productos
  { table: 'bot_familias_producto',  column: 'cnombre',            description: 'Nombre de familia de producto' },
  { table: 'bot_familias_producto',  column: 'cestado',            description: 'Estado lógico de familia' },
  { table: 'bot_categorias_producto', column: 'nfamilia_id',        description: 'Familia asociada a la categoría' },
  { table: 'bot_categorias_producto', column: 'cnombre',            description: 'Nombre de categoría de producto' },
  { table: 'bot_categorias_producto', column: 'cestado',            description: 'Estado lógico de categoría' },
  { table: 'bot_componentes_producto', column: 'cnombre',            description: 'Nombre de componente/principio activo' },
  { table: 'bot_componentes_producto', column: 'cestado',            description: 'Estado lógico de componente' },
  { table: 'bot_producto_componentes', column: 'nproducto_id',       description: 'Producto asociado al componente' },
  { table: 'bot_producto_componentes', column: 'ncomponente_id',     description: 'Componente asociado al producto' },
  { table: 'bot_producto_componentes', column: 'cconcentracion',     description: 'Concentración del componente en el producto' },

  // Almacén en compras
  { table: 'bot_compras',            column: 'nalmacen_id',        description: 'Almacén de destino de la compra' },
  { table: 'bot_compras',            column: 'ctipo_comprobante',   description: 'Tipo de comprobante (FACTURA/BOLETA/GUIA)' },
  { table: 'bot_compras',            column: 'ctipo_pago',          description: 'Condición de pago CONTADO/CREDITO' },
  { table: 'bot_compras',            column: 'tfecha_vencimiento',  description: 'Fecha de vencimiento de factura de compra crédito' },
  { table: 'bot_compras_det',        column: 'ncompra_id',          description: 'Compra asociada al detalle' },
  { table: 'bot_compras_det',        column: 'nproducto_id',        description: 'Producto comprado' },
  { table: 'bot_compras_det',        column: 'npreunit',            description: 'Precio unitario real del detalle de compra' },

  // Almacén en lotes (fuente de verdad de ubicación)
  { table: 'bot_lotes',              column: 'nalmacen_id',         description: 'Almacén donde reside el lote' },
  { table: 'bot_lotes',              column: 'nprecio_compra',      description: 'Costo real de compra por lote' },
  { table: 'bot_lotes',              column: 'cestado',             description: 'Estado del lote (ACTIVO/AGOTADO/VENCIDO)' },
  { table: 'bot_lotes',              column: 'ncantidad',           description: 'Cantidad actual del lote' },
  { table: 'bot_lotes',              column: 'dfechavencimiento',   description: 'Fecha de vencimiento del lote' },

  // Almacén en kardex (trazabilidad por almacén)
  { table: 'bot_kardex',             column: 'nalmacen_id',         description: 'Almacén asociado al movimiento kardex' },
  { table: 'bot_kardex',             column: 'nlote_id',            description: 'Lote asociado al movimiento kardex' },

  // Almacén en ventas
  { table: 'bot_ventas',             column: 'nalmacen_id',         description: 'Almacén desde donde se realizó la venta' },
  { table: 'bot_ventas',             column: 'cmetpago',            description: 'Método de pago de venta' },
  { table: 'bot_ventas',             column: 'nsubtotal',           description: 'Subtotal de venta' },
  { table: 'bot_ventas',             column: 'nigv',                description: 'IGV de venta' },
  { table: 'bot_ventas',             column: 'nmonto_efectivo',     description: 'Monto efectivo recibido en venta' },
  { table: 'bot_ventas',             column: 'nmonto_digital',      description: 'Monto digital/tarjeta recibido en venta' },
  { table: 'bot_ventas',             column: 'nvuelto',             description: 'Vuelto entregado en venta' },
  { table: 'bot_ventas',             column: 'cmetodo_pago_secundario', description: 'Método secundario para pago mixto' },
  { table: 'bot_ventas',             column: 'nusuario_id',         description: 'Usuario que registró la venta' },
  { table: 'bot_ventas_det',         column: 'npreunit',            description: 'Precio unitario real del detalle de venta' },
  { table: 'bot_ventas_det',         column: 'nlote_id',            description: 'Lote consumido por la venta' },
  { table: 'bot_ventas_det',         column: 'clote_codigo',        description: 'Código de lote consumido por la venta' },

  // Movimientos de almacén (columnas principales)
  { table: 'bot_movimientos_almacen', column: 'nproducto_id',       description: 'Producto del movimiento' },
  { table: 'bot_movimientos_almacen', column: 'nlote_id',           description: 'Lote del movimiento' },
  { table: 'bot_movimientos_almacen', column: 'nalmacen_origen_id', description: 'Almacén origen del movimiento' },
  { table: 'bot_movimientos_almacen', column: 'nalmacen_destino_id', description: 'Almacén destino del movimiento' },
  { table: 'bot_movimientos_almacen', column: 'ctipo_movimiento',   description: 'Tipo de movimiento (VENTA/COMPRA/TRASLADO/...)' },
  { table: 'bot_movimientos_almacen', column: 'ncantidad',          description: 'Cantidad movida' },
  { table: 'bot_movimientos_almacen', column: 'tcreado',            description: 'Fecha de creación del movimiento' },

  // Almacenes
  { table: 'bot_almacenes',          column: 'nlocal_id',           description: 'Local asociado al almacén' },
  { table: 'bot_almacenes',          column: 'ccodigo',             description: 'Código único del almacén' },
  { table: 'bot_almacenes',          column: 'bpermite_venta',      description: 'Flag: este almacén permite ventas' },
  { table: 'bot_almacenes',          column: 'bpermite_consumo_clinico', description: 'Flag: este almacén permite consumo clínico' },
  { table: 'bot_almacenes',          column: 'brequiere_revision',  description: 'Flag: este almacén requiere revisión' },
  { table: 'bot_almacenes',          column: 'ctipo_almacen',       description: 'Tipo de almacén (DISPONIBLE/CUARENTENA/BAJA/...)' },

  // Caja asignada, movimientos y cierre persistente
  { table: 'bot_caja',               column: 'nusuario_id',         description: 'Usuario/cajero asignado a la caja' },
  { table: 'bot_caja',               column: 'nventas_total',       description: 'Snapshot de ventas al cierre' },
  { table: 'bot_caja',               column: 'ningresos_total',     description: 'Snapshot de ingresos manuales al cierre' },
  { table: 'bot_caja',               column: 'negresos_total',      description: 'Snapshot de egresos manuales al cierre' },
  { table: 'bot_caja',               column: 'npagos_factura_total', description: 'Snapshot de pagos de factura al cierre' },
  { table: 'bot_caja',               column: 'ngastos_total',       description: 'Snapshot de gastos al cierre' },
  { table: 'bot_caja',               column: 'nsaldo_esperado',     description: 'Saldo esperado persistido al cierre' },
  { table: 'bot_caja',               column: 'ndiferencia',         description: 'Diferencia persistida al cierre' },
  { table: 'bot_caja',               column: 'ncerrado_por_id',     description: 'Usuario que cerró caja' },
  { table: 'bot_caja',               column: 'ccerrado_por',        description: 'Nombre del usuario que cerró caja' },
  { table: 'bot_caja_movimientos',   column: 'ncaja_id',            description: 'Caja asociada al movimiento' },
  { table: 'bot_caja_movimientos',   column: 'ctipo',               description: 'Tipo de movimiento de caja' },
  { table: 'bot_caja_movimientos',   column: 'nmonto',              description: 'Monto de movimiento de caja' },
  { table: 'bot_caja_movimientos',   column: 'cestado',             description: 'Estado lógico del movimiento de caja' },

  // Cuentas por pagar
  { table: 'bot_cuentas_por_pagar',  column: 'ncompra_id',          description: 'Compra origen de la cuenta por pagar' },
  { table: 'bot_cuentas_por_pagar',  column: 'nmonto_total',        description: 'Monto total de la cuenta por pagar' },
  { table: 'bot_cuentas_por_pagar',  column: 'nmonto_pagado',       description: 'Monto pagado acumulado' },
  { table: 'bot_cuentas_por_pagar',  column: 'nsaldo',              description: 'Saldo generado de la cuenta por pagar' },
  { table: 'bot_cuentas_por_pagar',  column: 'cestado',             description: 'Estado de la cuenta por pagar' },
  { table: 'bot_pagos_compras',      column: 'ncxp_id',             description: 'Cuenta por pagar asociada al pago' },
  { table: 'bot_pagos_compras',      column: 'nmonto',              description: 'Monto del pago de cuenta por pagar' },
  { table: 'bot_pagos_compras',      column: 'cmetodo_pago',        description: 'Método de pago de cuenta por pagar' },
  { table: 'bot_pagos_compras',      column: 'cestado',             description: 'Estado lógico del pago de compra' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Main check function
// ─────────────────────────────────────────────────────────────────────────────

export async function checkSchema(pool: Queryable): Promise<SchemaCheckResult> {
  const missingTables: SchemaCheckResult['missingTables'] = []
  const missingColumns: SchemaCheckResult['missingColumns'] = []

  // 1. Check tables via pg_tables (schema-independent)
  const tableNames = REQUIRED_TABLES.map((t) => t.table)
  const tablesResult = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [tableNames],
  )
  const existingTables = new Set(tablesResult.rows.map((r) => r.tablename))

  for (const req of REQUIRED_TABLES) {
    if (!existingTables.has(req.table)) {
      missingTables.push({ table: req.table, description: req.description })
    }
  }

  // 2. Check columns via information_schema (only for tables that exist)
  const colPairs = REQUIRED_COLUMNS
    .filter((c) => existingTables.has(c.table))
    .map((c) => `${c.table}.${c.column}`)

  if (colPairs.length > 0) {
    const colResult = await pool.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name, column_name) = ANY(
           SELECT split_part(v, '.', 1), split_part(v, '.', 2)
           FROM unnest($1::text[]) AS v
         )`,
      [colPairs],
    )

    const existingCols = new Set(
      colResult.rows.map((r) => `${r.table_name}.${r.column_name}`),
    )

    for (const req of REQUIRED_COLUMNS) {
      const key = `${req.table}.${req.column}`
      if (existingTables.has(req.table) && !existingCols.has(key)) {
        missingColumns.push({ table: req.table, column: req.column, description: req.description })
      }
    }
  }

  const ok = missingTables.length === 0 && missingColumns.length === 0
  const totalIssues = missingTables.length + missingColumns.length

  return {
    ok,
    checkedAt: new Date().toISOString(),
    missingTables,
    missingColumns,
    summary: ok
      ? `Schema OK — ${REQUIRED_TABLES.length} tablas y ${REQUIRED_COLUMNS.length} columnas verificadas`
      : `Schema INCOMPLETO — ${missingTables.length} tabla(s) y ${missingColumns.length} columna(s) faltantes (${totalIssues} total)`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pretty-print for CLI use
// ─────────────────────────────────────────────────────────────────────────────

export function formatSchemaReport(result: SchemaCheckResult): string {
  const lines: string[] = []
  lines.push('')
  lines.push('══════════════════════════════════════════════')
  lines.push(`  Schema Check — ${result.checkedAt}`)
  lines.push('══════════════════════════════════════════════')
  lines.push(`  Estado : ${result.ok ? '✅ OK' : '❌ INCOMPLETO'}`)
  lines.push(`  Resumen: ${result.summary}`)
  lines.push('')

  if (result.missingTables.length > 0) {
    lines.push('  ── TABLAS FALTANTES ──────────────────────')
    for (const t of result.missingTables) {
      lines.push(`  ❌  ${t.table}`)
      lines.push(`       ${t.description}`)
    }
    lines.push('')
  }

  if (result.missingColumns.length > 0) {
    lines.push('  ── COLUMNAS FALTANTES ────────────────────')
    for (const c of result.missingColumns) {
      lines.push(`  ❌  ${c.table}.${c.column}`)
      lines.push(`       ${c.description}`)
    }
    lines.push('')
  }

  if (result.ok) {
    lines.push('  ✅ Todas las tablas y columnas requeridas existen.')
    lines.push('')
  } else {
    lines.push('  ⚠️  Ejecuta las migraciones pendientes antes de arrancar.')
    lines.push('')
  }

  lines.push('══════════════════════════════════════════════')
  lines.push('')
  return lines.join('\n')
}
