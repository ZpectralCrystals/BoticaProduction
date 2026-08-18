import { useTransition } from 'react'
import type { FormEvent } from 'react'
import { toast } from 'sonner'
import {
  ClipboardList,
  FileText,
  Phone,
  Users,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAppData } from '@/context/app-data'
import { formatShortDate } from '@/lib/utils'

export function PatientsPage() {
  const { addPatient, appointments, metrics, patients } = useAppData()
  const [isPending, startTransition] = useTransition()
  const recentPatients = [...patients]
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
    .slice(0, 6)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(() => {
      addPatient({
        fullName: String(formData.get('fullName') ?? ''),
        documentId: String(formData.get('documentId') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        age: Number(formData.get('age') ?? 0),
        notes: String(formData.get('notes') ?? ''),
      })

      toast.success('Paciente agregado al padrón médico.')
      form.reset()
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        description="Padron de pacientes y registro clinico rapido para el perfil doctor. Datos almacenados en PostgreSQL."
        eyebrow="Perfil doctor"
        title="Pacientes"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Pacientes registrados en el sistema."
          icon={Users}
          label="Pacientes"
          value={String(metrics.totalPatients)}
        />
        <MetricCard
          detail="Atenciones o procedimientos del día."
          icon={ClipboardList}
          label="Agenda de hoy"
          tone="accent"
          value={String(metrics.todayAppointments)}
        />
        <MetricCard
          detail="Teléfonos listos para seguimiento."
          icon={Phone}
          label="Contactables"
          tone="success"
          value={String(patients.filter((patient) => patient.phone.trim()).length)}
        />
        <MetricCard
          detail="Fichas con observaciones clínicas."
          icon={FileText}
          label="Con notas"
          tone="danger"
          value={String(patients.filter((patient) => patient.notes.trim()).length)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Registrar paciente</CardTitle>
            <CardDescription>
              Alta rápida para el módulo médico usando <code>FormData</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Nombre completo</span>
                <Input name="fullName" placeholder="Ej. Rosa Quispe Salazar" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">DNI</span>
                <Input name="documentId" placeholder="12345678" required />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Edad</span>
                <Input min="0" name="age" required type="number" />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Teléfono</span>
                <Input name="phone" placeholder="987654321" required />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold">Observaciones</span>
                <Textarea
                  name="notes"
                  placeholder="Motivo de consulta, alergias o indicaciones importantes."
                />
              </label>

              <div className="sm:col-span-2">
                <Button disabled={isPending} type="submit">
                  {isPending ? 'Guardando...' : 'Guardar paciente'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pacientes recientes</CardTitle>
              <CardDescription>
                Vista rápida para ubicar historia, contacto y última atención.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="rounded-[24px] border border-border bg-white/75 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{patient.fullName}</p>
                      <p className="mt-1 text-sm text-muted">
                        DNI {patient.documentId} | {patient.age} años
                      </p>
                    </div>
                    <Badge variant="info">Última visita {formatShortDate(patient.lastVisit)}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted">{patient.phone}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{patient.notes}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agenda asociada</CardTitle>
              <CardDescription>
                Procedimientos y atenciones enlazados al padrón médico actual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {appointments.slice(0, 4).map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between rounded-[22px] border border-border bg-white/75 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">{appointment.patient}</p>
                    <p className="mt-1 text-sm text-muted">{appointment.specialty}</p>
                  </div>
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
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
