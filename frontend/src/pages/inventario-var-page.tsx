import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { apiGetInvVar, apiSaveInvVar } from '@/lib/api'
import type { ApiInvVar } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function InventarioVarPage() {
  const [data, setData] = useState<ApiInvVar[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', categoria: '', descripcion: '', cantidad: '1', valor: '', ubicacion: '' })

  const load = useCallback(() => {
    setLoading(true)
    apiGetInvVar().then(setData).catch(() => toast.error('Error')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    try {
      await apiSaveInvVar({ ...form, id: editId ? Number(editId) : undefined, cantidad: parseInt(form.cantidad) || 1, valor: parseFloat(form.valor) || 0 })
      toast.success(editId ? 'Item actualizado' : 'Item registrado')
      setShowForm(false); setEditId(null); setForm({ nombre: '', categoria: '', descripcion: '', cantidad: '1', valor: '', ubicacion: '' }); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const startCreate = () => {
    setEditId(null)
    setForm({ nombre: '', categoria: '', descripcion: '', cantidad: '1', valor: '', ubicacion: '' })
    setShowForm(true)
  }

  const startEdit = (item: ApiInvVar) => {
    setEditId(item.nid)
    setForm({
      nombre: item.cnombre?.trim() || '',
      categoria: item.ccategoria?.trim() || '',
      descripcion: item.cdescripcion?.trim() || '',
      cantidad: String(item.ncantidad || '1'),
      valor: String(item.nvalor || ''),
      ubicacion: item.cubicacion?.trim() || '',
    })
    setShowForm(true)
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{data.length} item(s) — Valor total: S/{data.reduce((s, d) => s + parseFloat(d.nvalor) * parseInt(d.ncantidad), 0).toFixed(2)}</p>
        <Button onClick={() => showForm ? setShowForm(false) : startCreate()}>{showForm ? 'Cancelar' : 'Nuevo item'}</Button>
      </div>
      {showForm && (
        <Card className="p-6 space-y-3">
          <Input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Categoria (ej: Renaware)" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
            <Input type="number" placeholder="Cantidad" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: e.target.value })} />
            <Input type="number" placeholder="Valor unitario S/" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
          </div>
          <Input placeholder="Ubicacion" value={form.ubicacion} onChange={e => setForm({ ...form, ubicacion: e.target.value })} />
          <Input placeholder="Descripcion" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          <Button onClick={submit}>{editId ? 'Guardar cambios' : 'Guardar'}</Button>
        </Card>
      )}
      <Card className="p-6">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted"><th className="pb-2">Nombre</th><th className="pb-2">Categoria</th><th className="pb-2">Cant</th><th className="pb-2">Valor</th><th className="pb-2">Ubicacion</th><th className="pb-2">Estado</th><th className="pb-2 text-right">Acciones</th></tr></thead><tbody>
          {data.map(d => (
            <tr key={d.nid} className="border-b last:border-0">
              <td className="py-2 font-medium">{d.cnombre?.trim()}</td>
              <td>{d.ccategoria?.trim()}</td>
              <td>{d.ncantidad}</td>
              <td>S/{parseFloat(d.nvalor).toFixed(2)}</td>
              <td className="text-muted">{d.cubicacion?.trim()}</td>
              <td><Badge variant={d.cestado === 'A' ? 'success' : 'neutral'}>{d.cestado === 'A' ? 'Activo' : d.cestado === 'P' ? 'Prestado' : 'Inactivo'}</Badge></td>
              <td className="text-right">
                <Button size="sm" variant="outline" onClick={() => startEdit(d)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>
              </td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-muted">Sin items registrados</td></tr>}
        </tbody></table></div>
      </Card>
    </div>
  )
}
