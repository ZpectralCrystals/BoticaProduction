import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { apiGetLocales, apiSaveLocal } from '@/lib/api'
import type { ApiLocal } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input, inputBaseClassName } from '@/components/ui/input'

const TIPOS_LOCAL = ['BOTICA', 'CLINICA', 'OTRO'] as const

export function LocalesPage() {
  const [items, setItems] = useState<ApiLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editItem, setEditItem] = useState<ApiLocal | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiGetLocales()
      .then(setItems)
      .catch(() => toast.error('Error al cargar locales'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditItem(null); setShowDialog(true) }
  const startEdit = (l: ApiLocal) => { setEditItem(l); setShowDialog(true) }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    const codigo = String(data.get('codigo') ?? '').trim()
    if (!nombre) { toast.error('Nombre es obligatorio'); return }
    if (!codigo) { toast.error('Código es obligatorio'); return }
    setSaving(true)
    try {
      await apiSaveLocal({
        nombre,
        codigo,
        tipoLocal: String(data.get('tipoLocal') ?? 'BOTICA'),
        direccion: String(data.get('direccion') ?? '').trim(),
        telefono: String(data.get('telefono') ?? '').trim(),
        ...(editItem ? { id: editItem.id } : {}),
      })
      toast.success(editItem ? 'Local actualizado' : 'Local creado')
      setShowDialog(false)
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando locales...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Locales</h2>
          <p className="text-sm text-muted">{items.length} local(es) registrado(s)</p>
        </div>
        <Button onClick={openNew}>Nuevo local</Button>
      </div>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>{editItem ? 'Editar local' : 'Nuevo local'}</DialogTitle>
        {/* key forces re-mount between create/edit so defaultValues are fresh */}
        <form key={editItem?.id ?? 'new'} onSubmit={handleSubmit} className="space-y-3 mt-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Nombre *</span>
            <Input name="nombre" defaultValue={editItem?.nombre ?? ''} placeholder="Botica El Pueblo" required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Código *</span>
            <Input name="codigo" defaultValue={editItem?.codigo ?? ''} placeholder="LOC-BOTICA" required />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Tipo de local *</span>
            <select name="tipoLocal" className={inputBaseClassName} defaultValue={editItem?.tipoLocal ?? 'BOTICA'}>
              {TIPOS_LOCAL.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Dirección</span>
            <Input name="direccion" defaultValue={editItem?.direccion ?? ''} placeholder="Av. Ejemplo 123" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Teléfono</span>
            <Input name="telefono" defaultValue={editItem?.telefono ?? ''} placeholder="01-2345678" />
          </label>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Crear local'}
          </Button>
        </form>
      </Dialog>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted">
                <th className="pb-2">Código</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Dirección</th>
                <th className="pb-2">Almacenes</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{l.codigo}</td>
                  <td className="py-2 font-semibold">{l.nombre}</td>
                  <td className="py-2">
                    <Badge variant={l.tipoLocal === 'BOTICA' ? 'success' : l.tipoLocal === 'CLINICA' ? 'warning' : 'neutral'}>{l.tipoLocal}</Badge>
                  </td>
                  <td className="py-2 text-muted text-xs">{l.direccion || '-'}</td>
                  <td className="py-2 text-center">{l.almacenesCount}</td>
                  <td className="py-2"><Button type="button" size="sm" variant="outline" onClick={() => startEdit(l)}>Editar</Button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted">Sin locales</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
