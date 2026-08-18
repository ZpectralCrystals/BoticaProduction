#!/usr/bin/env node
/**
 * check-schema.js — Verificación de schema de Botica El Pueblo
 *
 * Uso:
 *   node check-schema.js
 *   node check-schema.js --json
 *
 * Variables de entorno leídas (mismas que el servidor):
 *   BOTICA_DB_HOST / DB_HOST   (default: localhost)
 *   BOTICA_DB_PORT / DB_PORT   (default: 5432)
 *   BOTICA_DB_NAME / DB_NAME   (default: botica_db)
 *   BOTICA_DB_USER / DB_USER   (default: postgres)
 *   BOTICA_DB_PASS / DB_PASS   (default: '')
 *
 * Códigos de salida:
 *   0 — Schema OK
 *   1 — Schema incompleto (faltan tablas o columnas)
 *   2 — Error de conexión a la base de datos
 */

import pg from 'pg'
const { Pool } = pg

const REQUIRED_TABLES = [
  { table: 'bot_productos',           description: 'Catálogo de productos' },
  { table: 'bot_lotes',               description: 'Lotes de productos por almacén' },
  { table: 'bot_kardex',              description: 'Libro de movimientos de stock' },
  { table: 'bot_movimientos_almacen', description: 'Movimientos físicos entre almacenes' },
  { table: 'bot_ventas',              description: 'Cabecera de ventas' },
  { table: 'bot_ventas_det',          description: 'Detalle de líneas de venta' },
  { table: 'bot_compras',             description: 'Cabecera de compras' },
  { table: 'bot_almacenes',           description: 'Almacenes por local' },
  { table: 'bot_locales',             description: 'Locales/sedes' },
  { table: 'bot_auditoria',           description: 'Registro de auditoría' },
]

const REQUIRED_COLUMNS = [
  { table: 'bot_compras',             column: 'nalmacen_id',        description: 'Almacén de destino de la compra' },
  { table: 'bot_compras',             column: 'ctipo_comprobante',   description: 'Tipo de comprobante (FACTURA/BOLETA/GUIA)' },
  { table: 'bot_lotes',               column: 'nalmacen_id',         description: 'Almacén donde reside el lote' },
  { table: 'bot_lotes',               column: 'cestado',             description: 'Estado del lote (ACTIVO/AGOTADO/VENCIDO)' },
  { table: 'bot_lotes',               column: 'ncantidad',           description: 'Cantidad actual del lote' },
  { table: 'bot_lotes',               column: 'dfechavencimiento',   description: 'Fecha de vencimiento del lote' },
  { table: 'bot_kardex',              column: 'nalmacen_id',         description: 'Almacén asociado al movimiento kardex' },
  { table: 'bot_kardex',              column: 'nlote_id',            description: 'Lote asociado al movimiento kardex' },
  { table: 'bot_ventas',              column: 'nalmacen_id',         description: 'Almacén desde donde se realizó la venta' },
  { table: 'bot_movimientos_almacen', column: 'nproducto_id',        description: 'Producto del movimiento' },
  { table: 'bot_movimientos_almacen', column: 'ctipo_movimiento',    description: 'Tipo de movimiento (VENTA/COMPRA/TRASLADO/...)' },
  { table: 'bot_movimientos_almacen', column: 'ncantidad',           description: 'Cantidad movida' },
  { table: 'bot_almacenes',           column: 'bpermite_venta',      description: 'Flag: este almacén permite ventas' },
  { table: 'bot_almacenes',           column: 'ctipo_almacen',       description: 'Tipo de almacén (DISPONIBLE/CUARENTENA/BAJA/...)' },
]

async function checkSchema(pool) {
  const missingTables = []
  const missingColumns = []

  const tableNames = REQUIRED_TABLES.map(t => t.table)
  const tablesResult = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [tableNames],
  )
  const existingTables = new Set(tablesResult.rows.map(r => r.tablename))

  for (const req of REQUIRED_TABLES) {
    if (!existingTables.has(req.table)) {
      missingTables.push({ table: req.table, description: req.description })
    }
  }

  const colPairs = REQUIRED_COLUMNS
    .filter(c => existingTables.has(c.table))
    .map(c => `${c.table}.${c.column}`)

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
    const existingCols = new Set(colResult.rows.map(r => `${r.table_name}.${r.column_name}`))
    for (const req of REQUIRED_COLUMNS) {
      const key = `${req.table}.${req.column}`
      if (existingTables.has(req.table) && !existingCols.has(key)) {
        missingColumns.push({ table: req.table, column: req.column, description: req.description })
      }
    }
  }

  return {
    ok: missingTables.length === 0 && missingColumns.length === 0,
    checkedAt: new Date().toISOString(),
    missingTables,
    missingColumns,
    summary: missingTables.length === 0 && missingColumns.length === 0
      ? `Schema OK — ${REQUIRED_TABLES.length} tablas y ${REQUIRED_COLUMNS.length} columnas verificadas`
      : `Schema INCOMPLETO — ${missingTables.length} tabla(s) y ${missingColumns.length} columna(s) faltantes`,
  }
}

async function main() {
  const jsonMode = process.argv.includes('--json')

  const pool = new Pool({
    host:     process.env.BOTICA_DB_HOST || process.env.DB_HOST || 'localhost',
    port:     Number(process.env.BOTICA_DB_PORT || process.env.DB_PORT || 5432),
    database: process.env.BOTICA_DB_NAME || process.env.DB_NAME || 'botica_db',
    user:     process.env.BOTICA_DB_USER || process.env.DB_USER || process.env.USER || 'postgres',
    password: process.env.BOTICA_DB_PASS || process.env.DB_PASS || '',
    connectionTimeoutMillis: 5000,
  })

  let result
  try {
    await pool.query('SELECT 1') // connectivity check
    result = await checkSchema(pool)
  } catch (err) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ ok: false, error: err.message }, null, 2) + '\n')
    } else {
      process.stderr.write(`\n[ERROR] No se pudo conectar a la base de datos:\n  ${err.message}\n\n`)
    }
    await pool.end().catch(() => {})
    process.exit(2)
  }

  await pool.end().catch(() => {})

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exit(result.ok ? 0 : 1)
  }

  // Human-readable output
  const lines = [
    '',
    '══════════════════════════════════════════════',
    `  Schema Check — ${result.checkedAt}`,
    '══════════════════════════════════════════════',
    `  Estado : ${result.ok ? '✅ OK' : '❌ INCOMPLETO'}`,
    `  Resumen: ${result.summary}`,
    '',
  ]

  if (result.missingTables.length > 0) {
    lines.push('  ── TABLAS FALTANTES ──────────────────────')
    for (const t of result.missingTables) {
      lines.push(`  ❌  ${t.table}`)
      lines.push(`       Descripción: ${t.description}`)
    }
    lines.push('')
  }

  if (result.missingColumns.length > 0) {
    lines.push('  ── COLUMNAS FALTANTES ────────────────────')
    for (const c of result.missingColumns) {
      lines.push(`  ❌  ${c.table}.${c.column}`)
      lines.push(`       Descripción: ${c.description}`)
    }
    lines.push('')
  }

  if (result.ok) {
    lines.push('  ✅ Todas las tablas y columnas requeridas existen.')
    lines.push('     El servidor puede arrancar correctamente.')
  } else {
    lines.push('  ⚠️  Ejecuta las migraciones pendientes antes de arrancar el servidor.')
    lines.push('')
    lines.push('  Migraciones comunes:')
    for (const t of result.missingTables) {
      lines.push(`    CREATE TABLE ${t.table} (...);`)
    }
    for (const c of result.missingColumns) {
      lines.push(`    ALTER TABLE ${c.table} ADD COLUMN ${c.column} ...;`)
    }
  }

  lines.push('')
  lines.push('══════════════════════════════════════════════')
  lines.push('')

  process.stdout.write(lines.join('\n'))
  process.exit(result.ok ? 0 : 1)
}

main()
