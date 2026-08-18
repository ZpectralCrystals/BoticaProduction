import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetAuditoria } from '@/lib/api'
import type { ApiAuditoria } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export function AuditoriaPage() {
  const [data, setData] = useState<ApiAuditoria | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiGetAuditoria({ limite: '100' }).then(setData).catch(() => toast.error('Error')).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      {data?.resumen && data.resumen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.resumen.map((r, i) => <Badge key={i} variant="neutral">{String(r.caccion)}: {String(r.n)}</Badge>)}
        </div>
      )}
      <Card className="p-6">
        <h3 className="font-semibold mb-3">{data?.total ?? 0} registros de auditoria</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted"><th className="pb-2">Fecha</th><th className="pb-2">Usuario</th><th className="pb-2">Accion</th><th className="pb-2">Tabla</th><th className="pb-2">Detalle</th></tr></thead><tbody>
          {data?.items.map((a, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2 text-xs text-muted whitespace-nowrap">{String(a.tcreado)}</td>
              <td>{String(a.cusuario ?? '').trim()}</td>
              <td><Badge variant="neutral">{String(a.caccion)}</Badge></td>
              <td className="text-xs font-mono">{String(a.ctabla ?? '').trim()}</td>
              <td className="text-xs">{String(a.cdetalle ?? '').trim()}</td>
            </tr>
          ))}
          {(!data?.items || data.items.length === 0) && <tr><td colSpan={5} className="py-4 text-center text-muted">Sin registros</td></tr>}
        </tbody></table></div>
      </Card>
    </div>
  )
}
