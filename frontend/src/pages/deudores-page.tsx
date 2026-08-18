import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetDeudores, apiAddDeudor, apiAbonarDeuda } from '@/lib/api'
import type { ApiDeudor } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function DeudoresPage() {
  const [data, setData] = useState<ApiDeudor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', dni: '', telefono: '', concepto: '', monto: '', vencimiento: '', notas: '' })
  const [abonoId, setAbonoId] = useState<string | null>(null)
  const [abonoMonto, setAbonoMonto] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    apiGetDeudores().then(setData).catch(() => toast.error('Error')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    try {
      await apiAddDeudor({ ...form, monto: parseFloat(form.monto) || 0 })
      toast.success('Deudor registrado')
      setShowForm(false); setForm({ nombre: '', dni: '', telefono: '', concepto: '', monto: '', vencimiento: '', notas: '' }); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const abonar = async (id: string) => {
    try {
      await apiAbonarDeuda(parseInt(id), parseFloat(abonoMonto) || 0)
      toast.success('Abono registrado')
      setAbonoId(null); setAbonoMonto(''); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  const estados = { P: 'Pendiente', A: 'Abonando', C: 'Cancelado' } as Record<string, string>
  const estadoVariant = { P: 'warning', A: 'info', C: 'success' } as Record<string, 'warning' | 'info' | 'success'>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{data.length} deudor(es) — Saldo total: S/{data.reduce((s, d) => s + parseFloat(d.saldo), 0).toFixed(2)}</p>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo deudor'}</Button>
      </div>
      {showForm && (
        <Card className="p-6 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            <Input placeholder="DNI" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
            <Input placeholder="Telefono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <Input placeholder="Concepto de la deuda" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="number" placeholder="Monto S/" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            <Input type="date" placeholder="Fecha vencimiento" value={form.vencimiento} onChange={e => setForm({ ...form, vencimiento: e.target.value })} />
          </div>
          <Button onClick={submit}>Guardar</Button>
        </Card>
      )}
      <div className="space-y-3">
        {data.map(d => (
          <Card key={d.nid} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{d.cnombre?.trim()} <Badge variant={estadoVariant[d.cestado] || 'neutral'}>{estados[d.cestado] || d.cestado}</Badge></p>
                <p className="text-sm">{d.cconcepto?.trim()}</p>
                <p className="text-sm text-muted">Deuda: S/{parseFloat(d.nmonto).toFixed(2)} | Abonado: S/{parseFloat(d.nabonado).toFixed(2)} | <span className="font-semibold text-foreground">Saldo: S/{parseFloat(d.saldo).toFixed(2)}</span></p>
              </div>
              {d.cestado !== 'C' && (
                abonoId === d.nid ? (
                  <div className="flex gap-2 items-center">
                    <Input className="w-24" type="number" placeholder="S/" value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)} />
                    <Button size="sm" onClick={() => abonar(d.nid)}>Abonar</Button>
                    <Button size="sm" variant="outline" onClick={() => setAbonoId(null)}>X</Button>
                  </div>
                ) : <Button size="sm" variant="outline" onClick={() => setAbonoId(d.nid)}>Abonar</Button>
              )}
            </div>
          </Card>
        ))}
        {data.length === 0 && <p className="text-center text-muted py-8">Sin deudores registrados</p>}
      </div>
    </div>
  )
}
