import {
  ArrowRight,
  Boxes,
  ShieldCheck,
  Sparkles,
  TabletSmartphone,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthCallToAction } from '@/components/shared/auth-cta'
import { BrandLogo } from '@/components/shared/brand-logo'
import { LoginCard } from '@/components/shared/login-card'
import { MetricCard } from '@/components/shared/metric-card'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAppData } from '@/context/app-data'
import { useAuth } from '@/context/auth-context'
import { formatCompactNumber, formatCurrency } from '@/lib/utils'

export function HomePage() {
  const { metrics } = useAppData()
  const { user } = useAuth()

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#018c77_0%,#02c1a1_52%,#ff8800_128%)] p-8 text-white shadow-[0_24px_70px_rgba(2,193,161,0.24)] lg:p-10">
            <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-white/12 blur-3xl" />
            <div className="absolute -right-6 bottom-6 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />
            <div className="absolute inset-0 grid-glow opacity-12" />
            <div className="relative z-10 space-y-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-white/20 bg-white/10 text-white" variant="neutral">
                    Botica El Pueblo
                  </Badge>
                  <Badge className="border-white/20 bg-white/10 text-white" variant="neutral">
                    PostgreSQL
                  </Badge>
                  <Badge className="border-white/20 bg-white/10 text-white" variant="neutral">
                    {user ? 'Conectado' : 'Modo seguro'}
                  </Badge>
                </div>

                <div className="w-full max-w-sm rounded-[28px] bg-white/95 p-4 text-foreground shadow-[0_18px_42px_rgba(255,136,0,0.24)]">
                  <BrandLogo imgClassName="h-14 w-auto sm:h-16" />
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Sistema de gestion integral para farmacia con inventario,
                    ventas, pacientes y procedimientos.
                  </p>
                </div>
              </div>

              <div className="max-w-3xl space-y-4">
                <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-white/70">
                  Sistema de Gestion - Botica El Pueblo
                </p>
                <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">
                  Caja, inventario y ventas conectados a base de datos real.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/78">
                  Botica El Pueblo cuenta con gestion completa: dashboard
                  operativo, inventario con alertas de vencimiento, registro
                  de ventas por metodo de pago y modulo medico con pacientes
                  y procedimientos. Todo persistido en PostgreSQL.
                </p>
              </div>

              <AuthCallToAction />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                  <p className="text-sm text-white/70">Ventas de hoy</p>
                  <p className="mt-2 font-display text-3xl font-semibold">
                    {metrics.todaySalesCount}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                  <p className="text-sm text-white/70">Productos en catalogo</p>
                  <p className="mt-2 font-display text-3xl font-semibold">
                    {metrics.totalProducts}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                  <p className="text-sm text-white/70">Pacientes registrados</p>
                  <p className="mt-2 font-display text-3xl font-semibold">
                    {metrics.totalPatients}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 sm:col-span-3">
                  <p className="text-sm text-white/70">Base de datos</p>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    PostgreSQL — Datos reales persistidos con backend PHP siguiendo arquitectura MPERP.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <LoginCard />

            <Card className="overflow-hidden">
              <CardHeader>
                <Badge className="w-fit" variant="info">
                  Arquitectura
                </Badge>
                <CardTitle>Stack de produccion</CardTitle>
                <CardDescription>
                  Frontend React + Backend PHP + PostgreSQL siguiendo la
                  arquitectura probada de MPERP.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[24px] border border-border bg-white/70 p-4">
                  <p className="font-semibold text-foreground">Frontend</p>
                  <p className="mt-2 text-sm leading-6 text-muted">React 19 + TypeScript + Vite + Tailwind CSS</p>
                </div>
                <div className="rounded-[24px] border border-border bg-white/70 p-4">
                  <p className="font-semibold text-foreground">Backend</p>
                  <p className="mt-2 text-sm leading-6 text-muted">PHP 8+ con API REST, sesiones y bcrypt</p>
                </div>
                <div className="rounded-[24px] border border-border bg-white/70 p-4">
                  <p className="font-semibold text-foreground">Base de datos</p>
                  <p className="mt-2 text-sm leading-6 text-muted">PostgreSQL con tablas normalizadas y datos reales</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail="Total acumulado del dia desde la base de datos."
            icon={Sparkles}
            label="Caja de hoy"
            value={formatCurrency(metrics.todayRevenue)}
          />
          <MetricCard
            detail="Alertas activas entre minimo y vencimiento."
            icon={Boxes}
            label="Items comprometidos"
            tone="danger"
            value={formatCompactNumber(metrics.lowStock + metrics.expiringSoon)}
          />
          <MetricCard
            detail="Operaciones registradas hoy en PostgreSQL."
            icon={TabletSmartphone}
            label="Operaciones hoy"
            tone="accent"
            value={formatCompactNumber(metrics.todaySalesCount)}
          />
          <MetricCard
            detail="Autenticacion con DNI y bcrypt."
            icon={ShieldCheck}
            label="Auth seguro"
            tone="success"
            value={user ? 'Activo' : 'Listo'}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>Modulos del sistema</CardTitle>
              <CardDescription>
                Todos los modulos estan conectados a PostgreSQL con datos reales.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-white/70 p-5">
                <p className="font-display text-xl font-semibold">Dashboard</p>
                <p className="mt-4 text-sm leading-6 text-muted">KPIs del dia, alertas criticas, productos sensibles y resumen de caja.</p>
              </div>
              <div className="rounded-[24px] border border-border bg-white/70 p-5">
                <p className="font-display text-xl font-semibold">Inventario</p>
                <p className="mt-4 text-sm leading-6 text-muted">Stock minimo, vencimientos, reposicion y filtros por categoria.</p>
              </div>
              <div className="rounded-[24px] border border-border bg-white/70 p-5">
                <p className="font-display text-xl font-semibold">Ventas</p>
                <p className="mt-4 text-sm leading-6 text-muted">Registro rapido de cobros, Yape, efectivo y mixto.</p>
              </div>
              <div className="rounded-[24px] border border-border bg-white/70 p-5">
                <p className="font-display text-xl font-semibold">Pacientes</p>
                <p className="mt-4 text-sm leading-6 text-muted">Padron medico con DNI, telefono y observaciones clinicas.</p>
              </div>
              <div className="rounded-[24px] border border-border bg-white/70 p-5">
                <p className="font-display text-xl font-semibold">Procedimientos</p>
                <p className="mt-4 text-sm leading-6 text-muted">Agenda clinica, doctores, salas y estados de atencion.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.72)_100%)]">
            <CardHeader>
              <Badge className="w-fit" variant="success">
                Produccion
              </Badge>
              <CardTitle>Sistema conectado</CardTitle>
              <CardDescription>
                Backend PHP + PostgreSQL siguiendo la arquitectura MPERP.
                Login con DNI y contraseña con hash bcrypt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted">
              <div className="rounded-[22px] border border-border bg-white/80 p-4">
                <p className="font-semibold text-foreground">Autenticacion segura</p>
                <p className="mt-2">
                  Login con DNI de 8 digitos y contraseña con hash bcrypt.
                  Sesiones con timeout automatico.
                </p>
              </div>
              <div className="rounded-[22px] border border-border bg-white/80 p-4">
                <p className="font-semibold text-foreground">Roles y permisos</p>
                <p className="mt-2">
                  Administrador, Caja, Almacenero y Doctor. Cada rol accede
                  solo a sus modulos.
                </p>
              </div>
              <div className="rounded-[22px] border border-border bg-white/80 p-4">
                <p className="font-semibold text-foreground">Datos persistidos</p>
                <p className="mt-2">
                  Inventario, ventas, pacientes y citas almacenados en
                  PostgreSQL con transacciones.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link className="font-semibold text-primary" to="/panel">
                  Abrir dashboard <ArrowRight className="ml-1 inline h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
