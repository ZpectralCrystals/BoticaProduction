import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Search, ChevronDown, ChevronRight, Warehouse, BadgeDollarSign, History, Pencil, Trash2, Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  apiGetInventory, apiGetProveedores, apiAddProduct, apiUpdateProduct, apiGetDistribucion, apiGetLocales, apiUpdateProductPrices,
  apiGetPrecioHistorial,
  apiGetFamiliasProducto, apiCreateFamiliaProducto, apiUpdateFamiliaProducto, apiDeleteFamiliaProducto,
  apiGetCategoriasProducto, apiCreateCategoriaProducto, apiUpdateCategoriaProducto, apiDeleteCategoriaProducto,
  apiGetComponentesProducto, apiCreateComponenteProducto, apiUpdateComponenteProducto, apiDeleteComponenteProducto,
} from '@/lib/api'
import type { ApiInventoryItem, ApiProveedor, ApiDistribucionResponse, ApiLocal, ApiProductFamily, ApiProductCategory, ApiProductComponent, ApiPrecioHistorial } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input, inputBaseClassName } from '@/components/ui/input'

const emptyForm = {
  name: '', tipoProducto: 'MEDICAMENTO', generico: '', category: 'Medicamentos', family: '', familyId: '', categoryId: '', presentacion: '',
  laboratorio: '', precioCompra: '', precioVenta1: '', precioVenta2: '', precioVenta3: '', stock: '', minStock: '',
  expiresAt: '', location: '', supplierId: '', rotation: 'Media', receta: 'N', requiereLote: 'S', requiereVencimiento: 'S',
}

const emptyPriceForm = {
  precioVenta1: '',
  precioVenta2: '',
  precioVenta3: '',
}

const emptyCatalogForm = {
  id: 0,
  nombre: '',
  descripcion: '',
  familyId: '',
}

const INITIAL_NOW_MS = Date.now()

interface ProductComponentForm {
  componentId: string
  concentracion: string
  forma: string
  notas: string
}

const emptyProductComponent: ProductComponentForm = {
  componentId: '',
  concentracion: '',
  forma: '',
  notas: '',
}

function formatMoneyInput(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function formatOptionalMoneyInput(value: number | null | undefined) {
  return value === null || value === undefined ? '' : formatMoneyInput(value)
}

function parseOptionalMoneyInput(value: string) {
  if (!value.trim()) return null
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return undefined
  return Number(price.toFixed(2))
}

function getSalePrice1(item: ApiInventoryItem) {
  return item.precioVenta1 ?? item.precioVenta ?? 0
}

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function resolveState(item: ApiInventoryItem, nowMs: number) {
  const exp = item.expiresAt ? Math.ceil((new Date(item.expiresAt).getTime() - nowMs) / 86400000) : 999
  if (exp <= 45) return { label: 'Por vencer', variant: 'warning' as const }
  if (item.stock <= item.minStock) return { label: 'Stock bajo', variant: 'danger' as const }
  return { label: 'Estable', variant: 'success' as const }
}

function isMedicamento(tipoProducto: string) {
  return tipoProducto !== 'NO_MEDICAMENTO'
}

const ALMACEN_COLORS: Record<string, string> = {
  DISPONIBLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  CUARENTENA: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  BAJA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DEVOLUCION_CLIENTE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  DEVOLUCION_PROVEEDOR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  PROCEDIMIENTOS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CONTROL_ESPECIAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

function loteColor(dias: number) {
  if (dias <= 0) return 'text-red-600 font-bold'
  if (dias <= 30) return 'text-red-600 font-semibold'
  if (dias <= 90) return 'text-amber-600'
  return 'text-muted'
}

export function InventoryPage() {
  const [nowMs, setNowMs] = useState(INITIAL_NOW_MS)
  const navigate = useNavigate()
  const [tab, setTab] = useState<'productos' | 'familias' | 'categorias' | 'componentes' | 'distribucion'>('productos')
  const [items, setItems] = useState<ApiInventoryItem[]>([])
  const [proveedores, setProveedores] = useState<ApiProveedor[]>([])
  const [familias, setFamilias] = useState<ApiProductFamily[]>([])
  const [categorias, setCategorias] = useState<ApiProductCategory[]>([])
  const [componentes, setComponentes] = useState<ApiProductComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [familyQuery, setFamilyQuery] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [componentQuery, setComponentQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'expiring' | 'stable'>('all')
  const [showDialog, setShowDialog] = useState(false)
  const [familyDialog, setFamilyDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [componentDialog, setComponentDialog] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formComponents, setFormComponents] = useState<ProductComponentForm[]>([])
  const [familyForm, setFamilyForm] = useState(emptyCatalogForm)
  const [categoryForm, setCategoryForm] = useState(emptyCatalogForm)
  const [componentForm, setComponentForm] = useState(emptyCatalogForm)
  const [saving, setSaving] = useState(false)
  const [savingCatalog, setSavingCatalog] = useState(false)
  const [priceProduct, setPriceProduct] = useState<ApiInventoryItem | null>(null)
  const [priceForm, setPriceForm] = useState(emptyPriceForm)
  const [savingPrice, setSavingPrice] = useState(false)
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<ApiInventoryItem | null>(null)
  const [priceHistory, setPriceHistory] = useState<ApiPrecioHistorial[]>([])
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false)

  // Distribution state
  const [distData, setDistData] = useState<ApiDistribucionResponse | null>(null)
  const [distLoading, setDistLoading] = useState(false)
  const [distSearch, setDistSearch] = useState('')
  const [distLocalFilter, setDistLocalFilter] = useState('')
  const [locales, setLocales] = useState<ApiLocal[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([apiGetInventory(), apiGetProveedores(), apiGetLocales(), apiGetFamiliasProducto(), apiGetCategoriasProducto(), apiGetComponentesProducto()])
      .then(([inv, prov, loc, fam, cat, comp]) => {
        setItems(inv)
        setProveedores(prov)
        setLocales(loc)
        setFamilias(fam)
        setCategorias(cat)
        setComponentes(comp)
      })
      .catch(() => toast.error('Error al cargar inventario'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const loadDistribucion = useCallback(() => {
    setDistLoading(true)
    const params = new URLSearchParams()
    if (distSearch) params.set('search', distSearch)
    if (distLocalFilter) params.set('localId', distLocalFilter)
    const qs = params.toString() ? `?${params.toString()}` : ''
    apiGetDistribucion(qs)
      .then(setDistData)
      .catch(() => toast.error('Error al cargar distribuci\u00f3n'))
      .finally(() => setDistLoading(false))
  }, [distSearch, distLocalFilter])

  useEffect(() => { if (tab === 'distribucion') loadDistribucion() }, [tab, loadDistribucion])

  const toggleExpand = (pid: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(pid)) {
        next.delete(pid)
      } else {
        next.add(pid)
      }
      return next
    })
  }

  const filtered = items.filter(item => {
    const state = resolveState(item, nowMs)
    const mq = !query || `${item.name} ${item.family} ${item.category} ${item.codigo}`.toLowerCase().includes(query.toLowerCase())
    const ms = statusFilter === 'all'
      || (statusFilter === 'low' && state.label === 'Stock bajo')
      || (statusFilter === 'expiring' && state.label === 'Por vencer')
      || (statusFilter === 'stable' && state.label === 'Estable')
    return mq && ms
  })

  const filteredFamilias = familias.filter(f => !familyQuery || f.nombre.toLowerCase().includes(familyQuery.toLowerCase()))
  const filteredCategorias = categorias.filter(c => {
    const haystack = `${c.nombre} ${c.familyName}`.toLowerCase()
    return !categoryQuery || haystack.includes(categoryQuery.toLowerCase())
  })
  const filteredComponentes = componentes.filter(c => !componentQuery || c.nombre.toLowerCase().includes(componentQuery.toLowerCase()))
  const categoriasForProduct = categorias.filter(c => !form.familyId || !c.familyId || String(c.familyId) === form.familyId)

  const summarizeFormComponents = (rows: ProductComponentForm[]) => rows
    .filter(row => row.componentId)
    .map(row => {
      const component = componentes.find(c => String(c.id) === row.componentId)
      return `${component?.nombre || ''}${row.concentracion.trim() ? ` ${row.concentracion.trim()}` : ''}`.trim()
    })
    .filter(Boolean)
    .join(' + ')

  const resolveFamilyId = (item: ApiInventoryItem) => {
    if (item.familyId) return String(item.familyId)
    return String(familias.find(f => normalizeName(f.nombre) === normalizeName(item.family || ''))?.id || '')
  }

  const resolveCategoryId = (item: ApiInventoryItem) => {
    if (item.categoryId) return String(item.categoryId)
    return String(categorias.find(c => normalizeName(c.nombre) === normalizeName(item.category || ''))?.id || '')
  }

  const startCreate = () => {
    setEditId(null)
    setForm(emptyForm)
    setFormComponents([])
    setShowDialog(true)
  }

  const startEdit = (p: ApiInventoryItem) => {
    const familyId = resolveFamilyId(p)
    const categoryId = resolveCategoryId(p)
    setEditId(p.id)
    setForm({
      name: p.name, tipoProducto: p.tipoProducto || 'MEDICAMENTO', generico: p.generico ?? '', category: p.category, family: p.family ?? '',
      familyId, categoryId,
      presentacion: p.presentacion ?? '', laboratorio: p.laboratorio ?? '',
      precioCompra: formatMoneyInput(p.precioCompra),
      precioVenta1: String(getSalePrice1(p) || ''),
      precioVenta2: p.precioVenta2 === null || p.precioVenta2 === undefined ? '' : String(p.precioVenta2),
      precioVenta3: p.precioVenta3 === null || p.precioVenta3 === undefined ? '' : String(p.precioVenta3),
      stock: String(p.stock), minStock: String(p.minStock),
      expiresAt: p.expiresAt ?? '', location: p.location ?? '', supplierId: p.supplierId ?? '',
      rotation: p.rotation || 'Media', receta: p.receta || 'N',
      requiereLote: p.requiereLote === false ? 'N' : 'S',
      requiereVencimiento: p.requiereVencimiento === false ? 'N' : 'S',
    })
    setFormComponents((p.componentes || []).map(component => ({
      componentId: String(component.componenteId || component.id),
      concentracion: component.concentracion || '',
      forma: component.forma || '',
      notas: component.notas || '',
    })))
    setShowDialog(true)
  }

  const startPriceEdit = (p: ApiInventoryItem) => {
    setPriceProduct(p)
    setPriceForm({
      precioVenta1: formatMoneyInput(getSalePrice1(p)),
      precioVenta2: formatOptionalMoneyInput(p.precioVenta2),
      precioVenta3: formatOptionalMoneyInput(p.precioVenta3),
    })
  }

  const closePriceDialog = () => {
    if (savingPrice) return
    setPriceProduct(null)
    setPriceForm(emptyPriceForm)
  }

  const openPriceHistory = async (p: ApiInventoryItem) => {
    setPriceHistoryProduct(p)
    setPriceHistory([])
    setPriceHistoryLoading(true)
    try {
      const rows = await apiGetPrecioHistorial(Number(p.id))
      setPriceHistory(rows)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar historial de precios')
    } finally {
      setPriceHistoryLoading(false)
    }
  }

  const closePriceHistory = () => {
    setPriceHistoryProduct(null)
    setPriceHistory([])
  }

  const submit = async () => {
    const medicamento = isMedicamento(form.tipoProducto)
    if (!form.name.trim()) { toast.error('Nombre es obligatorio'); return }
    if (!form.categoryId) { toast.error('Categoría es obligatoria'); return }
    const selectedFamily = familias.find(f => String(f.id) === form.familyId)
    const selectedCategory = categorias.find(c => String(c.id) === form.categoryId)
    if (!selectedCategory) { toast.error('Categoría inválida'); return }
    const precioVenta1 = Number(form.precioVenta1)
    const precioVenta2 = parseOptionalMoneyInput(form.precioVenta2)
    const precioVenta3 = parseOptionalMoneyInput(form.precioVenta3)
    if (!Number.isFinite(precioVenta1) || precioVenta1 < 0 || precioVenta2 === undefined || precioVenta3 === undefined) {
      toast.error('Precios de venta invalidos')
      return
    }
    if (precioVenta1 <= 0) {
      toast.error('Precio venta 1 debe ser mayor a cero')
      return
    }
    if (formComponents.some(row => !row.componentId && (row.concentracion.trim() || row.forma.trim() || row.notas.trim()))) {
      toast.error('Selecciona el componente para cada fila de composición')
      return
    }
    const componentPayload = formComponents
      .filter(row => row.componentId)
      .map(row => ({
        componenteId: Number(row.componentId),
        concentracion: row.concentracion.trim(),
        forma: row.forma.trim(),
        notas: row.notas.trim(),
      }))
    const componentIds = new Set(componentPayload.map(row => row.componenteId))
    if (componentIds.size !== componentPayload.length) {
      toast.error('No se puede repetir el mismo componente en el producto')
      return
    }
    const composicion = summarizeFormComponents(formComponents)
    if (medicamento && !composicion) {
      toast.error('Agrega al menos un principio activo o composición')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        tipoProducto: form.tipoProducto,
        generico: composicion,
        familyId: selectedFamily?.id || selectedCategory.familyId || null,
        categoryId: selectedCategory.id,
        family: selectedFamily?.nombre || selectedCategory.familyName || '',
        category: selectedCategory.nombre,
        presentacion: form.presentacion, laboratorio: form.laboratorio,
        precioVenta1: Number(precioVenta1.toFixed(2)),
        precioVenta2,
        precioVenta3,
        stock: parseInt(form.stock) || 0, minStock: parseInt(form.minStock) || 0,
        expiresAt: form.expiresAt, location: form.location,
        supplierId: parseInt(form.supplierId) || 0,
        rotation: form.rotation, receta: form.receta,
        requiereLote: medicamento || form.requiereLote === 'S',
        requiereVencimiento: medicamento || form.requiereVencimiento === 'S',
        componentes: componentPayload,
      }
      if (editId) {
        await apiUpdateProduct({ ...payload, id: editId } as Parameters<typeof apiUpdateProduct>[0])
        toast.success('Producto actualizado')
      } else {
        const res = await apiAddProduct(payload as Parameters<typeof apiAddProduct>[0])
        toast.success(`Producto creado: ${res.codigo}`)
      }
      setShowDialog(false)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const submitPrice = async () => {
    if (!priceProduct) return

    const precioVenta1 = Number(priceForm.precioVenta1)
    const precioVenta2 = parseOptionalMoneyInput(priceForm.precioVenta2)
    const precioVenta3 = parseOptionalMoneyInput(priceForm.precioVenta3)

    if (!Number.isFinite(precioVenta1) || precioVenta2 === undefined || precioVenta3 === undefined) {
      toast.error('Precios invalidos')
      return
    }
    if (precioVenta1 < 0) {
      toast.error('Los precios no pueden ser negativos')
      return
    }
    if (precioVenta1 <= 0) {
      toast.error('Precio venta 1 debe ser mayor a cero')
      return
    }

    setSavingPrice(true)
    try {
      await apiUpdateProductPrices({
        id: priceProduct.id,
        precioVenta1: Number(precioVenta1.toFixed(2)),
        precioVenta2,
        precioVenta3,
      })
      toast.success('Precios actualizados')
      setPriceProduct(null)
      setPriceForm(emptyPriceForm)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar precios')
    } finally {
      setSavingPrice(false)
    }
  }

  const openFamilyDialog = (family?: ApiProductFamily) => {
    setFamilyForm(family ? {
      id: family.id,
      nombre: family.nombre,
      descripcion: family.descripcion || '',
      familyId: '',
    } : emptyCatalogForm)
    setFamilyDialog(true)
  }

  const openCategoryDialog = (category?: ApiProductCategory) => {
    setCategoryForm(category ? {
      id: category.id,
      nombre: category.nombre,
      descripcion: category.descripcion || '',
      familyId: category.familyId ? String(category.familyId) : '',
    } : emptyCatalogForm)
    setCategoryDialog(true)
  }

  const openComponentDialog = (component?: ApiProductComponent) => {
    setComponentForm(component ? {
      id: component.id,
      nombre: component.nombre,
      descripcion: component.descripcion || '',
      familyId: '',
    } : emptyCatalogForm)
    setComponentDialog(true)
  }

  const saveFamily = async () => {
    if (!familyForm.nombre.trim()) { toast.error('Nombre obligatorio'); return }
    setSavingCatalog(true)
    try {
      const payload = { nombre: familyForm.nombre.trim(), descripcion: familyForm.descripcion.trim() }
      if (familyForm.id) await apiUpdateFamiliaProducto(familyForm.id, payload)
      else await apiCreateFamiliaProducto(payload)
      toast.success(familyForm.id ? 'Familia actualizada' : 'Familia creada')
      setFamilyDialog(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar familia')
    } finally {
      setSavingCatalog(false)
    }
  }

  const saveCategory = async () => {
    if (!categoryForm.nombre.trim()) { toast.error('Nombre obligatorio'); return }
    setSavingCatalog(true)
    try {
      const payload = {
        nombre: categoryForm.nombre.trim(),
        descripcion: categoryForm.descripcion.trim(),
        familyId: categoryForm.familyId ? Number(categoryForm.familyId) : null,
      }
      if (categoryForm.id) await apiUpdateCategoriaProducto(categoryForm.id, payload)
      else await apiCreateCategoriaProducto(payload)
      toast.success(categoryForm.id ? 'Categoría actualizada' : 'Categoría creada')
      setCategoryDialog(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar categoría')
    } finally {
      setSavingCatalog(false)
    }
  }

  const deleteFamily = async (family: ApiProductFamily) => {
    try {
      await apiDeleteFamiliaProducto(family.id)
      toast.success('Familia eliminada')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la familia')
    }
  }

  const deleteCategory = async (category: ApiProductCategory) => {
    try {
      await apiDeleteCategoriaProducto(category.id)
      toast.success('Categoría eliminada')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la categoría')
    }
  }

  const saveComponent = async () => {
    if (!componentForm.nombre.trim()) { toast.error('Nombre obligatorio'); return }
    setSavingCatalog(true)
    try {
      const payload = { nombre: componentForm.nombre.trim(), descripcion: componentForm.descripcion.trim() }
      if (componentForm.id) await apiUpdateComponenteProducto(componentForm.id, payload)
      else await apiCreateComponenteProducto(payload)
      toast.success(componentForm.id ? 'Componente actualizado' : 'Componente creado')
      setComponentDialog(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar componente')
    } finally {
      setSavingCatalog(false)
    }
  }

  const deleteComponent = async (component: ApiProductComponent) => {
    try {
      await apiDeleteComponenteProducto(component.id)
      toast.success('Componente eliminado')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el componente')
    }
  }

  const lowCount = items.filter(i => i.stock <= i.minStock).length
  const expCount = items.filter(i => {
    const d = i.expiresAt ? Math.ceil((new Date(i.expiresAt).getTime() - nowMs) / 86400000) : 999
    return d <= 45
  }).length
  const priceCosto = Number(priceProduct?.precioCompra || 0)
  const priceVenta = Number(priceForm.precioVenta1 || 0)
  const utilidadMonto = Math.max(0, priceVenta - priceCosto)
  const utilidadPct = priceCosto > 0 ? (utilidadMonto / priceCosto) * 100 : 0
  const precioConIgvReferencial = priceVenta * 1.18

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      {/* ── Tabs ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 shadow-sm">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'productos' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-primary/10 hover:text-primary-strong'}`}
          onClick={() => setTab('productos')}
        >
          Productos
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'familias' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-primary/10 hover:text-primary-strong'}`}
          onClick={() => setTab('familias')}
        >
          Familias
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'categorias' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-primary/10 hover:text-primary-strong'}`}
          onClick={() => setTab('categorias')}
        >
          Categorías
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'componentes' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-primary/10 hover:text-primary-strong'}`}
          onClick={() => setTab('componentes')}
        >
          Componentes
        </button>
        <button
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'distribucion' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-primary/10 hover:text-primary-strong'}`}
          onClick={() => setTab('distribucion')}
        >
          <Warehouse className="h-4 w-4" />
          Stock por almacén
        </button>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* TAB: Productos (original)                 */}
      {/* ══════════════════════════════════════════ */}
      {tab === 'productos' && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-muted">Productos</p>
              <p className="text-2xl font-bold">{items.length}</p>
              <p className="text-xs text-muted">Catálogo activo</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Stock bajo</p>
              <p className="text-2xl font-bold text-red-600">{lowCount}</p>
              <p className="text-xs text-muted">Requiere reposición</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">Por vencer</p>
              <p className="text-2xl font-bold text-amber-600">{expCount}</p>
              <p className="text-xs text-muted">Próximos 45 días</p>
            </Card>
          </div>

          <Card className="p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(260px,1fr)_180px]">
                <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input className="pl-9" placeholder="Buscar nombre, familia, codigo..." value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <select className={inputBaseClassName} value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
                  <option value="all">Todos</option>
                  <option value="low">Stock bajo</option>
                  <option value="expiring">Por vencer</option>
                  <option value="stable">Estable</option>
                </select>
              </div>
              <Button onClick={startCreate}><Plus className="h-4 w-4" /> Nuevo producto</Button>
            </div>
          </Card>

          <Dialog open={showDialog} onClose={() => setShowDialog(false)} className="max-w-3xl">
            <DialogTitle>{editId ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
                  <span className="text-sm font-semibold">Nombre comercial *</span>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Panadol Forte" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Tipo producto *</span>
                  <select
                    className={inputBaseClassName}
                    value={form.tipoProducto}
                    onChange={e => {
                      const tipoProducto = e.target.value
                      setForm({
                        ...form,
                        tipoProducto,
                        requiereLote: tipoProducto === 'MEDICAMENTO' ? 'S' : 'N',
                        requiereVencimiento: tipoProducto === 'MEDICAMENTO' ? 'S' : 'N',
                      })
                    }}
                  >
                    <option value="MEDICAMENTO">Medicamento</option>
                    <option value="NO_MEDICAMENTO">No medicamento</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Familia</span>
                  <select
                    className={inputBaseClassName}
                    value={form.familyId}
                    onChange={e => setForm({ ...form, familyId: e.target.value, categoryId: '' })}
                  >
                    <option value="">Sin familia</option>
                    {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Categoria *</span>
                  <select
                    className={inputBaseClassName}
                    value={form.categoryId}
                    onChange={e => {
                      const category = categorias.find(c => String(c.id) === e.target.value)
                      setForm({
                        ...form,
                        categoryId: e.target.value,
                        familyId: category?.familyId ? String(category.familyId) : form.familyId,
                      })
                    }}
                  >
                    <option value="">Seleccionar categoría</option>
                    {categoriasForProduct.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
                <div className="space-y-3 rounded-lg border border-border p-3 sm:col-span-2 lg:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Composición / principios activos{isMedicamento(form.tipoProducto) ? ' *' : ''}</p>
                      {summarizeFormComponents(formComponents) && (
                        <p className="text-xs text-muted">{summarizeFormComponents(formComponents)}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFormComponents([...formComponents, { ...emptyProductComponent }])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar
                    </Button>
                  </div>

                  {formComponents.length === 0 ? (
                    <p className="text-sm text-muted">Sin componentes agregados</p>
                  ) : (
                    <div className="space-y-2">
                      {formComponents.map((row, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
                          <select
                            className={inputBaseClassName}
                            value={row.componentId}
                            onChange={e => setFormComponents(formComponents.map((item, i) => i === index ? { ...item, componentId: e.target.value } : item))}
                          >
                            <option value="">Seleccionar componente</option>
                            {componentes.map(component => <option key={component.id} value={component.id}>{component.nombre}</option>)}
                          </select>
                          <Input
                            value={row.concentracion}
                            onChange={e => setFormComponents(formComponents.map((item, i) => i === index ? { ...item, concentracion: e.target.value } : item))}
                            placeholder="500mg"
                          />
                          <Input
                            value={row.forma}
                            onChange={e => setFormComponents(formComponents.map((item, i) => i === index ? { ...item, forma: e.target.value } : item))}
                            placeholder="Tableta"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFormComponents(formComponents.filter((_, i) => i !== index))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Input
                            className="sm:col-span-3"
                            value={row.notas}
                            onChange={e => setFormComponents(formComponents.map((item, i) => i === index ? { ...item, notas: e.target.value } : item))}
                            placeholder="Notas opcionales"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Requiere lote</span>
                  <select
                    className={inputBaseClassName}
                    value={isMedicamento(form.tipoProducto) ? 'S' : form.requiereLote}
                    disabled={isMedicamento(form.tipoProducto)}
                    onChange={e => setForm({ ...form, requiereLote: e.target.value })}
                  >
                    <option value="S">Si</option>
                    <option value="N">No</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Requiere vencimiento</span>
                  <select
                    className={inputBaseClassName}
                    value={isMedicamento(form.tipoProducto) ? 'S' : form.requiereVencimiento}
                    disabled={isMedicamento(form.tipoProducto)}
                    onChange={e => setForm({ ...form, requiereVencimiento: e.target.value })}
                  >
                    <option value="S">Si</option>
                    <option value="N">No</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Presentacion</span>
                  <Input value={form.presentacion} onChange={e => setForm({ ...form, presentacion: e.target.value })} placeholder="Caja x 10 tab" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Laboratorio</span>
                  <Input value={form.laboratorio} onChange={e => setForm({ ...form, laboratorio: e.target.value })} placeholder="Genfar" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">P. Compra (solo lectura)</span>
                  <Input type="number" step="0.01" value={form.precioCompra} readOnly disabled placeholder="0.00" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Precio venta 1</span>
                  <Input type="number" step="0.01" min="0" value={form.precioVenta1} onChange={e => setForm({ ...form, precioVenta1: e.target.value })} placeholder="0.00" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Precio venta 2</span>
                  <Input type="number" step="0.01" min="0" value={form.precioVenta2} onChange={e => setForm({ ...form, precioVenta2: e.target.value })} placeholder="Opcional" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Precio venta 3</span>
                  <Input type="number" step="0.01" min="0" value={form.precioVenta3} onChange={e => setForm({ ...form, precioVenta3: e.target.value })} placeholder="Opcional" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Stock{editId ? ' (solo lectura)' : ''}</span>
                  {editId ? (
                    <div className="px-4 py-3 border border-border rounded-lg bg-muted/30 text-foreground font-medium">{form.stock || '0'}</div>
                  ) : (
                    <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                  )}
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Stock minimo</span>
                  <Input type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="0" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Vencimiento</span>
                  <Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Ubicacion</span>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Vitrina A5" />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Proveedor</span>
                  <select className={inputBaseClassName} value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.nid} value={p.nid}>{p.cnombre.trim()}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Rotacion</span>
                  <select className={inputBaseClassName} value={form.rotation} onChange={e => setForm({ ...form, rotation: e.target.value })}>
                    <option>Alta</option>
                    <option>Media</option>
                    <option>Baja</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold">Receta</span>
                  <select className={inputBaseClassName} value={form.receta} onChange={e => setForm({ ...form, receta: e.target.value })}>
                    <option value="N">No</option>
                    <option value="S">Si</option>
                  </select>
                </label>
              </div>
              <div className="flex gap-3">
                <Button onClick={submit} disabled={saving}>{saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear producto'}</Button>
                <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              </div>
            </div>
          </Dialog>

          <Dialog open={!!priceProduct} onClose={closePriceDialog} className="max-w-4xl">
            <DialogTitle>Editar Precio Producto</DialogTitle>
            {priceProduct && (
              <div className="mt-4 space-y-5">
                <div className="rounded-lg border border-primary/15 bg-primary/10 px-4 py-3 text-sm text-primary-strong">
                  El costo viene de compras/lotes. Aquí solo se configuran precios de venta comerciales.
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Código</span>
                    <Input value={priceProduct.codigo} disabled />
                  </label>
                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-sm font-semibold">Nombre</span>
                    <Input value={priceProduct.name} disabled />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Familia</span>
                    <Input value={priceProduct.family || '-'} disabled />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Costo compra</span>
                    <Input value={`S/ ${priceProduct.precioCompra.toFixed(2)}`} disabled />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Utilidad %</span>
                    <Input value={`${utilidadPct.toFixed(2)}%`} disabled />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Valor venta</span>
                    <Input value={`S/ ${priceVenta.toFixed(2)}`} disabled />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Precio venta 1</span>
                    <Input
                      min="0"
                      step="0.01"
                      type="number"
                      value={priceForm.precioVenta1}
                      onChange={e => setPriceForm({ ...priceForm, precioVenta1: e.target.value })}
                      onBlur={e => setPriceForm({ ...priceForm, precioVenta1: formatMoneyInput(Number(e.target.value || 0)) })}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Precio venta 2</span>
                    <Input
                      min="0"
                      step="0.01"
                      type="number"
                      value={priceForm.precioVenta2}
                      onChange={e => setPriceForm({ ...priceForm, precioVenta2: e.target.value })}
                      onBlur={e => setPriceForm({ ...priceForm, precioVenta2: e.target.value ? formatMoneyInput(Number(e.target.value || 0)) : '' })}
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Precio venta 3</span>
                    <Input
                      min="0"
                      step="0.01"
                      type="number"
                      value={priceForm.precioVenta3}
                      onChange={e => setPriceForm({ ...priceForm, precioVenta3: e.target.value })}
                      onBlur={e => setPriceForm({ ...priceForm, precioVenta3: e.target.value ? formatMoneyInput(Number(e.target.value || 0)) : '' })}
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold">Precio + IGV</span>
                    <Input value={`S/ ${precioConIgvReferencial.toFixed(2)}`} disabled />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="p-4">
                    <p className="text-xs text-muted">Utilidad estimada</p>
                    <p className="text-lg font-semibold">S/ {utilidadMonto.toFixed(2)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted">Precio actual 1</p>
                    <p className="text-lg font-semibold">S/ {getSalePrice1(priceProduct).toFixed(2)}</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-xs text-muted">Campos DB usados</p>
                    <p className="text-sm font-mono">npreventa, npreventa_2, npreventa_3</p>
                  </Card>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={submitPrice} disabled={savingPrice}>
                    {savingPrice ? 'Guardando...' : 'Guardar precios'}
                  </Button>
                  <Button variant="outline" onClick={closePriceDialog}>Cancelar</Button>
                </div>
              </div>
            )}
          </Dialog>

          <Dialog open={!!priceHistoryProduct} onClose={closePriceHistory} className="max-w-4xl">
            <DialogTitle>Historial de precios</DialogTitle>
            {priceHistoryProduct && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="font-semibold">{priceHistoryProduct.name}</p>
                  <p className="text-sm text-muted">{priceHistoryProduct.codigo} · {priceHistoryProduct.family || '-'} / {priceHistoryProduct.category || '-'}</p>
                </div>

                {priceHistoryLoading ? (
                  <p className="py-8 text-center text-muted">Cargando historial...</p>
                ) : priceHistory.length === 0 ? (
                  <p className="py-8 text-center text-muted">Sin cambios de precio registrados</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30 text-left text-muted">
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">Precio</th>
                          <th className="px-3 py-2">Anterior</th>
                          <th className="px-3 py-2">Nuevo</th>
                          <th className="px-3 py-2">Acción</th>
                          <th className="px-3 py-2">Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceHistory.map(row => (
                          <tr key={row.nid} className="border-b last:border-0">
                            <td className="px-3 py-2 text-muted">{row.fecha}</td>
                            <td className="px-3 py-2 font-semibold">{row.slot.replace('_', ' ')}</td>
                            <td className="px-3 py-2">{row.precioAnterior === null ? '-' : `S/${row.precioAnterior.toFixed(2)}`}</td>
                            <td className="px-3 py-2 font-semibold">S/{row.precioNuevo.toFixed(2)}</td>
                            <td className="px-3 py-2">
                              <Badge variant={row.accion === 'UPDATE' ? 'info' : row.accion === 'INSERT' ? 'success' : 'neutral'}>
                                {row.accion}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted">{row.usuario || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" onClick={closePriceHistory}>Cerrar</Button>
                </div>
              </div>
            )}
          </Dialog>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-muted">
                  <tr className="border-b text-left">
                    <th className="px-4 py-3">Codigo</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Composición</th>
                    <th className="px-4 py-3">Familia/Categoría</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">P.Venta</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Lote FEFO</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const state = resolveState(item, nowMs)
                    return (
                      <tr key={item.id} className="border-b transition-colors last:border-0 hover:bg-primary/5">
                        <td className="px-4 py-3 font-mono text-xs">{item.codigo}</td>
                        <td className="px-4 py-3 font-semibold">
                          {item.name}
                          {item.receta === 'S' && <span className="ml-1 text-xs text-red-500">[Rx]</span>}
                          {item.tipoProducto === 'NO_MEDICAMENTO' && <Badge className="ml-2" variant="neutral">No med.</Badge>}
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted">{item.composicion || item.generico || '-'}</td>
                        <td className="px-4 py-3 text-xs">
                          <p>{item.family || '-'}</p>
                          <p className="text-muted">{item.category || '-'}</p>
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-3 text-xs text-muted">{item.supplier || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <p>S/{getSalePrice1(item).toFixed(2)}</p>
                            {(item.precioVenta2 || item.precioVenta3) && (
                              <p className="text-xs text-muted">
                                {[item.precioVenta2 ? `P2 S/${item.precioVenta2.toFixed(2)}` : '', item.precioVenta3 ? `P3 S/${item.precioVenta3.toFixed(2)}` : ''].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={item.stock <= item.minStock ? 'text-red-600 font-semibold' : ''}>
                            {item.stock}
                          </span>
                          <span className="text-muted">/{item.minStock}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.lotePrincipal ? (
                            <div>
                              <span className="font-mono">{item.lotePrincipal.codigo || 'S/C'}</span>
                              <br />
                              <span className={item.lotePrincipal.diasParaVencer <= 30 ? 'text-red-600 font-semibold' : item.lotePrincipal.diasParaVencer <= 90 ? 'text-amber-600' : 'text-muted'}>
                                {item.lotePrincipal.vencimiento} ({item.lotePrincipal.diasParaVencer}d)
                              </span>
                              {item.totalLotes > 1 && <span className="ml-1 text-muted">+{item.totalLotes - 1} más</span>}
                            </div>
                          ) : (
                            <span className="text-muted">Sin lote</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><Badge variant={state.variant}>{state.label}</Badge></td>
                        <td className="w-[132px] px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              aria-label={`Editar precios de ${item.name}`}
                              className="h-8 w-8 rounded-full p-0"
                              size="icon"
                              title="Editar precios"
                              variant="outline"
                              onClick={() => startPriceEdit(item)}
                            >
                              <BadgeDollarSign className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={`Ver historial de precios de ${item.name}`}
                              className="h-8 w-8 rounded-full p-0"
                              size="icon"
                              title="Historial de precios"
                              variant="outline"
                              onClick={() => openPriceHistory(item)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={`Editar ${item.name}`}
                              className="h-8 w-8 rounded-full p-0"
                              size="icon"
                              title="Editar producto"
                              variant="outline"
                              onClick={() => startEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {item.stock <= item.minStock && (
                              <Button size="sm" variant="outline" onClick={() => navigate('/panel/compras')}>Registrar compra</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-muted">Sin productos</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'familias' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Buscar familia..." value={familyQuery} onChange={e => setFamilyQuery(e.target.value)} />
            </div>
            <Button onClick={() => openFamilyDialog()}>Nueva familia</Button>
          </div>

          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted">
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Descripción</th>
                    <th className="pb-2">Productos</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFamilias.map(f => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 font-semibold">{f.nombre}</td>
                      <td className="text-muted">{f.descripcion || '-'}</td>
                      <td>{f.productosCount}</td>
                      <td><Badge variant={f.estado === 'A' ? 'success' : 'neutral'}>{f.estado === 'A' ? 'Activo' : 'Inactivo'}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openFamilyDialog(f)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteFamily(f)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFamilias.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted">Sin familias</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Dialog open={familyDialog} onClose={() => setFamilyDialog(false)} className="max-w-md">
            <DialogTitle>{familyForm.id ? 'Editar familia' : 'Nueva familia'}</DialogTitle>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Nombre *</span>
                <Input value={familyForm.nombre} onChange={e => setFamilyForm({ ...familyForm, nombre: e.target.value })} placeholder="Analgésicos" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Descripción</span>
                <Input value={familyForm.descripcion} onChange={e => setFamilyForm({ ...familyForm, descripcion: e.target.value })} placeholder="Opcional" />
              </label>
              <div className="flex gap-3">
                <Button onClick={saveFamily} disabled={savingCatalog}>{savingCatalog ? 'Guardando...' : 'Guardar'}</Button>
                <Button variant="outline" onClick={() => setFamilyDialog(false)}>Cancelar</Button>
              </div>
            </div>
          </Dialog>
        </>
      )}

      {tab === 'categorias' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Buscar categoría..." value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)} />
            </div>
            <Button onClick={() => openCategoryDialog()}>Nueva categoría</Button>
          </div>

          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted">
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Familia</th>
                    <th className="pb-2">Descripción</th>
                    <th className="pb-2">Productos</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategorias.map(c => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 font-semibold">{c.nombre}</td>
                      <td>{c.familyName || '-'}</td>
                      <td className="text-muted">{c.descripcion || '-'}</td>
                      <td>{c.productosCount}</td>
                      <td><Badge variant={c.estado === 'A' ? 'success' : 'neutral'}>{c.estado === 'A' ? 'Activo' : 'Inactivo'}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openCategoryDialog(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteCategory(c)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategorias.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted">Sin categorías</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Dialog open={categoryDialog} onClose={() => setCategoryDialog(false)} className="max-w-md">
            <DialogTitle>{categoryForm.id ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Familia</span>
                <select className={inputBaseClassName} value={categoryForm.familyId} onChange={e => setCategoryForm({ ...categoryForm, familyId: e.target.value })}>
                  <option value="">Sin familia</option>
                  {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Nombre *</span>
                <Input value={categoryForm.nombre} onChange={e => setCategoryForm({ ...categoryForm, nombre: e.target.value })} placeholder="Medicamentos" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Descripción</span>
                <Input value={categoryForm.descripcion} onChange={e => setCategoryForm({ ...categoryForm, descripcion: e.target.value })} placeholder="Opcional" />
              </label>
              <div className="flex gap-3">
                <Button onClick={saveCategory} disabled={savingCatalog}>{savingCatalog ? 'Guardando...' : 'Guardar'}</Button>
                <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancelar</Button>
              </div>
            </div>
          </Dialog>
        </>
      )}

      {tab === 'componentes' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Buscar componente..." value={componentQuery} onChange={e => setComponentQuery(e.target.value)} />
            </div>
            <Button onClick={() => openComponentDialog()}>Nuevo componente</Button>
          </div>

          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted">
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Descripción</th>
                    <th className="pb-2">Productos</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComponentes.map(component => (
                    <tr key={component.id} className="border-b last:border-0">
                      <td className="py-2 font-semibold">{component.nombre}</td>
                      <td className="text-muted">{component.descripcion || '-'}</td>
                      <td>{component.productosCount}</td>
                      <td><Badge variant={component.estado === 'A' ? 'success' : 'neutral'}>{component.estado === 'A' ? 'Activo' : 'Inactivo'}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openComponentDialog(component)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteComponent(component)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredComponentes.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted">Sin componentes</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Dialog open={componentDialog} onClose={() => setComponentDialog(false)} className="max-w-md">
            <DialogTitle>{componentForm.id ? 'Editar componente' : 'Nuevo componente'}</DialogTitle>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Nombre *</span>
                <Input value={componentForm.nombre} onChange={e => setComponentForm({ ...componentForm, nombre: e.target.value })} placeholder="Paracetamol" />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Descripción</span>
                <Input value={componentForm.descripcion} onChange={e => setComponentForm({ ...componentForm, descripcion: e.target.value })} placeholder="Opcional" />
              </label>
              <div className="flex gap-3">
                <Button onClick={saveComponent} disabled={savingCatalog}>{savingCatalog ? 'Guardando...' : 'Guardar'}</Button>
                <Button variant="outline" onClick={() => setComponentDialog(false)}>Cancelar</Button>
              </div>
            </div>
          </Dialog>
        </>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* TAB: Stock por almacén (distribución)     */}
      {/* ══════════════════════════════════════════ */}
      {tab === 'distribucion' && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{distData?.totalProductos ?? 0}</p>
              <p className="text-sm text-muted">Productos con stock</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{distData?.totalStockVendible ?? 0}</p>
              <p className="text-sm text-muted">Stock vendible</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{distData?.totalStockNoVendible ?? 0}</p>
              <p className="text-sm text-muted">Stock no vendible</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold">{(distData?.totalStockVendible ?? 0) + (distData?.totalStockNoVendible ?? 0)}</p>
              <p className="text-sm text-muted">Stock total</p>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Buscar producto..." value={distSearch} onChange={e => setDistSearch(e.target.value)} />
            </div>
            <select className={inputBaseClassName + ' max-w-[200px]'} value={distLocalFilter} onChange={e => setDistLocalFilter(e.target.value)}>
              <option value="">Todos los locales</option>
              {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <Button variant="outline" onClick={loadDistribucion} disabled={distLoading}>{distLoading ? 'Cargando...' : 'Actualizar'}</Button>
          </div>

          {/* Distribution table */}
          <Card className="p-6">
            {distLoading && !distData ? (
              <p className="text-center text-muted py-8">Cargando distribución...</p>
            ) : (
              <div className="space-y-1">
                {(distData?.productos ?? []).map(prod => {
                  const isOpen = expanded.has(prod.productoId)
                  return (
                    <div key={prod.productoId} className="border border-border rounded-lg overflow-hidden">
                      {/* Product row (clickable) */}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                        onClick={() => toggleExpand(prod.productoId)}
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted shrink-0" />}
                        <span className="font-mono text-xs text-muted w-20 shrink-0">{prod.productoCodigo}</span>
                        <span className="font-semibold flex-1 truncate">{prod.productoNombre}</span>
                        <div className="flex items-center gap-3 shrink-0 text-sm">
                          <span className="text-emerald-600 font-semibold" title="Vendible">{prod.stockVendible}</span>
                          <span className="text-muted">/</span>
                          {prod.stockNoVendible > 0 && (
                            <span className="text-amber-600 font-semibold" title="No vendible">{prod.stockNoVendible}</span>
                          )}
                          <span className="font-bold w-12 text-right">{prod.stockTotal}</span>
                          <span className="text-xs text-muted">en {prod.almacenes.length} alm.</span>
                        </div>
                      </button>

                      {/* Expanded: almacenes + lotes */}
                      {isOpen && (
                        <div className="border-t border-border bg-muted/10">
                          {prod.almacenes.map(alm => (
                            <div key={alm.almacenId} className="border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-3 px-4 py-2 pl-12">
                                <Warehouse className="h-3.5 w-3.5 text-muted shrink-0" />
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ALMACEN_COLORS[alm.tipoAlmacen] || 'bg-gray-100 text-gray-800'}`}>
                                  {alm.tipoAlmacen.replace(/_/g, ' ')}
                                </span>
                                <span className="text-sm font-medium">{alm.almacenNombre}</span>
                                <span className="text-xs text-muted">({alm.localNombre})</span>
                                <div className="ml-auto flex items-center gap-2 text-sm">
                                  {alm.permiteVenta && <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded">Venta</span>}
                                  {alm.permiteConsumoClinico && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-1.5 py-0.5 rounded">Clínico</span>}
                                  <span className="font-semibold w-10 text-right">{alm.stock}</span>
                                </div>
                              </div>
                              {/* Lotes inside this almacen */}
                              {alm.lotes.length > 0 && (
                                <div className="pl-20 pr-4 pb-2">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted">
                                        <th className="text-left pb-1 font-medium">Lote</th>
                                        <th className="text-left pb-1 font-medium">Vencimiento</th>
                                        <th className="text-right pb-1 font-medium">Días</th>
                                        <th className="text-right pb-1 font-medium">Cant.</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {alm.lotes.map(lote => (
                                        <tr key={lote.id}>
                                          <td className="py-0.5 font-mono">{lote.codigoLote}</td>
                                          <td className={loteColor(lote.diasParaVencer)}>{lote.vencimiento}</td>
                                          <td className={`text-right ${loteColor(lote.diasParaVencer)}`}>
                                            {lote.diasParaVencer <= 0 ? 'VENCIDO' : `${lote.diasParaVencer}d`}
                                          </td>
                                          <td className="text-right font-semibold">{lote.cantidad}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {(distData?.productos ?? []).length === 0 && !distLoading && (
                  <p className="text-center text-muted py-8">No hay productos con stock en almacenes</p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
