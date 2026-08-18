const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim()
const API_V1_BASE = configuredApiBase ? configuredApiBase.replace(/\/$/, '') : '/api/v1'
const FASTIFY_TOKEN_KEY = 'botica_fastify_token'

async function requestV1<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(FASTIFY_TOKEN_KEY) : null
  let res: Response

  try {
    res = await fetch(`${API_V1_BASE}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifique la red o el backend.')
  }

  const raw = await res.text()
  const data = raw ? (() => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })() : null

  if (!res.ok) {
    throw new Error(
      data?.message ??
      data?.error ??
      `Error de servidor (${res.status})`,
    )
  }
  if (raw && data === null) {
    throw new Error('La respuesta del servidor no es JSON válido')
  }
  return (data ?? {}) as T
}

// Auth
export interface AuthUser {
  id: string
  nombre: string
  rol: string
  dni: string
  super: boolean
  admin: boolean
  permisos: string[]
}

export interface ClerkSyncSuccess {
  linked: true
  authSource: 'clerk'
  user: AuthUser
  token?: string
}

export interface ClerkSyncNotLinked {
  linked?: false
  error: 'CLERK_NOT_LINKED'
  message: string
  clerkUserId?: string
}

export function apiLogin(dni: string, clave: string) {
  return requestV1<AuthUser & { token?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ dni, clave }),
  }).then((data) => {
    const { token, ...user } = data
    if (token && typeof window !== 'undefined') {
      window.localStorage.setItem(FASTIFY_TOKEN_KEY, token)
    }
    return user
  })
}

export function apiLogout() {
  return requestV1<{ ok: boolean }>('/auth/logout', { method: 'POST' }).finally(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(FASTIFY_TOKEN_KEY)
    }
  })
}

export function apiCheckSession() {
  return requestV1<AuthUser>('/auth/session')
}

export async function apiClerkSync(clerkToken: string) {
  const data = await requestV1<ClerkSyncSuccess>('/auth/clerk-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clerkToken}`,
    },
  })

  if (data.token && typeof window !== 'undefined') {
    window.localStorage.setItem(FASTIFY_TOKEN_KEY, data.token)
  }

  return data
}

// Inventario
export interface ApiInventoryLote {
  id: number
  codigo: string | null
  vencimiento: string
  cantidad: number
  estado: string
  diasParaVencer: number
}

export interface ApiInventoryItem {
  id: string
  codigo: string
  name: string
  tipoProducto: 'MEDICAMENTO' | 'NO_MEDICAMENTO' | string
  generico: string
  composicion: string
  componentes: ApiInventoryProductComponent[]
  category: string
  family: string
  presentacion: string
  laboratorio: string
  precioCompra: number
  precioVenta: number
  precioVenta1: number
  precioVenta2: number | null
  precioVenta3: number | null
  familyId: number | null
  categoryId: number | null
  stock: number
  minStock: number
  location: string
  supplier: string
  supplierId: string
  rotation: 'Alta' | 'Media' | 'Baja'
  expiresAt: string
  receta: string
  requiereLote: boolean
  requiereVencimiento: boolean
  lotes: ApiInventoryLote[]
  lotePrincipal: { codigo: string | null; vencimiento: string; cantidad: number; diasParaVencer: number } | null
  totalLotes: number
}

export function apiGetInventory() {
  return requestV1<ApiInventoryItem[]>('/inventario')
}

export function apiAddProduct(data: Partial<ApiInventoryItem>) {
  return requestV1<{ ok: boolean; id: string; codigo: string }>('/inventario', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function apiUpdateProduct(data: Partial<ApiInventoryItem> & { id: string }) {
  return requestV1<{ ok: boolean; id: string }>('/inventario', { method: 'POST', body: JSON.stringify({ action: 'update', ...data }) })
}

export function apiUpdateProductPrices(data: Pick<ApiInventoryItem, 'id' | 'precioVenta1' | 'precioVenta2' | 'precioVenta3'>) {
  return requestV1<{ ok: boolean; id: string }>('/inventario', {
    method: 'POST',
    body: JSON.stringify({ action: 'updatePrices', ...data }),
  })
}

export interface ApiProductFamily {
  id: number
  nombre: string
  descripcion: string
  estado: 'A' | 'I'
  creado: string
  actualizado: string
  productosCount: number
}

export interface ApiProductCategory {
  id: number
  familyId: number | null
  familyName: string
  nombre: string
  descripcion: string
  estado: 'A' | 'I'
  creado: string
  actualizado: string
  productosCount: number
}

export interface ApiProductComponent {
  id: number
  nombre: string
  descripcion: string
  estado: 'A' | 'I'
  creado: string
  actualizado: string
  productosCount: number
}

export interface ApiInventoryProductComponent {
  id: number
  componenteId: number
  nombre: string
  concentracion: string
  forma: string
  notas: string
}

export interface ApiProductCatalogPayload {
  nombre: string
  descripcion?: string
  estado?: 'A' | 'I'
  familyId?: number | null
}

export function apiGetFamiliasProducto(search = '') {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return requestV1<ApiProductFamily[]>(`/inventario/familias${qs}`)
}

export function apiCreateFamiliaProducto(data: ApiProductCatalogPayload) {
  return requestV1<{ ok: boolean; id: string }>('/inventario/familias', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function apiUpdateFamiliaProducto(id: number, data: ApiProductCatalogPayload) {
  return requestV1<{ ok: boolean; id: string }>(`/inventario/familias/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function apiDeleteFamiliaProducto(id: number) {
  return requestV1<{ ok: boolean; id: string }>(`/inventario/familias/${id}`, { method: 'DELETE' })
}

export function apiGetCategoriasProducto(search = '', familyId?: number | null) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (familyId) params.set('familyId', String(familyId))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return requestV1<ApiProductCategory[]>(`/inventario/categorias${qs}`)
}

export function apiCreateCategoriaProducto(data: ApiProductCatalogPayload) {
  return requestV1<{ ok: boolean; id: string }>('/inventario/categorias', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function apiUpdateCategoriaProducto(id: number, data: ApiProductCatalogPayload) {
  return requestV1<{ ok: boolean; id: string }>(`/inventario/categorias/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function apiDeleteCategoriaProducto(id: number) {
  return requestV1<{ ok: boolean; id: string }>(`/inventario/categorias/${id}`, { method: 'DELETE' })
}

export function apiGetComponentesProducto(search = '') {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return requestV1<ApiProductComponent[]>(`/inventario/componentes${qs}`)
}

export function apiCreateComponenteProducto(data: ApiProductCatalogPayload) {
  return requestV1<{ ok: boolean; id: string }>('/inventario/componentes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function apiUpdateComponenteProducto(id: number, data: ApiProductCatalogPayload) {
  return requestV1<{ ok: boolean; id: string }>(`/inventario/componentes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function apiDeleteComponenteProducto(id: number) {
  return requestV1<{ ok: boolean; id: string }>(`/inventario/componentes/${id}`, { method: 'DELETE' })
}


// Ventas
export interface ApiSale {
  id: string
  codigo: string
  concept: string
  customer: string
  paymentMethod: string
  area: string
  cashier: string
  total: number
  notes: string
  at: string
  estado: string
  itemsCount: number
}

export function apiGetSales() {
  return requestV1<ApiSale[]>('/ventas')
}

export function apiAnularVenta(id: string, motivo: string) {
  return requestV1<{ ok: boolean; codigo: string; message: string }>(`/ventas/${id}/anular`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  })
}

export function apiAddSale(data: {
  concept: string
  customer: string
  paymentMethod: string
  total: number
  cashier: string
  area: string
  notes: string
}) {
  return requestV1<{ ok: boolean; id: string; codigo: string }>('/ventas', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Pacientes
export interface ApiPatient {
  id: string
  fullName: string
  documentId: string
  phone: string
  age: number
  notes: string
  lastVisit: string
}

export function apiGetPatients() {
  return requestV1<ApiPatient[]>('/pacientes')
}

export function apiAddPatient(data: {
  fullName: string
  documentId: string
  phone: string
  age: number
  notes: string
}) {
  return requestV1<{ ok: boolean; id: string }>('/pacientes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Citas
export interface ApiAppointment {
  id: string
  patient: string
  doctor: string
  specialty: string
  room: string
  startsAt: string
  status: 'Confirmada' | 'En espera' | 'Atendida'
}

export function apiGetAppointments() {
  return requestV1<ApiAppointment[]>('/citas')
}

export function apiAddAppointment(data: {
  patient: string
  doctor: string
  specialty: string
  room: string
  startsAt: string
  status: string
}) {
  return requestV1<{ ok: boolean; id: string }>('/citas', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Dashboard
export interface ApiDashboard {
  metrics: {
    totalProducts: number
    lowStock: number
    expiringSoon: number
    todayRevenue: number
    todaySalesCount: number
    todayAppointments: number
    totalPatients: number
    doctors: number
  }
  cashBreakdown: {
    yape: number
    efectivo: number
    mixto: number
  }
  recentSales: ApiSale[]
  priorityProducts: {
    id: string
    name: string
    family: string
    stock: number
    minStock: number
    expiresAt: string
  }[]
  alerts: {
    id: string
    title: string
    detail: string
    tone: string
    tag: string
  }[]
}

export function apiGetDashboard() {
  return requestV1<ApiDashboard>('/dashboard')
}

// ═══════════════════════════════════════════
// Nuevos módulos
// ═══════════════════════════════════════════

// Caja
export interface ApiCajaAbierta {
  nid: string
  ccaja: string
  napertura: string
  tapertura: string
  usuarioId?: string | null
  usuarioNombre?: string | null
}
export interface ApiCaja {
  cajaAbierta: ApiCajaAbierta | null
  cajasAbiertas?: ApiCajaAbierta[]
  ventasHoy: { total: number; cantidad: number }
  desglose: Record<string, number>
  historial: ApiCajaHistorial[]
}
export interface ApiCajaHistorial {
  nid: string
  ccaja: string
  napertura: string
  ncierre: string | null
  ventasTotal: number
  ingresosTotal: number
  egresosTotal: number
  pagosFacturaTotal: number
  gastosTotal: number
  saldoEsperado: number
  diferencia: number
  cestado: string
  tapertura: string
  tcierre: string | null
  cnombre: string
  cerradoPor: string | null
}
export function apiGetCaja() { return requestV1<ApiCaja>('/caja') }
export function apiAbrirCaja(montoApertura: number, caja: string | undefined, usuarioId: number) {
  return requestV1<{ ok: boolean; id: string; usuarioId: string; usuarioNombre: string }>('/caja', { method: 'POST', body: JSON.stringify({ action: 'abrir', montoApertura, caja, usuarioId }) })
}
export function apiCerrarCaja(cajaId: number) {
  return requestV1<{ ok: boolean; id: string; resumen?: ApiCajaResumen }>('/caja', { method: 'POST', body: JSON.stringify({ action: 'cerrar', cajaId }) })
}

// Caja — movimientos detallados
export type CajaTipoMovimiento = 'INGRESO' | 'EGRESO' | 'GASTO' | 'PAGO_FACTURA'
export type CajaMetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'YAPE' | 'PLIN' | 'OTRO'

export interface ApiCajaMovimiento {
  nid: string
  cajaId: string
  tipo: CajaTipoMovimiento | string
  monto: number
  metodoPago: CajaMetodoPago | string
  refTabla: string | null
  refId: string | null
  descripcion: string | null
  usuario: string | null
  estado?: string
  fecha: string
}
export interface ApiCajaResumen {
  abierta: boolean
  cajaId?: string
  usuarioId?: string | null
  usuarioNombre?: string | null
  apertura?: number
  ventas?: number
  ingresos?: number
  egresosManuales?: number
  pagosFactura?: number
  gastos?: number
  egresos?: number
  saldoTeorico?: number
  saldoEsperado?: number
  montoCierre?: number
  montoContado?: number | null
  cierreAutomatico?: boolean
  diferencia?: number
  detalle?: Record<string, number>
}
export function apiGetCajaMovimientos(opts?: { tipo?: CajaTipoMovimiento; cajaId?: string }) {
  const params = new URLSearchParams()
  if (opts?.tipo) params.set('tipo', opts.tipo)
  if (opts?.cajaId) params.set('cajaId', opts.cajaId)
  const suffix = params.toString()
  return requestV1<ApiCajaMovimiento[]>(`/caja/movimientos${suffix ? `?${suffix}` : ''}`)
}
export function apiAddCajaMovimiento(data: {
  tipo: CajaTipoMovimiento
  monto: number
  metodoPago: CajaMetodoPago
  descripcion: string
  cajaId?: number
  refTabla?: string
  refId?: number
}) {
  return requestV1<{ ok: boolean; id: string }>('/caja/movimientos', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
export function apiAnularCajaMovimiento(id: string, motivo: string) {
  return requestV1<{ ok: boolean; id: string; estado: string }>(`/caja/movimientos/${id}/anular`, {
    method: 'PATCH',
    body: JSON.stringify({ motivo }),
  })
}
export function apiGetCajaResumen(opts?: { cajaId?: string }) {
  const params = new URLSearchParams()
  if (opts?.cajaId) params.set('cajaId', opts.cajaId)
  const suffix = params.toString()
  return requestV1<ApiCajaResumen>(`/caja/resumen${suffix ? `?${suffix}` : ''}`)
}

// Cuentas por Pagar
export interface ApiCxp {
  nid: string
  compraId: string
  compraCodigo: string | null
  proveedorId: string
  proveedorNombre: string | null
  montoTotal: number
  montoPagado: number
  saldo: number
  fechaEmision: string
  fechaVencimiento: string | null
  estado: 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'ANULADA' | string
  documento: string | null
  diasAtraso: number | null
}
export interface ApiCxpResumen {
  proveedorId: string
  proveedorNombre: string | null
  saldoTotal: number
  vencido: number
}
export function apiGetCxp(opts?: { estado?: string; proveedorId?: string; vencidas?: boolean }) {
  const params = new URLSearchParams()
  if (opts?.estado) params.set('estado', opts.estado)
  if (opts?.proveedorId) params.set('proveedorId', opts.proveedorId)
  if (opts?.vencidas) params.set('vencidas', 'true')
  const suffix = params.toString()
  return requestV1<ApiCxp[]>(`/cuentas-por-pagar${suffix ? `?${suffix}` : ''}`)
}
export function apiGetCxpResumen() {
  return requestV1<ApiCxpResumen[]>('/cuentas-por-pagar/resumen')
}
export function apiPagarCxp(cxpId: string, data: {
  monto: number
  metodoPago: CajaMetodoPago
  documento?: string
  notas?: string
}) {
  return requestV1<{ ok: boolean; pagoId: string; cajaMovimientoId: string | null }>(
    `/cuentas-por-pagar/${cxpId}/pagar`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// Historial de precios
export interface ApiPrecioHistorial {
  nid: string
  slot: string
  precioAnterior: number | null
  precioNuevo: number
  accion: string
  usuario: string | null
  fecha: string
}
export function apiGetPrecioHistorial(productoId: number) {
  return requestV1<ApiPrecioHistorial[]>(`/inventario/precios/historial/${productoId}`)
}

// Proveedores
export interface ApiProveedor {
  nid: string
  cruc: string
  cnombre: string
  ccontacto: string
  ctelefono: string
  cemail: string
  cdireccion: string
  cnotas: string
  cestado?: string
}
export function apiGetProveedores(q?: string, options?: { includeInactive?: boolean }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (options?.includeInactive) params.set('includeInactive', '1')
  const suffix = params.toString()
  return requestV1<ApiProveedor[]>(`/proveedores${suffix ? `?${suffix}` : ''}`)
}
export function apiSaveProveedor(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/proveedores', { method: 'POST', body: JSON.stringify(data) }) }

// Compras
export interface ApiCompra {
  nid: string
  ccodigo: string
  nproveedor_id?: string
  nalmacen_id?: string
  cproveedor: string
  ctipo_comprobante?: string
  ctipo_pago?: 'CONTADO' | 'CREDITO' | string
  tfecha_vencimiento?: string | null
  almacen_nombre?: string
  almacen_tipo?: string
  local_nombre?: string
  cdocumento: string
  ntotal: string
  cestado: string
  tcreado: string
}
export function apiGetCompras() { return requestV1<ApiCompra[]>('/compras') }
export function apiAddCompra(data: {
  proveedorId: number
  almacenId: number
  tipoComprobante: 'FACTURA'
  numeroDocumento: string
  notas?: string
  tipoPago?: 'CONTADO' | 'CREDITO'
  fechaVencimientoFactura?: string
  items: Array<{
    productoId: number
    cantidad: number
    precioUnit: number
    codigoLote: string
    fechaVencimiento: string
    notasLote?: string
  }>
}) {
  return requestV1<{ ok: boolean; id: string; codigo: string; total: number }>('/compras', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Médicos
export interface ApiMedico { nid: string; cnombre: string; ccmp: string; cespeciali: string; ctelefono: string; cemail: string; cnotas: string }
export function apiGetMedicos() { return requestV1<ApiMedico[]>('/medicos') }
export function apiSaveMedico(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/medicos', { method: 'POST', body: JSON.stringify(data) }) }

// Servicios
export interface ApiServicio { nid: string; cnombre: string; ccategoria: string; nprecio: string; cdescripcion: string }
export function apiGetServicios() { return requestV1<ApiServicio[]>('/servicios') }
export function apiSaveServicio(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/servicios', { method: 'POST', body: JSON.stringify(data) }) }

// Historial clínico
export interface ApiHistorial { nid: string; cfecha: string; cdoctor: string; cdiagnostico: string; ctratamiento: string; cobservacion: string; csignos: string; medico_nombre: string }
export function apiGetHistorial(pacienteId: number) { return requestV1<ApiHistorial[]>(`/historial?pacienteId=${pacienteId}`) }
export function apiAddHistorial(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/historial', { method: 'POST', body: JSON.stringify(data) }) }

// Recetas
export interface ApiReceta { nid: string; cfecha: string; cdoctor: string; cdiagnostico: string; cindicaciones: string; cestado: string; medicamentos: Record<string, unknown>[] }
export function apiGetRecetas(pacienteId: number) { return requestV1<ApiReceta[]>(`/recetas?pacienteId=${pacienteId}`) }
export function apiAddReceta(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/recetas', { method: 'POST', body: JSON.stringify(data) }) }

// Transferencias
export interface ApiTransferencia { nid: string; ccodigo: string; ctipo: string; corigen: string; cdestino: string; cmotivo: string; cestado: string; tcreado: string; detalle: Record<string, unknown>[] }
export function apiGetTransferencias(tipo?: string) { return requestV1<ApiTransferencia[]>(`/transferencias${tipo ? '?tipo=' + tipo : ''}`) }
export function apiAddTransferencia(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string; codigo: string }>('/transferencias', { method: 'POST', body: JSON.stringify(data) }) }

// Alquileres
export interface ApiAlquiler { nid: string; cconcepto: string; carrendatario: string; cdni: string; ctelefono: string; nperiodo_monto: string; cperiodo: string; finicio: string; ffin: string; cnotas: string; cestado: string }
export function apiGetAlquileres() { return requestV1<ApiAlquiler[]>('/alquileres') }
export function apiSaveAlquiler(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/alquileres', { method: 'POST', body: JSON.stringify(data) }) }

// Deudores
export interface ApiDeudor { nid: string; cnombre: string; cdni: string; ctelefono: string; cconcepto: string; nmonto: string; nabonado: string; saldo: string; ffecha: string; fvencimiento: string; cnotas: string; cestado: string }
export function apiGetDeudores(estado?: string) { return requestV1<ApiDeudor[]>(`/deudores${estado ? '?estado=' + estado : ''}`) }
export function apiAddDeudor(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/deudores', { method: 'POST', body: JSON.stringify(data) }) }
export function apiAbonarDeuda(id: number, abono: number) { return requestV1<{ ok: boolean }>('/deudores', { method: 'POST', body: JSON.stringify({ action: 'abonar', id, abono }) }) }

// Inventario variado
export interface ApiInvVar { nid: string; cnombre: string; ccategoria: string; cdescripcion: string; ncantidad: string; nvalor: string; cubicacion: string; cestado: string }
export function apiGetInvVar() { return requestV1<ApiInvVar[]>('/inventario-var') }
export function apiSaveInvVar(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id: string }>('/inventario-var', { method: 'POST', body: JSON.stringify(data) }) }

// Reportes
export function apiGetReporte(tipo: string, params?: Record<string, string>) {
  const qs = new URLSearchParams({ tipo, ...params })
  return requestV1<Record<string, unknown>>(`/reportes?${qs}`)
}

// Auditoría
export interface ApiAuditoria { total: number; items: Record<string, unknown>[]; resumen: Record<string, unknown>[] }
export function apiGetAuditoria(params?: Record<string, string>) {
  const qs = params ? '&' + new URLSearchParams(params) : ''
  return requestV1<ApiAuditoria>(`/auditoria?${qs}`)
}

// Perfil
export interface ApiPerfil { nombre: string; dni: string; telefono: string; direccion: string; email: string; rol: string }
export function apiGetPerfil() { return requestV1<ApiPerfil>('/perfil') }
export function apiUpdatePerfil(data: Partial<ApiPerfil>) { return requestV1<{ ok: boolean; message: string }>('/perfil', { method: 'POST', body: JSON.stringify({ action: 'actualizar', ...data }) }) }
export function apiCambiarClave(claveActual: string, claveNueva: string) { return requestV1<{ ok: boolean; message: string }>('/perfil', { method: 'POST', body: JSON.stringify({ action: 'cambiarClave', claveActual, claveNueva }) }) }

// Usuarios
export interface ApiUsuario {
  id: string
  dni: string
  nombre: string
  rol: string
  estado: string
  super: boolean
  admin: boolean
  clerkLinked: boolean
  clerkUserId: string | null
  permisos: string[]
  creado: string
}
export interface ApiUsuarioClerkLinkStatus {
  userId: string
  nombre: string
  dni: string
  estado: string
  clerkLinked: boolean
  clerkUserId: string | null
}
export function apiGetUsuarios() { return requestV1<ApiUsuario[]>('/usuarios') }
export function apiUsuarioAction(data: Record<string, unknown>) { return requestV1<{ ok: boolean; id?: string; reactivado?: boolean; message?: string }>('/usuarios', { method: 'POST', body: JSON.stringify(data) }) }
export function apiGetUsuarioClerkLink(id: string) { return requestV1<ApiUsuarioClerkLinkStatus>(`/usuarios/${id}/clerk-link`) }
export function apiLinkUsuarioClerk(id: string, clerkUserId: string) {
  return requestV1<{ ok: boolean; message: string } & ApiUsuarioClerkLinkStatus>(
    `/usuarios/${id}/clerk-link`,
    { method: 'POST', body: JSON.stringify({ clerkUserId }) },
  )
}
export function apiUnlinkUsuarioClerk(id: string) {
  return requestV1<{ ok: boolean; message: string } & ApiUsuarioClerkLinkStatus>(
    `/usuarios/${id}/clerk-link`,
    { method: 'DELETE' },
  )
}

// ═══════════════════════════════════════════
// POS — Búsqueda y ventas detalladas
// ═══════════════════════════════════════════

export interface ApiPOSProduct {
  id: number
  codigo: string
  nombre: string
  generico: string
  categoria: string
  familia: string
  presentacion: string
  precioVenta: number
  precioVenta1: number
  precioVenta2: number | null
  precioVenta3: number | null
  stock: number
  expiresAt: string | null
  receta: string
}

export function apiPOSBuscarProductos(search: string) {
  return requestV1<{ success: boolean; data: ApiPOSProduct[] }>(
    `/inventario/search?search=${encodeURIComponent(search)}&limit=8`,
  )
}

export interface ApiPOSSaleItem {
  productoId: number
  productoNombre: string
  cantidad: number
  precioUnitario: number
  total: number
}

export function apiPOSCrearVenta(data: {
  customer: string
  customerId?: number
  documentId?: string
  customerMode?: 'generico' | 'clinica'
  paymentMethod: string
  montoEfectivo?: number
  montoDigital?: number
  vuelto?: number
  metodoPagoSecundario?: string
  total: number
  cashier: string
  area: string
  notes: string
  almacenId?: number
  items: ApiPOSSaleItem[]
}) {
  return requestV1<{ ok: boolean; id: string; codigo: string }>('/ventas', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface ApiLoteFefo {
  id: number
  codigoLote: string | null
  fechaVencimiento: string
  cantidad: number
  cantidadInicial: number
  diasParaVencer: number
  alerta: 'CRITICO' | 'PROXIMO' | 'OK'
  stockAcumulado: number
}

export interface ApiLotesDisponiblesData {
  productoId: number
  productoNombre: string
  productoCodigo: string
  stockTotal: number
  stockEnLotes: number
  stockSinLote: number
  tieneLottes: boolean
  lotes: ApiLoteFefo[]
}

export function apiGetLotesDisponibles(productoId: number, qs = '') {
  return requestV1<{ success: boolean; data: ApiLotesDisponiblesData }>(
    `/lotes/disponibles/${productoId}${qs}`,
  )
}

export function apiGetLotes(productoId: string, almacenId: string) {
  return requestV1<{ id: string; code: string }[]>(`/lotes?productoId=${productoId}&almacenId=${almacenId}`)
}

export function apiPostAjuste(data: {
  productoId: string
  almacenId: string
  loteId: string
  cantidad: number
  motivo: string
  detalle: string
}) {
  return requestV1<{ ok: boolean }>('/ajustes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Distribución de stock ──────────────────────────────────
export interface ApiDistribucionLote {
  id: number; codigoLote: string; vencimiento: string; cantidad: number; diasParaVencer: number
}
export interface ApiDistribucionAlmacen {
  almacenId: number; almacenNombre: string; tipoAlmacen: string
  permiteVenta: boolean; permiteConsumoClinico: boolean
  localId: number; localNombre: string; tipoLocal: string
  stock: number; lotesActivos: number; proximoVencimiento: string | null
  lotes: ApiDistribucionLote[]
}
export interface ApiDistribucionProducto {
  productoId: number; productoCodigo: string; productoNombre: string
  stockTotal: number; stockVendible: number; stockNoVendible: number
  almacenes: ApiDistribucionAlmacen[]
}
export interface ApiDistribucionResponse {
  success: boolean; totalProductos: number
  totalStockVendible: number; totalStockNoVendible: number
  productos: ApiDistribucionProducto[]
}

export function apiGetDistribucion(qs = '') {
  return requestV1<ApiDistribucionResponse>(`/inventario/distribucion${qs}`)
}

// ── Locales ────────────────────────────────────────────────
export interface ApiLocal {
  id: number
  nombre: string
  codigo: string
  tipoLocal: string
  direccion: string
  telefono: string
  estado: string
  creado: string
  almacenesCount: number
}

export function apiGetLocales() {
  return requestV1<ApiLocal[]>('/locales')
}

export function apiSaveLocal(data: Partial<ApiLocal>) {
  return requestV1<{ ok: boolean; id: number }>('/locales', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Almacenes ──────────────────────────────────────────────
export interface ApiAlmacen {
  id: number
  localId: number
  localNombre: string
  localTipo: string
  nombre: string
  codigo: string
  tipoAlmacen: string
  permiteVenta: boolean
  permiteConsumoClinico: boolean
  requiereRevision: boolean
  estado: string
  creado: string
  lotesActivos: number
  stockTotal: number
}

export function apiGetAlmacenes(localId?: number) {
  const qs = localId ? `?localId=${localId}` : ''
  return requestV1<ApiAlmacen[]>(`/almacenes${qs}`)
}

export function apiSaveAlmacen(data: Partial<ApiAlmacen>) {
  return requestV1<{ ok: boolean; id: number }>('/almacenes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Consistencia ──────────────────────────────────────────
export interface ApiConsistenciaCheck {
  check: string; descripcion: string; inconsistencias: number; severidad: string
}
export interface ApiConsistenciaResumen {
  success: boolean; tipo: string; estadoGeneral: string; totalInconsistencias: number
  stockVendible: number; stockNoVendible: number; almacenesActivos: number
  checks: ApiConsistenciaCheck[]
}
export interface ApiConsistenciaStockItem {
  productoId: number; productoCodigo: string; productoNombre: string
  stockTabla: number; stockLotesActivos: number; diferencia: number
  lotesConStock: number; lotesSinAlmacen: number; severidad: string
}
export interface ApiConsistenciaStockResponse {
  success: boolean; totalInconsistencias: number; criticas: number; medias: number; bajas: number
  inconsistencias: ApiConsistenciaStockItem[]
}
export interface ApiConsistenciaLotesGroup {
  total: number; severidad: string
  items: Array<{ loteId: number; productoId: number; productoNombre: string; productoCodigo?: string
    codigoLote: string | null; vencimiento?: string; cantidad: number; almacenId?: number; almacenNombre?: string }>
}
export interface ApiConsistenciaLotesResponse {
  success: boolean; vencidosNoMarcados: ApiConsistenciaLotesGroup
  sinAlmacen: ApiConsistenciaLotesGroup; almacenInactivo: ApiConsistenciaLotesGroup
}
export function apiGetConsistenciaResumen() {
  return requestV1<ApiConsistenciaResumen>('/consistencia/resumen')
}
export function apiGetConsistenciaStock() {
  return requestV1<ApiConsistenciaStockResponse>('/consistencia/stock')
}
export function apiGetConsistenciaLotes() {
  return requestV1<ApiConsistenciaLotesResponse>('/consistencia/lotes')
}
export function apiPostReconciliar(dryRun = true) {
  return requestV1<{ success: boolean; dryRun: boolean; totalCorregidos: number; correcciones: unknown[] }>(
    '/consistencia/reconciliar', { method: 'POST', body: JSON.stringify({ dryRun }) })
}
export function apiPostMarcarVencidos(dryRun = true) {
  return requestV1<{ success: boolean; dryRun: boolean; totalMarcados: number; marcados: unknown[] }>(
    '/consistencia/marcar-vencidos', { method: 'POST', body: JSON.stringify({ dryRun }) })
}

// ── Alertas operativas ────────────────────────────────────
export interface ApiAlertaItem { loteId?: number; productoId: number; productoNombre: string; productoCodigo: string; [k: string]: unknown }
export interface ApiAlertasResponse {
  success: boolean
  resumen?: {
    totalAlertas: number
    alertasCriticas: number
    stockNoVendible: number
    lotesPorVencerCriticos: number
  }
  porVencer: { total: number; items: ApiAlertaItem[] }
  enCuarentena: { total: number; totalUnidades: number; items: ApiAlertaItem[] }
  enBaja: { total: number; totalUnidades: number; items: ApiAlertaItem[] }
  stockFantasma: { total: number; items: ApiAlertaItem[] }
}
export function apiGetAlertas() {
  return requestV1<ApiAlertasResponse>('/consistencia/alertas')
}

// ── Traslados entre almacenes ─────────────────────────────
export function apiPostTrasladoAlmacen(data: {
  productoId: number; loteId?: number; almacenOrigenId: number; almacenDestinoId: number; cantidad: number; motivo?: string
}) {
  return requestV1<{ ok: boolean; productoId: number; cantidad: number; almacenOrigen: { id: number; nombre: string }; almacenDestino: { id: number; nombre: string } }>(
    '/traslados-almacen', { method: 'POST', body: JSON.stringify(data) })
}
export function apiGetTrasladosAlmacen(qs = '') {
  return requestV1<{ success: boolean; total: number; data: Array<{
    id: number; productoId: number; productoNombre: string; productoCodigo: string
    loteId: number | null; almacenOrigen: { id: number; nombre: string }; almacenDestino: { id: number; nombre: string }
    cantidad: number; detalle: string; usuario: string; fecha: string
  }> }>(`/traslados-almacen${qs}`)
}

// ── Devoluciones ──────────────────────────────────────────
export function apiPostDevolucionCliente(data: {
  productoId: number; almacenDestinoId: number; cantidad: number; motivo?: string; loteId?: number
}) {
  return requestV1<{ ok: boolean; productoId: number; cantidad: number; almacen: string }>(
    '/traslados-almacen/devolucion-cliente', { method: 'POST', body: JSON.stringify(data) })
}
export function apiPostDevolucionProveedor(data: {
  productoId: number; almacenOrigenId: number; cantidad: number; motivo?: string; loteId?: number
}) {
  return requestV1<{ ok: boolean; productoId: number; cantidad: number; almacenOrigen: string }>(
    '/traslados-almacen/devolucion-proveedor', { method: 'POST', body: JSON.stringify(data) })
}
