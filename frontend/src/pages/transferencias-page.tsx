import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetTransferencias, apiAddTransferencia, apiGetInventory } from '@/lib/api'
import type { ApiTransferencia, ApiInventoryItem } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const TIPOS = ['Transferencia', 'Muestra', 'Donacion', 'Regalo', 'Merma', 'Entrada'] as const

export function TransferenciasPage() {
  const [data, setData] = useState<ApiTransferencia[]>([])
  const [productos, setProductos] = useState<ApiInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tipo: 'Transferencia', origen: '', destino: '', motivo: '' })
  const [items, setItems] = useState<{ productoId: string; cantidad: string; notas: string }[]>([])

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([apiGetTransferencias(), apiGetInventory()])
      .then(([t, p]) => { setData(t); setProductos(p) })
      .catch(() => toast.error('Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    try {
      const res = await apiAddTransferencia({
        ...form,
        items: items.filter(i => i.productoId).map(i => ({ productoId: parseInt(i.productoId), cantidad: parseInt(i.cantidad) || 1, notas: i.notas })),
      })
      toast.success(`Transferencia ${res.codigo} registrada`)
      setShowForm(false); setForm({ tipo: 'Transferencia', origen: '', destino: '', motivo: '' }); setItems([]); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{data.length} movimiento(s)</p>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo movimiento'}</Button>
      </div>

      {showForm && (
        <Card className="p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span className="text-sm font-semibold">Tipo</span>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
            <Input placeholder="Motivo" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} />
            <Input placeholder="Origen" value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} />
            <Input placeholder="Destino" value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { productoId: '', cantidad: '1', notas: '' }])}>+ Producto</Button>
            {items.map((item, i) => (
              <div key={i} className="grid gap-2 grid-cols-3">
                <select className="rounded-lg border px-3 py-2 text-sm" value={item.productoId} onChange={e => { const n = [...items]; n[i].productoId = e.target.value; setItems(n) }}>
                  <option value="">Producto...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.name.trim()}</option>)}
                </select>
                <Input placeholder="Cant" value={item.cantidad} onChange={e => { const n = [...items]; n[i].cantidad = e.target.value; setItems(n) }} />
                <Input placeholder="Notas" value={item.notas} onChange={e => { const n = [...items]; n[i].notas = e.target.value; setItems(n) }} />
              </div>
            ))}
          </div>
          <Button onClick={submit}>Registrar</Button>
        </Card>
      )}

      <div className="space-y-3">
        {data.map(t => (
          <Card key={t.nid} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{t.ccodigo?.trim()} <Badge variant="neutral">{t.ctipo?.trim()}</Badge></p>
                <p className="text-sm text-muted">{t.cmotivo?.trim() || 'Sin motivo'}</p>
                {t.corigen?.trim() && <p className="text-xs text-muted">De: {t.corigen.trim()} → {t.cdestino?.trim()}</p>}
              </div>
              <span className="text-xs text-muted">{t.tcreado}</span>
            </div>
            {t.detalle?.length > 0 && (
              <div className="mt-2 text-xs space-y-1">{t.detalle.map((d, i) => <p key={i}>• {String(d.producto).trim()} x{String(d.ncantidad)}</p>)}</div>
            )}
          </Card>
        ))}
        {data.length === 0 && <p className="text-center text-muted py-8">Sin movimientos registrados</p>}
      </div>
    </div>
  )
}
