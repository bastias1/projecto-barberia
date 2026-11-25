import { BarberiaNavbar } from "@/components/barberia-navbar";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import Link from "next/link";

export default async function BookingCancelledPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;

  return (
    <>
      <BarberiaNavbar />
    <main id="contenido" className="min-h-[calc(100dvh-4rem)] bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full tarjeta rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-muted">
          <XCircle className="size-8 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="display text-3xl mb-3">Cita cancelada</h1>
        <p className="text-muted-foreground mb-8">
          Tu cita quedó cancelada. Si quieres reagendar, puedes crear una nueva reserva cuando quieras.
        </p>
        <Button asChild className="h-12 w-full">
          <Link href={`/${slug}/agendar`}>Agendar nueva cita</Link>
        </Button>
      </div>
    </main>
    </>
  );
}
