import Link from 'next/link'
import { BarberiaNavbar } from '@/components/barberia-navbar'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Vidrio } from "@/components/vidrio";

export default async function BookingConfirmed({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;

  return (
    <>
      <BarberiaNavbar />
    <main id="contenido" className="min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full tarjeta rounded-2xl border border-border bg-card p-8 text-center">
        <Vidrio />
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-brand text-brand-foreground">
          <Check className="size-8" aria-hidden="true" />
        </span>
        <h1 className="display text-3xl mb-3">Asistencia confirmada</h1>
        <p className="text-muted-foreground mb-8">
          Te esperamos en la fecha y hora agendada.
        </p>
        <div className="space-y-3">
          <Button asChild className="h-12 w-full">
            <Link href={`/${slug}`}>Volver al inicio</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 w-full">
            <Link href={`/${slug}/agendar`}>Agendar otra cita</Link>
          </Button>
        </div>
      </div>
    </main>
    </>
  )
}
