import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { apiGetInventory, apiGetAlmacenes, apiGetLotes, apiPostAjuste } from '@/lib/api'
import type { ApiAlmacen, ApiInventoryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

type LoteOption = { id: string; code: string }

export function AjustesPage() {
  const [productoId, setProductoId] = useState('')
  const [almacenId, setAlmacenId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [productos, setProductos] = useState<ApiInventoryItem[]>([])
  const [almacenes, setAlmacenes] = useState<ApiAlmacen[]>([])
  const [lotes, setLotes] = useState<LoteOption[]>([])

  useEffect(() => {
    apiGetInventory().then(setProductos)
    apiGetAlmacenes().then(setAlmacenes)
  }, [])

  useEffect(() => {
    if (productoId && almacenId) {
      apiGetLotes(productoId, almacenId).then(setLotes)
    }
  }, [productoId, almacenId])

  const handleSubmit = async () => {
    if (!productoId || !almacenId || !loteId || !cantidad || !motivo) {
      toast.error('Todos los campos son obligatorios')
      return
    }

    try {
      await apiPostAjuste({ productoId, almacenId, loteId, cantidad: parseInt(cantidad), motivo, detalle })
      toast.success('Ajuste registrado correctamente')
    } catch {
      toast.error('Error al registrar el ajuste')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Ajustes de Inventario</h1>

      <Select value={productoId} onChange={e => setProductoId(e.target.value)}>
        <option value="">Seleccionar Producto</option>
        {productos.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Select>

      <Select value={almacenId} onChange={e => setAlmacenId(e.target.value)}>
        <option value="">Seleccionar Almacén</option>
        {almacenes.map(a => (
          <option key={a.id} value={a.id}>{a.nombre}</option>
        ))}
      </Select>

      <Select value={loteId} onChange={e => setLoteId(e.target.value)}>
        <option value="">Seleccionar Lote</option>
        {lotes.map(l => (
          <option key={l.id} value={l.id}>{l.code}</option>
        ))}
      </Select>

      <Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Cantidad" />

      <Select value={motivo} onChange={e => setMotivo(e.target.value)}>
        <option value="">Seleccionar Motivo</option>
        <option value="AJUSTE_CONTEO">Ajuste por Conteo</option>
        <option value="MERMA">Merma</option>
        <option value="ROBO">Robo</option>
        <option value="VENCIMIENTO">Vencimiento</option>
        <option value="ROTURA">Rotura</option>
        <option value="CORRECCION_OPERATIVA">Corrección Operativa</option>
      </Select>

      <Input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="Detalle (opcional)" />

      <Button onClick={handleSubmit}>Registrar Ajuste</Button>
    </div>
  )
}
