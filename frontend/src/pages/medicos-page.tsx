import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import { apiGetMedicos, apiSaveMedico, apiGetServicios, apiSaveServicio } from '@/lib/api'
import type { ApiMedico, ApiServicio } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function MedicosPage() {
  const [medicos, setMedicos] = useState<ApiMedico[]>([])
  const [servicios, setServicios] = useState<ApiServicio[]>([])
  const [loading, setLoading] = useState(true)
  const [showMed, setShowMed] = useState(false)
  const [showServ, setShowServ] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([apiGetMedicos(), apiGetServicios()])
      .then(([m, s]) => { setMedicos(m); setServicios(s) })
      .catch(() => toast.error('Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleMedSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    if (!nombre) { toast.error('El nombre es obligatorio'); return }
    try {
      await apiSaveMedico({
        nombre,
        cmp: String(data.get('cmp') ?? '').trim(),
        especialidad: String(data.get('especialidad') ?? '').trim(),
        telefono: String(data.get('telefono') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
      })
      toast.success('Medico registrado')
      setShowMed(false)
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
  }

  async function handleServSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const nombre = String(data.get('nombre') ?? '').trim()
    if (!nombre) { toast.error('El nombre es obligatorio'); return }
    try {
      await apiSaveServicio({
        nombre,
        categoria: String(data.get('categoria') ?? '').trim(),
        precio: parseFloat(String(data.get('precio') ?? '0')) || 0,
        descripcion: String(data.get('descripcion') ?? '').trim(),
      })
      toast.success('Servicio registrado')
      setShowServ(false)
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error') }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Medicos ({medicos.length})</h3>
            <Button size="sm" onClick={() => setShowMed(!showMed)}>{showMed ? 'Cancelar' : '+ Medico'}</Button>
          </div>
          {showMed && (
            <form onSubmit={handleMedSubmit} className="space-y-3 mb-4 rounded-lg border p-4">
              <Input name="nombre" placeholder="Nombre completo" required />
              <div className="grid grid-cols-2 gap-2">
                <Input name="cmp" placeholder="CMP" />
                <Input name="especialidad" placeholder="Especialidad" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input name="telefono" placeholder="Telefono" />
                <Input name="email" type="email" placeholder="Email" />
              </div>
              <Button size="sm" type="submit">Guardar</Button>
            </form>
          )}
          <div className="space-y-2">
            {medicos.map(m => (
              <div key={m.nid} className="flex justify-between items-center rounded-lg border p-3">
                <div>
                  <p className="font-medium">{m.cnombre?.trim()}</p>
                  <p className="text-sm text-muted">CMP: {m.ccmp?.trim()} — {m.cespeciali?.trim()}</p>
                </div>
                <p className="text-sm text-muted">{m.ctelefono?.trim()}</p>
              </div>
            ))}
            {medicos.length === 0 && <p className="text-sm text-muted text-center py-4">Sin medicos registrados</p>}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Servicios ({servicios.length})</h3>
            <Button size="sm" onClick={() => setShowServ(!showServ)}>{showServ ? 'Cancelar' : '+ Servicio'}</Button>
          </div>
          {showServ && (
            <form onSubmit={handleServSubmit} className="space-y-3 mb-4 rounded-lg border p-4">
              <Input name="nombre" placeholder="Nombre del servicio" required />
              <div className="grid grid-cols-2 gap-2">
                <Input name="categoria" placeholder="Categoria" />
                <Input name="precio" placeholder="Precio S/" type="number" step="0.01" min="0" />
              </div>
              <Input name="descripcion" placeholder="Descripcion" />
              <Button size="sm" type="submit">Guardar</Button>
            </form>
          )}
          <div className="space-y-2">
            {servicios.map(s => (
              <div key={s.nid} className="flex justify-between items-center rounded-lg border p-3">
                <div>
                  <p className="font-medium">{s.cnombre?.trim()}</p>
                  <p className="text-sm text-muted">{s.ccategoria?.trim()}</p>
                </div>
                <p className="font-semibold">S/{parseFloat(s.nprecio).toFixed(2)}</p>
              </div>
            ))}
            {servicios.length === 0 && <p className="text-sm text-muted text-center py-4">Sin servicios registrados</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
