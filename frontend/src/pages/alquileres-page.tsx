import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetAlquileres, apiSaveAlquiler } from '@/lib/api'
import type { ApiAlquiler } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function AlquileresPage() {
  const [data, setData] = useState<ApiAlquiler[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ concepto: '', arrendatario: '', dni: '', telefono: '', monto: '', periodo: 'Mensual', inicio: '', fin: '', notas: '' })

  const load = useCallback(() => {
    setLoading(true)
    apiGetAlquileres().then(setData).catch(() => toast.error('Error')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    try {
      await apiSaveAlquiler({ ...form, monto: parseFloat(form.monto) || 0 })
      toast.success('Alquiler registrado')
      setShowForm(false); setForm({ concepto: '', arrendatario: '', dni: '', telefono: '', monto: '', periodo: 'Mensual', inicio: '', fin: '', notas: '' }); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{data.length} alquiler(es)</p>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo alquiler'}</Button>
      </div>
      {showForm && (
        <Card className="p-6 space-y-3">
          <Input placeholder="Concepto (ej: Consultorio 1)" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Arrendatario" value={form.arrendatario} onChange={e => setForm({ ...form, arrendatario: e.target.value })} />
            <Input placeholder="DNI" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
            <Input placeholder="Telefono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="number" placeholder="Monto S/" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            <select className="rounded-lg border px-3 py-2 text-sm" value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })}>
              <option value="Diario">Diario</option><option value="Semanal">Semanal</option><option value="Mensual">Mensual</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} />
              <Input type="date" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} />
            </div>
          </div>
          <Button onClick={submit}>Guardar</Button>
        </Card>
      )}
      <div className="space-y-3">
        {data.map(a => (
          <Card key={a.nid} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{a.cconcepto?.trim()} <Badge variant={a.cestado === 'A' ? 'success' : 'neutral'}>{a.cestado === 'A' ? 'Activo' : a.cestado === 'V' ? 'Vencido' : 'Finalizado'}</Badge></p>
              <p className="text-sm text-muted">{a.carrendatario?.trim()} — {a.cperiodo?.trim()} S/{parseFloat(a.nperiodo_monto).toFixed(2)}</p>
              {a.finicio && <p className="text-xs text-muted">{a.finicio} — {a.ffin || '?'}</p>}
            </div>
          </Card>
        ))}
        {data.length === 0 && <p className="text-center text-muted py-8">Sin alquileres registrados</p>}
      </div>
    </div>
  )
}
