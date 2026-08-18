import { useTransition } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import {
  CalendarClock,
  ClipboardPlus,
  Hospital,
  Stethoscope,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input, inputBaseClassName } from '@/components/ui/input'
import { useAppData } from '@/context/app-data'
import { formatDateTime } from '@/lib/utils'

export function ProceduresPage() {
  const { appointments, metrics, scheduleAppointment } = useAppData()
  const [isPending, startTransition] = useTransition()
  const orderedAppointments = [...appointments].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(() => {
      scheduleAppointment({
        patient: String(formData.get('patient') ?? ''),
        doctor: String(formData.get('doctor') ?? ''),
        specialty: String(formData.get('specialty') ?? ''),
        room: String(formData.get('room') ?? ''),
        startsAt: new Date(String(formData.get('startsAt') ?? '')).toISOString(),
        status: String(formData.get('status') ?? 'Confirmada') as
          | 'Confirmada'
          | 'En espera'
          | 'Atendida',
      })

      toast.success('Procedimiento agregado a la agenda médica.')
      form.reset()
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        description="Agenda de procedimientos y atenciones para el perfil doctor. Aquí se programan controles, curaciones y procedimientos menores."
        eyebrow="Perfil doctor"
        title="Procedimientos"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Procedimientos registrados en el tablero."
          icon={ClipboardPlus}
          label="Agenda total"
          value={String(appointments.length)}
        />
        <MetricCard
          detail="Atenciones marcadas para hoy."
          icon={CalendarClock}
          label="Hoy"
          tone="accent"
          value={String(metrics.todayAppointments)}
        />
        <MetricCard
          detail="Consultorios o salas en uso."
          icon={Hospital}
          label="Ambientes"
          tone="success"
          value={String(new Set(appointments.map((item) => item.room)).size)}
        />
        <MetricCard
          detail="Doctores registrados en el sistema."
          icon={Stethoscope}
          label="Doctores"
          tone="danger"
          value={String(metrics.doctors)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Programar procedimiento</CardTitle>
            <CardDescription>
              Registro simple de agenda clínica sin estados controlados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Paciente</span>
                <Input name="patient" placeholder="Nombre del paciente" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Doctor</span>
                <Input defaultValue="Dr. Salazar" name="doctor" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Sala</span>
                <Input defaultValue="Sala 1" name="room" required />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Procedimiento</span>
                <Input
                  name="specialty"
                  placeholder="Curación, control, procedimiento menor..."
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Fecha y hora</span>
                <Input name="startsAt" required type="datetime-local" />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Estado</span>
                <select className={inputBaseClassName} defaultValue="Confirmada" name="status">
                  <option>Confirmada</option>
                  <option>En espera</option>
                  <option>Atendida</option>
                </select>
              </label>

              <div className="sm:col-span-2">
                <Button disabled={isPending} type="submit">
                  {isPending ? 'Guardando...' : 'Guardar procedimiento'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agenda clínica</CardTitle>
            <CardDescription>
              Procedimientos ordenados para que el doctor entre directo a su flujo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderedAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="grid gap-3 rounded-[24px] border border-border bg-white/75 p-4 lg:grid-cols-[1fr_0.9fr_0.6fr]"
              >
                <div>
                  <p className="font-semibold text-foreground">{appointment.patient}</p>
                  <p className="mt-1 text-sm text-muted">{appointment.specialty}</p>
                  <p className="mt-2 text-sm text-muted">{appointment.doctor}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Agenda</p>
                  <p className="mt-2 font-semibold text-foreground">
                    {formatDateTime(appointment.startsAt)}
                  </p>
                  <p className="mt-2 text-sm text-muted">{appointment.room}</p>
                </div>
                <div className="flex items-center lg:justify-end">
                  <Badge
                    variant={
                      appointment.status === 'Atendida'
                        ? 'success'
                        : appointment.status === 'En espera'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {appointment.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
