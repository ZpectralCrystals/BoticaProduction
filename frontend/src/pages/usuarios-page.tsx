import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Link2, Mail, Search, Shield, ShieldCheck, Unlink2, User } from 'lucide-react'
import {
  apiGetUsuarioClerkLink,
  apiGetUsuarios,
  apiLinkUsuarioClerk,
  apiSearchClerkUsers,
  apiUnlinkUsuarioClerk,
  apiUpdateUsuarioClerkEmail,
  apiUsuarioAction,
} from '@/lib/api'
import type { ApiClerkUser, ApiUsuario, ApiUsuarioClerkLinkStatus } from '@/lib/api'
import type { AppSection } from '@/lib/app-sections'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuthBridge } from '@/context/auth-bridge'
import { useAuth } from '@/context/auth-context'

const ALL_SECTIONS: { key: AppSection; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'caja', label: 'Caja' },
  { key: 'compras', label: 'Compras' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'pacientes', label: 'Pacientes' },
  { key: 'procedimientos', label: 'Procedimientos' },
  { key: 'medicos', label: 'Medicos' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'transferencias', label: 'Transferencias' },
  { key: 'alquileres', label: 'Alquileres' },
  { key: 'deudores', label: 'Deudores' },
  { key: 'inventario-var', label: 'Inv. Variado' },
  { key: 'auditoria', label: 'Auditoria' },
]

type EstadoFiltro = 'activos' | 'inactivos' | 'todos'

const ESTADO_FILTROS: Array<{ key: EstadoFiltro; label: string }> = [
  { key: 'activos', label: 'Activos' },
  { key: 'inactivos', label: 'Inactivos' },
  { key: 'todos', label: 'Todos' },
]

export function UsuariosPage() {
  const { isSuper, isAdmin } = useAuth()
  const bridge = useAuthBridge()
  const [usuarios, setUsuarios] = useState<ApiUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ dni: '', nombre: '', rol: 'caja', admin: false, permisos: [] as string[] })
  const [showClerkDialog, setShowClerkDialog] = useState(false)
  const [clerkTarget, setClerkTarget] = useState<ApiUsuario | null>(null)
  const [clerkStatus, setClerkStatus] = useState<ApiUsuarioClerkLinkStatus | null>(null)
  const [clerkUserIdInput, setClerkUserIdInput] = useState('')
  const [loadingClerkStatus, setLoadingClerkStatus] = useState(false)
  const [savingClerkStatus, setSavingClerkStatus] = useState(false)
  const [clerkEmailInput, setClerkEmailInput] = useState('')
  const [savingClerkEmail, setSavingClerkEmail] = useState(false)
  const [clerkSearchQuery, setClerkSearchQuery] = useState('')
  const [clerkSearchResults, setClerkSearchResults] = useState<ApiClerkUser[]>([])
  const [searchingClerk, setSearchingClerk] = useState(false)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('activos')

  const load = useCallback(() => {
    setLoading(true)
    apiGetUsuarios().then(setUsuarios).catch(() => toast.error('Error al cargar usuarios')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const togglePermiso = (sec: string) => {
    setForm(f => ({
      ...f,
      permisos: f.permisos.includes(sec) ? f.permisos.filter(s => s !== sec) : [...f.permisos, sec],
    }))
  }

  const selectAll = () => setForm(f => ({ ...f, permisos: ALL_SECTIONS.map(s => s.key) }))
  const selectNone = () => setForm(f => ({ ...f, permisos: [] }))

  const startEdit = (u: ApiUsuario) => {
    setEditId(u.id)
    setForm({ dni: u.dni, nombre: u.nombre, rol: u.rol, admin: u.admin, permisos: [...u.permisos] })
    setShowForm(true)
  }

  const startCreate = () => {
    setEditId(null)
    setForm({ dni: '', nombre: '', rol: 'caja', admin: false, permisos: [] })
    setShowForm(true)
  }

  const openClerkDialog = async (u: ApiUsuario) => {
    setClerkTarget(u)
    setClerkStatus(null)
    setClerkUserIdInput(u.clerkUserId ?? bridge.clerkUserId ?? '')
    setClerkEmailInput('')
    setClerkSearchQuery(u.nombre)
    setClerkSearchResults([])
    setShowClerkDialog(true)
    setLoadingClerkStatus(true)
    try {
      const status = await apiGetUsuarioClerkLink(u.id)
      setClerkStatus(status)
      setClerkUserIdInput(status.clerkUserId ?? bridge.clerkUserId ?? '')
      setClerkEmailInput(status.clerkEmail ?? '')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el estado de vínculo Clerk')
    } finally {
      setLoadingClerkStatus(false)
    }
  }

  const submit = async () => {
    try {
      if (editId) {
        await apiUsuarioAction({ action: 'actualizar', id: parseInt(editId), nombre: form.nombre, rol: form.rol, admin: form.admin, permisos: form.permisos })
        toast.success('Usuario actualizado')
      } else {
        const res = await apiUsuarioAction({ action: 'crear', dni: form.dni, nombre: form.nombre, rol: form.rol, permisos: form.permisos })
        toast.success(res.reactivado ? 'Usuario reactivado' : 'Usuario creado (clave = DNI)')
      }
      setShowForm(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const toggleEstado = async (u: ApiUsuario) => {
    try {
      await apiUsuarioAction({ action: u.estado === 'A' ? 'desactivar' : 'activar', id: parseInt(u.id) })
      toast.success(u.estado === 'A' ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const resetClave = async (u: ApiUsuario) => {
    try {
      await apiUsuarioAction({ action: 'resetClave', id: parseInt(u.id) })
      toast.success('Clave reseteada al DNI')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleClerkLink = async () => {
    if (!clerkTarget) return
    const normalizedClerkUserId = clerkUserIdInput.trim()
    if (!normalizedClerkUserId) {
      toast.error('Debe ingresar el Clerk User ID')
      return
    }

    setSavingClerkStatus(true)
    try {
      const status = await apiLinkUsuarioClerk(clerkTarget.id, normalizedClerkUserId)
      setClerkStatus(status)
      setClerkUserIdInput(status.clerkUserId ?? normalizedClerkUserId)
      setClerkEmailInput(status.clerkEmail ?? '')
      toast.success(status.message || 'Usuario ERP vinculado con Clerk')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo vincular el usuario con Clerk')
    } finally {
      setSavingClerkStatus(false)
    }
  }

  const handleClerkUnlink = async () => {
    if (!clerkTarget) return

    setSavingClerkStatus(true)
    try {
      const status = await apiUnlinkUsuarioClerk(clerkTarget.id)
      setClerkStatus(status)
      setClerkUserIdInput('')
      setClerkEmailInput('')
      toast.success(status.message || 'Vínculo Clerk removido')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desvincular el usuario de Clerk')
    } finally {
      setSavingClerkStatus(false)
    }
  }

  const handleClerkSearch = async () => {
    const query = clerkSearchQuery.trim()
    if (query.length < 2) {
      toast.error('Ingrese al menos 2 caracteres para buscar')
      return
    }

    setSearchingClerk(true)
    try {
      const results = await apiSearchClerkUsers(query)
      setClerkSearchResults(results)
      if (results.length === 0) toast.info('No se encontraron usuarios en Clerk')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo buscar en Clerk')
    } finally {
      setSearchingClerk(false)
    }
  }

  const handleClerkEmailUpdate = async () => {
    if (!clerkTarget) return
    const email = clerkEmailInput.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Ingrese un correo válido')
      return
    }
    const confirmed = window.confirm(
      `Clerk conservará únicamente ${email} como correo de acceso para ${clerkTarget.nombre}. ¿Desea continuar?`,
    )
    if (!confirmed) return

    setSavingClerkEmail(true)
    try {
      const status = await apiUpdateUsuarioClerkEmail(clerkTarget.id, email)
      setClerkStatus(status)
      setClerkEmailInput(status.clerkEmail ?? email)
      toast.success(status.message)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar el correo Clerk')
    } finally {
      setSavingClerkEmail(false)
    }
  }

  const closeClerkDialog = () => {
    setShowClerkDialog(false)
    setClerkTarget(null)
    setClerkStatus(null)
    setClerkUserIdInput('')
    setClerkEmailInput('')
    setLoadingClerkStatus(false)
    setSavingClerkStatus(false)
    setSavingClerkEmail(false)
    setClerkSearchQuery('')
    setClerkSearchResults([])
    setSearchingClerk(false)
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  const usuariosActivos = usuarios.filter((u) => u.estado === 'A')
  const usuariosInactivos = usuarios.filter((u) => u.estado !== 'A')
  const usuariosFiltrados = usuarios.filter((u) => {
    if (estadoFiltro === 'activos') return u.estado === 'A'
    if (estadoFiltro === 'inactivos') return u.estado !== 'A'
    return true
  })
  const clerkVinculados = usuarios.filter((u) => u.clerkLinked).length
  const clerkPendientesActivos = usuariosActivos.filter((u) => !u.clerkLinked).length

  const clerkStatusForDialog = clerkStatus ?? (clerkTarget ? {
    userId: clerkTarget.id,
    nombre: clerkTarget.nombre,
    dni: clerkTarget.dni,
    estado: clerkTarget.estado,
    clerkLinked: clerkTarget.clerkLinked,
    clerkUserId: clerkTarget.clerkUserId,
    clerkEmail: null,
  } : null)
  const canLinkCurrentTarget = clerkStatusForDialog?.estado === 'A'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">
          {usuariosActivos.length} activo(s) · {usuariosInactivos.length} inactivo(s) · Nunca se eliminan, solo se desactivan.
        </p>
        <Button onClick={startCreate}>Nuevo usuario</Button>
      </div>

      <Card className="p-4">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Identidad Clerk ↔ Usuario ERP</p>
            <Badge variant="info">{clerkVinculados} vinculado(s)</Badge>
            {clerkPendientesActivos > 0 && <Badge variant="warning">{clerkPendientesActivos} activo(s) sin Clerk</Badge>}
          </div>
          <p className="text-muted">
            Clerk gestiona identidad y sesión, pero <span className="font-semibold">bot_usuarios</span> sigue siendo la
            fuente de verdad para rol, permisos y estado operativo del acceso.
          </p>
          <p className="text-muted">
            Desde aquí puede vincular o desvincular el <code className="rounded bg-muted px-1 py-0.5">cclerk_user_id</code>{' '}
            sin usar SQL manual.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            Un usuario inactivo no debe iniciar sesión, vender, operar caja ni aparecer en selectores operativos. Para auditoría,
            use las pestañas Inactivos o Todos.
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {ESTADO_FILTROS.map((filtro) => {
          const count = filtro.key === 'activos'
            ? usuariosActivos.length
            : filtro.key === 'inactivos'
              ? usuariosInactivos.length
              : usuarios.length
          return (
            <Button
              key={filtro.key}
              type="button"
              variant={estadoFiltro === filtro.key ? 'default' : 'outline'}
              onClick={() => setEstadoFiltro(filtro.key)}
            >
              {filtro.label} ({count})
            </Button>
          )
        })}
      </div>

      {showForm && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">{editId ? 'Editar usuario' : 'Crear usuario'}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">DNI (8 digitos)</span>
              <Input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} disabled={!!editId} maxLength={8} placeholder="12345678" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Nombre completo</span>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} disabled={!isAdmin && !isSuper} placeholder="Juan Perez" />
              {!isAdmin && !isSuper && <span className="text-xs text-muted">Solo admin puede modificar el nombre</span>}
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Rol base</span>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.rol}
                onChange={e => setForm({ ...form, rol: e.target.value })}
              >
                <option value="caja">Caja</option>
                <option value="almacenero">Almacenero</option>
                <option value="doctor">Doctor</option>
                <option value="administrador">Administrador</option>
              </select>
            </label>
          </div>

          {isSuper && editId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.admin} onChange={e => setForm({ ...form, admin: e.target.checked })} className="rounded" />
              <span className="text-sm font-semibold">Poderes de administrador (puede gestionar usuarios)</span>
            </label>
          )}

          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold">Modulos permitidos</span>
              <Button variant="outline" size="sm" onClick={selectAll}>Todos</Button>
              <Button variant="outline" size="sm" onClick={selectNone}>Ninguno</Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {ALL_SECTIONS.map(s => (
                <label key={s.key} className={`flex items-center gap-2 rounded-lg border p-2 text-sm cursor-pointer transition-colors ${form.permisos.includes(s.key) ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'}`}>
                  <input type="checkbox" checked={form.permisos.includes(s.key)} onChange={() => togglePermiso(s.key)} className="rounded" />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={submit}>{editId ? 'Guardar cambios' : 'Crear usuario'}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
          {!editId && <p className="text-xs text-muted">La clave inicial sera el mismo DNI. El usuario podra cambiarla despues.</p>}
        </Card>
      )}

      <Dialog open={showClerkDialog} onClose={closeClerkDialog}>
        <DialogTitle>Vinculación Clerk</DialogTitle>
        <div className="mt-4 space-y-4">
          {clerkTarget && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold">{clerkTarget.nombre}</p>
              <p className="text-muted">
                DNI: {clerkTarget.dni} · Estado ERP: {clerkStatusForDialog?.estado === 'A' ? 'ACTIVO' : 'INACTIVO'}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            El vínculo Clerk no cambia roles ni permisos. Solo habilita que ese usuario Clerk pueda activar sesión ERP
            si el usuario está activo.
          </div>

          {bridge.clerkUserId && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Sesión Clerk actual detectada en este navegador:{' '}
              <code className="rounded bg-emerald-100 px-1 py-0.5">{bridge.clerkUserId}</code>
            </div>
          )}

          {loadingClerkStatus ? (
            <p className="text-sm text-muted">Cargando estado actual del vínculo...</p>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Estado actual:</span>
                {clerkStatusForDialog?.clerkLinked ? (
                  <Badge variant="info">Clerk vinculado</Badge>
                ) : (
                  <Badge variant="neutral">Sin vínculo Clerk</Badge>
                )}
                {clerkStatusForDialog?.estado !== 'A' && (
                  <Badge variant="danger">Usuario ERP inactivo</Badge>
                )}
              </div>
              <p className="mt-2 text-muted">
                Clerk User ID actual:{' '}
                <code className="rounded bg-muted px-1 py-0.5">
                  {clerkStatusForDialog?.clerkUserId ?? 'Sin vínculo'}
                </code>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-sm font-semibold">Buscar usuario Clerk</span>
            <div className="flex gap-2">
              <Input
                value={clerkSearchQuery}
                onChange={(e) => setClerkSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleClerkSearch()
                  }
                }}
                placeholder="Nombre o correo"
              />
              <Button type="button" variant="outline" onClick={handleClerkSearch} disabled={searchingClerk}>
                <Search className="h-4 w-4" />
                {searchingClerk ? 'Buscando' : 'Buscar'}
              </Button>
            </div>
            {clerkSearchResults.length > 0 ? (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                {clerkSearchResults.map((clerkUser) => (
                  <button
                    key={clerkUser.id}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted disabled:opacity-50"
                    disabled={clerkUser.banned}
                    onClick={() => setClerkUserIdInput(clerkUser.id)}
                    type="button"
                  >
                    {clerkUser.avatarUrl ? (
                      <img alt="" className="h-8 w-8 rounded-full object-cover" src={clerkUser.avatarUrl} />
                    ) : (
                      <User className="h-8 w-8 rounded-full bg-muted p-2" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{clerkUser.nombre}</span>
                      <span className="block truncate text-xs text-muted">{clerkUser.email ?? clerkUser.id}</span>
                    </span>
                    {clerkUser.banned ? <Badge variant="danger">Bloqueado</Badge> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Clerk User ID</span>
            <Input
              value={clerkUserIdInput}
              onChange={(e) => setClerkUserIdInput(e.target.value)}
              placeholder="user_2xY..."
            />
            <span className="text-xs text-muted">
              Seleccione un resultado o ingrese el ID manualmente.
            </span>
          </label>

          {clerkStatusForDialog?.clerkLinked && (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <label className="block space-y-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                  <Mail className="h-4 w-4" />
                  Correo de acceso Clerk
                </span>
                <Input
                  type="email"
                  value={clerkEmailInput}
                  onChange={(e) => setClerkEmailInput(e.target.value)}
                  placeholder="usuario@correo.com"
                  disabled={savingClerkEmail}
                />
              </label>
              <p className="text-xs text-emerald-900">
                Al guardar, este correo queda verificado y como único método de acceso por correo. Roles y permisos ERP no cambian.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleClerkEmailUpdate}
                disabled={savingClerkEmail || loadingClerkStatus || !clerkEmailInput.trim()}
              >
                <Mail className="mr-2 h-4 w-4" />
                {savingClerkEmail ? 'Guardando correo' : 'Guardar correo Clerk'}
              </Button>
            </div>
          )}

          {bridge.clerkUserId && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setClerkUserIdInput(bridge.clerkUserId ?? '')}
              disabled={savingClerkStatus}
            >
              Usar Clerk actual de este navegador
            </Button>
          )}

          {!canLinkCurrentTarget && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Solo se puede vincular Clerk a usuarios ERP activos. Puede desvincular un usuario inactivo si ya tenía un vínculo previo.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleClerkLink}
              disabled={savingClerkStatus || loadingClerkStatus || !canLinkCurrentTarget}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {clerkStatusForDialog?.clerkLinked ? 'Actualizar vínculo Clerk' : 'Vincular con Clerk'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClerkUnlink}
              disabled={savingClerkStatus || loadingClerkStatus || !clerkStatusForDialog?.clerkLinked}
            >
              <Unlink2 className="mr-2 h-4 w-4" />
              Desvincular Clerk
            </Button>
            <Button type="button" variant="outline" onClick={closeClerkDialog} disabled={savingClerkStatus || savingClerkEmail}>
              Cerrar
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="space-y-3">
        {usuariosFiltrados.map(u => (
          <Card key={u.id} className="p-4">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${u.super ? 'bg-amber-100 text-amber-700' : u.admin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {u.super ? <ShieldCheck className="h-5 w-5" /> : u.admin ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold">
                    {u.nombre}
                    {u.super && <Badge variant="warning" className="ml-2">Super</Badge>}
                    {u.admin && !u.super && <Badge variant="info" className="ml-2">Admin</Badge>}
                    {u.estado === 'A' && <Badge variant="success" className="ml-2">Activo</Badge>}
                    {u.estado !== 'A' && <Badge variant="danger" className="ml-2">Inactivo</Badge>}
                  </p>
                  <p className="text-sm text-muted">DNI: {u.dni} — Rol: {u.rol} — Creado: {u.creado}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {u.clerkLinked ? (
                      <Badge variant={u.estado === 'A' ? 'info' : 'neutral'}>Clerk vinculado</Badge>
                    ) : (
                      <Badge variant="neutral">Sin Clerk</Badge>
                    )}
                    <span className="font-mono text-muted">
                      {u.clerkUserId ?? 'Sin cclerk_user_id'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {u.permisos.map(p => <Badge key={p} variant="neutral" className="text-xs">{p}</Badge>)}
                    {u.permisos.length === 0 && <span className="text-xs text-muted">Sin modulos asignados</span>}
                  </div>
                  {u.estado !== 'A' && (
                    <p className="mt-2 text-xs text-amber-700">
                      Inactivo: visible para auditoría/gestión; no debe operar POS ni caja.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-start shrink-0">
                <Button size="sm" variant="outline" onClick={() => openClerkDialog(u)}>
                  <KeyRound className="mr-1 h-4 w-4" />
                  Clerk
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Editar</Button>
                {!u.super && (
                  <Button size="sm" variant="outline" onClick={() => toggleEstado(u)}>
                    {u.estado === 'A' ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
                {!u.super && <Button size="sm" variant="outline" onClick={() => resetClave(u)}>Reset clave</Button>}
              </div>
            </div>
          </Card>
        ))}
        {usuariosFiltrados.length === 0 && (
          <Card className="p-6 text-sm text-muted">
            No hay usuarios en esta vista.
          </Card>
        )}
      </div>
    </div>
  )
}
