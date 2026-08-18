import { pgTable, serial, varchar, text, integer, numeric, boolean, timestamp, date } from 'drizzle-orm/pg-core'

// ══════════════════════════════════════════════════════════════════════════════
// SCHEMA DRIZZLE — Botica El Pueblo ERP
// Generado desde estructura PostgreSQL existente
// ══════════════════════════════════════════════════════════════════════════════

// ─── Usuarios y Autenticación ─────────────────────────────────────────────────

export const usuarios = pgTable('bot_usuarios', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 100 }).notNull(),
  cnrodni: varchar('cnrodni', { length: 8 }).notNull().unique(),
  cclave: varchar('cclave', { length: 255 }).notNull(),
  cemail: varchar('cemail', { length: 120 }),
  cclerkUserId: varchar('cclerk_user_id', { length: 255 }),
  crol: varchar('crol', { length: 50 }).notNull().default('vendedor'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  lsuper: boolean('lsuper').notNull().default(false),
  ladmin: boolean('ladmin').notNull().default(false),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

export const permisos = pgTable('bot_permisos', {
  nid: serial('nid').primaryKey(),
  nusuarioId: integer('nusuario_id').notNull().references(() => usuarios.nid),
  cseccion: varchar('cseccion', { length: 50 }).notNull(),
})

// ─── Locales y Almacenes ──────────────────────────────────────────────────────

export const locales = pgTable('bot_locales', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 120 }).notNull(),
  ccodigo: varchar('ccodigo', { length: 20 }).notNull().unique(),
  ctipoLocal: varchar('ctipo_local', { length: 20 }).notNull().default('BOTICA'),
  cdireccion: varchar('cdireccion', { length: 250 }),
  ctelefono: varchar('ctelefono', { length: 30 }),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

export const almacenes = pgTable('bot_almacenes', {
  nid: serial('nid').primaryKey(),
  nlocalId: integer('nlocal_id').notNull().references(() => locales.nid),
  cnombre: varchar('cnombre', { length: 120 }).notNull(),
  ccodigo: varchar('ccodigo', { length: 30 }).notNull().unique(),
  ctipoAlmacen: varchar('ctipo_almacen', { length: 30 }).notNull().default('DISPONIBLE'),
  bpermiteVenta: boolean('bpermite_venta').notNull().default(false),
  bpermiteConsumoClinico: boolean('bpermite_consumo_clinico').notNull().default(false),
  brequiereRevision: boolean('brequiere_revision').notNull().default(false),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Proveedores ──────────────────────────────────────────────────────────────

export const proveedores = pgTable('bot_proveedores', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 100 }).notNull(),
  cruc: varchar('cruc', { length: 11 }),
  cdireccion: varchar('cdireccion', { length: 255 }),
  ctelefono: varchar('ctelefono', { length: 20 }),
  cemail: varchar('cemail', { length: 100 }),
  ccontacto: varchar('ccontacto', { length: 100 }),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Catálogos de Producto ───────────────────────────────────────────────────

export const familiasProducto = pgTable('bot_familias_producto', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 100 }).notNull(),
  cdescripcion: text('cdescripcion'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

export const categoriasProducto = pgTable('bot_categorias_producto', {
  nid: serial('nid').primaryKey(),
  nfamiliaId: integer('nfamilia_id').references(() => familiasProducto.nid),
  cnombre: varchar('cnombre', { length: 100 }).notNull(),
  cdescripcion: text('cdescripcion'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

export const componentesProducto = pgTable('bot_componentes_producto', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 150 }).notNull(),
  cdescripcion: text('cdescripcion'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Productos ────────────────────────────────────────────────────────────────
// NOTA: columnas verificadas contra SQL raw de inventory.routes.ts y purchases.routes.ts

export const productos = pgTable('bot_productos', {
  nid: serial('nid').primaryKey(),
  ccodigo: varchar('ccodigo', { length: 20 }).notNull().unique(),
  cnombre: varchar('cnombre', { length: 200 }).notNull(),
  cgenerico: varchar('cgenerico', { length: 200 }),
  ccategoria: varchar('ccategoria', { length: 50 }).notNull().default('Medicamentos'),
  ctipoProducto: varchar('ctipo_producto', { length: 30 }).notNull().default('MEDICAMENTO'),
  cfamilia: varchar('cfamilia', { length: 100 }),
  nfamiliaId: integer('nfamilia_id').references(() => familiasProducto.nid),
  ncategoriaId: integer('ncategoria_id').references(() => categoriasProducto.nid),
  cpresenta: varchar('cpresenta', { length: 100 }),          // era cpresentacion (incorrecto)
  claborat: varchar('claborat', { length: 100 }),            // era claboratorio (incorrecto)
  nprecompra: numeric('nprecompra', { precision: 10, scale: 2 }).default('0'),  // era nprecio_compra
  npreventa: numeric('npreventa', { precision: 10, scale: 2 }).default('0'),    // era nprecio_venta
  npreventa2: numeric('npreventa_2', { precision: 10, scale: 2 }),
  npreventa3: numeric('npreventa_3', { precision: 10, scale: 2 }),
  nstock: integer('nstock').default(0),
  nstockmin: integer('nstockmin').default(0),      // era nstock_minimo
  cubicacion: varchar('cubicacion', { length: 50 }),
  cproveedor: varchar('cproveedor', { length: 100 }),        // campo denormalizado (faltaba)
  nproveedorId: integer('nproveedor_id').references(() => proveedores.nid),
  crotacion: varchar('crotacion', { length: 10 }).notNull().default('Media'),
  tvencimien: date('tvencimien'),                            // fecha vencimiento (faltaba)
  creceta: varchar('creceta', { length: 1 }).notNull().default('N'),
  lrequiereLote: boolean('lrequiere_lote').notNull().default(true),              // migración 018
  lrequiereVencimiento: boolean('lrequiere_vencimiento').notNull().default(true), // migración 018
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Precios de venta (canónico — migración 019) ──────────────────────────────

export const productoPrecios = pgTable('bot_producto_precios', {
  nid: serial('nid').primaryKey(),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  cnombre: varchar('cnombre', { length: 20 }).notNull(),         // PRECIO_1|PRECIO_2|PRECIO_3
  nprecio: numeric('nprecio', { precision: 10, scale: 2 }).notNull().default('0'),
  lactivo: boolean('lactivo').notNull().default(true),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  cusuario: varchar('cusuario', { length: 100 }),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

export const productoPreciosHist = pgTable('bot_producto_precios_hist', {
  nid: serial('nid').primaryKey(),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  cnombre: varchar('cnombre', { length: 20 }).notNull(),
  nprecioAnterior: numeric('nprecio_anterior', { precision: 10, scale: 2 }),
  nprecioNuevo: numeric('nprecio_nuevo', { precision: 10, scale: 2 }).notNull(),
  caccion: varchar('caccion', { length: 20 }).notNull().default('UPDATE'),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  cusuario: varchar('cusuario', { length: 100 }),
  tcreado: timestamp('tcreado').defaultNow(),
})

export const productoComponentes = pgTable('bot_producto_componentes', {
  nid: serial('nid').primaryKey(),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  ncomponenteId: integer('ncomponente_id').notNull().references(() => componentesProducto.nid),
  cconcentracion: varchar('cconcentracion', { length: 80 }),
  cforma: varchar('cforma', { length: 80 }),
  cnotas: text('cnotas'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Lotes ────────────────────────────────────────────────────────────────────

export const lotes = pgTable('bot_lotes', {
  nid: serial('nid').primaryKey(),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  nalmacenId: integer('nalmacen_id').references(() => almacenes.nid),
  ncompraId: integer('ncompra_id'),                              // FK opcional, migración 004
  ccodigoLote: varchar('ccodigo_lote', { length: 100 }),
  ncantidad: integer('ncantidad').notNull().default(0),
  ncantidadInicial: integer('ncantidad_inicial').notNull().default(0),
  nprecioCompra: numeric('nprecio_compra', { precision: 10, scale: 2 }).notNull().default('0'), // migración 018
  dfechavencimiento: date('dfechavencimiento').notNull(),
  cestado: varchar('cestado', { length: 10 }).notNull().default('ACTIVO'),
  cnotas: text('cnotas'),
  nversion: integer('nversion').notNull().default(1),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Compras ──────────────────────────────────────────────────────────────────

export const compras = pgTable('bot_compras', {
  nid: serial('nid').primaryKey(),
  ccodigo: varchar('ccodigo', { length: 20 }).notNull().unique(),
  nproveedorId: integer('nproveedor_id').references(() => proveedores.nid),
  nalmacenId: integer('nalmacen_id').references(() => almacenes.nid),
  cproveedor: varchar('cproveedor', { length: 200 }),
  ctipoComprobante: varchar('ctipo_comprobante', { length: 20 }).default('FACTURA'),
  cdocumento: varchar('cdocumento', { length: 50 }),
  ctipoPago: varchar('ctipo_pago', { length: 10 }).notNull().default('CONTADO'),    // migración 018
  tfechaVencimiento: date('tfecha_vencimiento'),                                     // migración 018
  ntotal: numeric('ntotal', { precision: 12, scale: 2 }).default('0'),
  cnotas: text('cnotas'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  nusuarioId: integer('nusuario_id'),
  tcreado: timestamp('tcreado').defaultNow(),
})

export const comprasDetalle = pgTable('bot_compras_det', {
  nid: serial('nid').primaryKey(),
  ncompraId: integer('ncompra_id').notNull().references(() => compras.nid),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  ncantidad: integer('ncantidad').notNull().default(1),
  npreunit: numeric('npreunit', { precision: 10, scale: 2 }).notNull(),
  nsubtotal: numeric('nsubtotal', { precision: 12, scale: 2 }).notNull(),
})

// ─── Ventas ───────────────────────────────────────────────────────────────────

export const ventas = pgTable('bot_ventas', {
  nid: serial('nid').primaryKey(),
  ccodigo: varchar('ccodigo', { length: 20 }).notNull().unique(),
  cnrodniCli: varchar('cnrodni_cli', { length: 11 }),
  ccliente: varchar('ccliente', { length: 200 }).default('Consumidor final'),
  cmetpago: varchar('cmetpago', { length: 20 }).notNull().default('Efectivo'),
  carea: varchar('carea', { length: 50 }).default('Botica'),
  ccaja: varchar('ccaja', { length: 50 }).default('Caja principal'),
  nsubtotal: numeric('nsubtotal', { precision: 12, scale: 2 }).default('0'),
  nigv: numeric('nigv', { precision: 12, scale: 2 }).default('0'),
  ntotal: numeric('ntotal', { precision: 12, scale: 2 }).default('0'),
  nmontoEfectivo: numeric('nmonto_efectivo', { precision: 12, scale: 2 }).notNull().default('0'),
  nmontoDigital: numeric('nmonto_digital', { precision: 12, scale: 2 }).notNull().default('0'),
  nvuelto: numeric('nvuelto', { precision: 12, scale: 2 }).notNull().default('0'),
  cmetodoPagoSecundario: varchar('cmetodo_pago_secundario', { length: 20 }),
  cnotas: text('cnotas'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  tcreado: timestamp('tcreado').defaultNow(),
  nclienteClinicoId: integer('ncliente_clinico_id').references(() => pacientes.nid),
  nalmacenId: integer('nalmacen_id').references(() => almacenes.nid),
})

export const ventasDetalle = pgTable('bot_ventas_det', {
  nid: serial('nid').primaryKey(),
  nventaId: integer('nventa_id').notNull().references(() => ventas.nid),
  nproductoId: integer('nproducto_id').references(() => productos.nid),
  ncantidad: integer('ncantidad').notNull().default(1),
  npreunit: numeric('npreunit', { precision: 10, scale: 2 }).notNull(),
  nsubtotal: numeric('nsubtotal', { precision: 12, scale: 2 }).notNull(),
  ctipo: varchar('ctipo', { length: 20 }).default('Producto'),
  nservicioId: integer('nservicio_id'),
  cdescripcion: varchar('cdescripcion', { length: 200 }),
  nloteId: integer('nlote_id').references(() => lotes.nid),
  cloteCodigo: varchar('clote_codigo', { length: 100 }),
})

// ─── Kardex ───────────────────────────────────────────────────────────────────

export const kardex = pgTable('bot_kardex', {
  nid: serial('nid').primaryKey(),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  ctipo: varchar('ctipo', { length: 30 }).notNull(),
  crefTabla: varchar('cref_tabla', { length: 40 }),
  nrefId: integer('nref_id'),
  ncantidad: integer('ncantidad').notNull(),
  nstockAnterior: integer('nstock_anterior').notNull(),
  nstockNuevo: integer('nstock_nuevo').notNull(),
  cdetalle: text('cdetalle'),
  nusuarioId: integer('nusuario_id'),
  cusuario: varchar('cusuario', { length: 100 }),
  tcreado: timestamp('tcreado').defaultNow(),
  nloteId: integer('nlote_id').references(() => lotes.nid),
  ccodigoLote: varchar('ccodigo_lote', { length: 100 }),
  nalmacenId: integer('nalmacen_id').references(() => almacenes.nid),
})

// ─── Movimientos de Almacén ───────────────────────────────────────────────────

export const movimientosAlmacen = pgTable('bot_movimientos_almacen', {
  nid: serial('nid').primaryKey(),
  nproductoId: integer('nproducto_id').notNull().references(() => productos.nid),
  nloteId: integer('nlote_id').references(() => lotes.nid),
  nalmacenOrigenId: integer('nalmacen_origen_id').references(() => almacenes.nid),
  nalmacenDestinoId: integer('nalmacen_destino_id').references(() => almacenes.nid),
  ctipoMovimiento: varchar('ctipo_movimiento', { length: 30 }).notNull(),
  ncantidad: integer('ncantidad').notNull(),
  cdetalle: text('cdetalle'),
  nusuarioId: integer('nusuario_id'),
  cusuario: varchar('cusuario', { length: 100 }),
  tcreado: timestamp('tcreado').defaultNow(),
})

// ─── Caja (apertura/cierre + movimientos detallados) ─────────────────────────

export const caja = pgTable('bot_caja', {
  nid: serial('nid').primaryKey(),
  ccaja: varchar('ccaja', { length: 50 }).notNull(),
  napertura: numeric('napertura', { precision: 12, scale: 2 }).default('0'),
  ncierre: numeric('ncierre', { precision: 12, scale: 2 }),
  nventasTotal: numeric('nventas_total', { precision: 10, scale: 2 }).notNull().default('0'),
  ningresosTotal: numeric('ningresos_total', { precision: 10, scale: 2 }).notNull().default('0'),
  negresosTotal: numeric('negresos_total', { precision: 10, scale: 2 }).notNull().default('0'),
  npagosFacturaTotal: numeric('npagos_factura_total', { precision: 10, scale: 2 }).notNull().default('0'),
  ngastosTotal: numeric('ngastos_total', { precision: 10, scale: 2 }).notNull().default('0'),
  nsaldoEsperado: numeric('nsaldo_esperado', { precision: 10, scale: 2 }).notNull().default('0'),
  ndiferencia: numeric('ndiferencia', { precision: 10, scale: 2 }).notNull().default('0'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  ncerradoPorId: integer('ncerrado_por_id').references(() => usuarios.nid),
  ccerradoPor: varchar('ccerrado_por', { length: 120 }),
  tapertura: timestamp('tapertura').defaultNow(),
  tcierre: timestamp('tcierre'),
})

export const cajaMovimientos = pgTable('bot_caja_movimientos', {
  nid: serial('nid').primaryKey(),
  ncajaId: integer('ncaja_id').notNull().references(() => caja.nid),
  ctipo: varchar('ctipo', { length: 20 }).notNull(),                  // INGRESO|EGRESO|PAGO_FACTURA|GASTO
  nmonto: numeric('nmonto', { precision: 10, scale: 2 }).notNull(),
  cmetodoPago: varchar('cmetodo_pago', { length: 20 }).notNull().default('EFECTIVO'),
  crefTabla: varchar('cref_tabla', { length: 50 }),
  nrefId: integer('nref_id'),
  cdescripcion: varchar('cdescripcion', { length: 255 }),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  cusuario: varchar('cusuario', { length: 100 }),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
})

// ─── Cuentas por Pagar (compras a CREDITO) ────────────────────────────────────

export const cuentasPorPagar = pgTable('bot_cuentas_por_pagar', {
  nid: serial('nid').primaryKey(),
  ncompraId: integer('ncompra_id').notNull().references(() => compras.nid),
  nproveedorId: integer('nproveedor_id').notNull().references(() => proveedores.nid),
  nmontoTotal: numeric('nmonto_total', { precision: 10, scale: 2 }).notNull(),
  nmontoPagado: numeric('nmonto_pagado', { precision: 10, scale: 2 }).notNull().default('0'),
  // nsaldo es columna GENERATED — no se inserta; se incluye solo para SELECT.
  nsaldo: numeric('nsaldo', { precision: 10, scale: 2 }),
  tfechaEmision: date('tfecha_emision').notNull(),
  tfechaVencimiento: date('tfecha_vencimiento'),
  cestado: varchar('cestado', { length: 15 }).notNull().default('PENDIENTE'),
  cdocumento: varchar('cdocumento', { length: 50 }),
  cnotas: text('cnotas'),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

export const pagosCompras = pgTable('bot_pagos_compras', {
  nid: serial('nid').primaryKey(),
  ncxpId: integer('ncxp_id').notNull().references(() => cuentasPorPagar.nid),
  ncajaMovimientoId: integer('ncaja_movimiento_id').references(() => cajaMovimientos.nid),
  nmonto: numeric('nmonto', { precision: 10, scale: 2 }).notNull(),
  cmetodoPago: varchar('cmetodo_pago', { length: 20 }).notNull().default('EFECTIVO'),
  cdocumento: varchar('cdocumento', { length: 50 }),
  cnotas: text('cnotas'),
  nusuarioId: integer('nusuario_id').references(() => usuarios.nid),
  cusuario: varchar('cusuario', { length: 100 }),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
})

// ─── Auditoría ────────────────────────────────────────────────────────────────

export const auditoria = pgTable('bot_auditoria', {
  nid: serial('nid').primaryKey(),
  cusuario: varchar('cusuario', { length: 100 }).notNull(),
  caccion: varchar('caccion', { length: 50 }).notNull(),
  cdetalle: text('cdetalle'),
  tcreacion: timestamp('tcreacion').defaultNow(),
})

// ─── Pacientes ────────────────────────────────────────────────────────────────

export const pacientes = pgTable('bot_pacientes', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 150 }).notNull(),
  cdni: varchar('cdni', { length: 8 }),
  ctelefono: varchar('ctelefono', { length: 20 }),
  nedad: integer('nedad'),
  cnotas: text('cnotas'),
  tultimaVisita: timestamp('tultima_visita'),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Médicos ──────────────────────────────────────────────────────────────────

export const medicos = pgTable('bot_medicos', {
  nid: serial('nid').primaryKey(),
  cnombre: varchar('cnombre', { length: 150 }).notNull(),
  ccmp: varchar('ccmp', { length: 10 }),
  cespecialidad: varchar('cespecialidad', { length: 100 }),
  ctelefono: varchar('ctelefono', { length: 20 }),
  cemail: varchar('cemail', { length: 100 }),
  cestado: varchar('cestado', { length: 1 }).notNull().default('A'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})

// ─── Citas ────────────────────────────────────────────────────────────────────

export const citas = pgTable('bot_citas', {
  nid: serial('nid').primaryKey(),
  npacienteId: integer('npaciente_id').references(() => pacientes.nid),
  nmedicoId: integer('nmedico_id').references(() => medicos.nid),
  csala: varchar('csala', { length: 50 }),
  tinicio: timestamp('tinicio').notNull(),
  cestado: varchar('cestado', { length: 20 }).notNull().default('programada'),
  tcreado: timestamp('tcreado').defaultNow(),
  tmodifi: timestamp('tmodifi').defaultNow(),
})
