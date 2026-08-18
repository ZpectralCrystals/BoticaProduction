import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  ClipboardList,
  PackageSearch,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppData } from '@/context/app-data'
import type { ReportAlert } from '@/data/types'
import {
  daysUntil,
  formatCurrency,
  formatShortDate,
  formatTime,
} from '@/lib/utils'

const alertVariants: Record<ReportAlert['tone'], 'danger' | 'warning' | 'success' | 'info'> = {
  danger: 'danger',
  warning: 'warning',
  success: 'success',
  info: 'info',
}

export function DashboardPage() {
  const { alerts, inventory, metrics, sales } = useAppData()

  const recentSales = [...sales]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)

  const priorityProducts = [...inventory]
    .map((item) => ({
      ...item,
      daysToExpiry: daysUntil(item.expiresAt),
      stockGap: item.stock - item.minStock,
    }))
    .sort((a, b) => a.stockGap - b.stockGap || a.daysToExpiry - b.daysToExpiry)
    .slice(0, 6)

  const inventoryValue = inventory.reduce(
    (total, item) => total + item.stock * item.unitPrice,
    0,
  )
  const averageTicket =
    metrics.todaySalesCount > 0 ? metrics.todayRevenue / metrics.todaySalesCount : 0

  const kpis = [
    {
      icon: Wallet,
      label: 'Ventas hoy',
      value: formatCurrency(metrics.todayRevenue),
      meta: `${metrics.todaySalesCount} operaciones`,
      tone: 'text-primary-strong bg-primary/10',
    },
    {
      icon: Activity,
      label: 'Ticket prom.',
      value: formatCurrency(averageTicket),
      meta: 'Mostrador activo',
      tone: 'text-success bg-success/10',
    },
    {
      icon: Boxes,
      label: 'Stock critico',
      value: String(metrics.lowStock),
      meta: 'Bajo minimo',
      tone: 'text-danger bg-danger/10',
    },
    {
      icon: AlertTriangle,
      label: 'Por vencer',
      value: String(metrics.expiringSoon),
      meta: 'Revisar lotes',
      tone: 'text-warning bg-warning/10',
    },
    {
      icon: PackageSearch,
      label: 'Valor stock',
      value: formatCurrency(inventoryValue),
      meta: `${metrics.totalProducts} productos`,
      tone: 'text-primary-strong bg-accent/15',
    },
  ]

  const actionQueue = [
    {
      icon: Boxes,
      title: 'Reponer stock critico',
      detail:
        metrics.lowStock > 0
          ? `${metrics.lowStock} productos bajo minimo. Priorizar mostrador.`
          : 'Stock critico controlado.',
      href: '/panel/inventario',
      label: 'Inventario',
      badge: 'Urgente',
      tone: 'danger' as const,
    },
    {
      icon: AlertTriangle,
      title: 'Revisar vencimientos',
      detail:
        metrics.expiringSoon > 0
          ? `${metrics.expiringSoon} productos necesitan validacion de lote.`
          : 'Sin vencimientos cercanos.',
      href: '/panel/alertas',
      label: 'Alertas',
      badge: 'FEFO',
      tone: 'warning' as const,
    },
    {
      icon: Wallet,
      title: 'Cuadrar caja',
      detail: `${formatCurrency(metrics.todayRevenue)} vendidos hoy. Confirmar saldo por medio de pago.`,
      href: '/panel/caja',
      label: 'Caja',
      badge: 'Turno',
      tone: 'info' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Operacion diaria
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
            Panel de control
          </h2>
          <p className="mt-1 text-sm text-muted">
            Local principal | caja de mostrador | {formatShortDate(new Date().toISOString())}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Caja activa</Badge>
          <Link
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
            to="/panel/reportes"
          >
            <RefreshCw className="h-4 w-4" />
            Reportes
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => {
          const Icon = item.icon

          return (
            <Card key={item.label} className="shadow-none">
              <CardContent className="flex min-h-[124px] items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-muted">
                    {item.label}
                  </p>
                  <p className="mt-2 break-words font-display text-[1.35rem] font-semibold leading-tight text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-1 text-sm text-muted">{item.meta}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="min-w-0">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Cola de acciones</CardTitle>
                <CardDescription>
                  Pendientes ordenados por impacto operativo.
                </CardDescription>
              </div>
              <Badge variant="info">Hoy</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-5">
            {actionQueue.map((action) => {
              const Icon = action.icon

              return (
                <div
                  className="grid gap-3 rounded-lg border border-border bg-surface/40 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  key={action.title}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-strong shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{action.title}</p>
                      <Badge variant={action.tone}>{action.badge}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted">{action.detail}</p>
                  </div>
                  <Link
                    className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                    to={action.href}
                  >
                    {action.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Caja y ventas</CardTitle>
            <CardDescription>Ultimos movimientos registrados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-surface/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted">Total</p>
                <p className="mt-1 font-display text-xl font-semibold text-foreground">
                  {formatCurrency(metrics.todayRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted">Ops</p>
                <p className="mt-1 font-display text-xl font-semibold text-foreground">
                  {metrics.todaySalesCount}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div
                  className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
                  key={sale.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{sale.concept}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatTime(sale.at)} | {sale.customer}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{formatCurrency(sale.total)}</p>
                    <p className="mt-1 text-xs text-muted">{sale.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <Card className="min-w-0">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Inventario critico</CardTitle>
                <CardDescription>Stock bajo y vencimiento cercano en una sola vista.</CardDescription>
              </div>
              <Link
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
                to="/panel/inventario"
              >
                Ver todo
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-3 md:hidden">
              {priorityProducts.map((item) => {
                const stockRatio = Math.min(
                  100,
                  Math.round((item.stock / Math.max(item.minStock, 1)) * 100),
                )
                const isLowStock = item.stock <= item.minStock

                return (
                  <div className="rounded-lg border border-border bg-surface/40 p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted">
                          {item.family} | vence {formatShortDate(item.expiresAt)}
                        </p>
                      </div>
                      <Badge variant={isLowStock ? 'danger' : 'warning'}>
                        {isLowStock ? 'Reponer' : `${item.daysToExpiry} dias`}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted">Stock {item.stock}</span>
                      <span className="text-muted">Min. {item.minStock}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                      <div
                        className={`h-1.5 rounded-full ${isLowStock ? 'bg-danger' : 'bg-warning'}`}
                        style={{ width: `${stockRatio}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Min.</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {priorityProducts.map((item) => {
                  const stockRatio = Math.min(
                    100,
                    Math.round((item.stock / Math.max(item.minStock, 1)) * 100),
                  )
                  const isLowStock = item.stock <= item.minStock

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="min-w-[220px]">
                          <p className="font-medium">{item.name}</p>
                          <p className="mt-1 text-xs text-muted">
                            {item.family} | {item.location}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <p className="font-semibold">{item.stock}</p>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 rounded-full ${isLowStock ? 'bg-danger' : 'bg-warning'}`}
                              style={{ width: `${stockRatio}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.minStock}</TableCell>
                      <TableCell>{formatShortDate(item.expiresAt)}</TableCell>
                      <TableCell>
                        <Badge variant={isLowStock ? 'danger' : 'warning'}>
                          {isLowStock ? 'Reponer' : `${item.daysToExpiry} dias`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5">
          <Card className="min-w-0">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Alertas</CardTitle>
              <CardDescription>Estados que requieren revision.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {alerts.map((alert) => (
                <div className="rounded-lg border border-border p-3" key={alert.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-foreground">{alert.title}</p>
                    <Badge variant={alertVariants[alert.tone]}>{alert.tag}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{alert.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Ruta corta</CardTitle>
              <CardDescription>Orden sugerido para turno actual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {[
                ['08:00', 'Apertura caja', ClipboardList],
                ['11:00', 'Reponer stock sensible', Boxes],
                ['15:00', 'Pre-cierre y alertas', CalendarClock],
              ].map(([time, title, Icon]) => (
                <div className="flex items-center gap-3" key={String(title)}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{title as string}</p>
                    <p className="text-xs text-muted">{time as string}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
