import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck, Check, XCircle } from "lucide-react";
import { BarberiaNavbar } from "@/components/barberia-navbar";
import { Button } from "@/components/ui/button";
import { getBarberiaCached } from "@/lib/barberia-server";
import { formatCLP, formatFecha } from "@/lib/datetime";
import { cargarReserva } from "@/lib/notifications";
import { verifyLink } from "@/lib/signed-links";

type Accion = "confirmar" | "cancelar";
const API: Record<Accion, string> = { confirmar: "confirm-booking", cancelar: "cancel-booking" };
const PURPOSE = { confirmar: "confirmar-reserva", cancelar: "cancelar-reserva" } as const;

/** Ya pasó el plazo de la barbería para cancelar en línea (la RPC cambiar_reserva_cliente aplica la misma regla). */
function fueraDePlazo(inicio: string, plazoMin: number) {
  return new Date(inicio).getTime() - Date.now() < plazoMin * 60_000;
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm sm:text-base">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

/**
 * Página de los links de confirmar / cancelar del correo (llega desde /api/confirm-booking y
 * /api/cancel-booking). El link firmado autoriza: los datos se leen con service role. El botón hace
 * POST a la ruta de la API, que vuelve aquí con el estado nuevo (o `error=1`).
 */
export default async function CitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; token?: string; accion?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { id = "", token = "", accion: accionParam, error } = await searchParams;
  const barberia = await getBarberiaCached(slug);
  if (!barberia) notFound();

  const accion: Accion = accionParam === "cancelar" ? "cancelar" : "confirmar";
  const valido = /^\d+$/.test(id) && verifyLink(PURPOSE[accion], id, token);
  const info = valido ? await cargarReserva(Number(id)) : null;
  const cita = info?.barberia.id_barberia === barberia.id_barberia ? info : null;

  if (!cita) {
    return (
      <>
        <BarberiaNavbar />
        <main id="contenido" className="pagina-barberia min-h-[calc(100dvh-4rem)] bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full tarjeta rounded-2xl p-8 text-center">
            <h1 className="display text-2xl mb-3">No encontramos esta cita</h1>
            <p className="text-muted-foreground mb-6">El link no es válido. Abre el link del correo de tu reserva.</p>
            <Button asChild className="h-12 w-full">
              <Link href={`/${slug}`}>Volver a {barberia.nombre}</Link>
            </Button>
          </div>
        </main>
      </>
    );
  }

  const { estado, fecha_hora_inicio: inicio, monto } = cita.reserva;
  const activa = estado === "pendiente" || estado === "confirmada";
  const tarde = activa && fueraDePlazo(inicio, barberia.plazo_cancelacion_min);
  const telefono = cita.sucursal?.telefono || barberia.telefono;
  const formAccion = `/api/${API[accion]}?${new URLSearchParams({ id, token })}`;

  const titulo =
    accion === "confirmar"
      ? estado === "pendiente" ? "¿Confirmas tu cita?" : estado === "confirmada" ? "Asistencia confirmada" : "Tu cita"
      : estado === "cancelada" ? "Cita cancelada" : activa ? "¿Cancelar tu cita?" : "Tu cita";
  const Icono = estado === "cancelada" ? XCircle : estado === "confirmada" && accion === "confirmar" ? Check : CalendarCheck;

  return (
    <>
      <BarberiaNavbar />
      <main id="contenido" className="pagina-barberia min-h-[calc(100dvh-4rem)] bg-background flex items-center justify-center p-4 py-8">
        <div className="max-w-md w-full tarjeta rounded-2xl p-6 sm:p-8">
          <div className="text-center mb-6">
            <span className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${estado === "cancelada" ? "bg-muted text-muted-foreground" : "bg-brand text-brand-foreground"}`}>
              <Icono className="size-7" aria-hidden="true" />
            </span>
            <h1 className="display text-3xl">{titulo}</h1>
            {!activa && estado !== "cancelada" && <p className="mt-2 text-muted-foreground">Esta cita ya no se puede modificar.</p>}
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              No se pudo {accion} la cita. Revisa su estado más abajo.
            </p>
          )}

          <dl className="divide-y divide-border">
            <Fila etiqueta="Barbería">{barberia.nombre}</Fila>
            {cita.sucursal && (
              <Fila etiqueta="Sucursal">
                <Link href={`/${slug}/${cita.sucursal.slug}`} className="underline underline-offset-4">{cita.sucursal.nombre}</Link>
                <span className="block text-sm font-normal text-muted-foreground">{cita.sucursal.direccion}, {cita.sucursal.comuna}</span>
              </Fila>
            )}
            <Fila etiqueta="Barbero">{cita.barbero}</Fila>
            <Fila etiqueta="Servicio">{cita.servicio}</Fila>
            <Fila etiqueta="Fecha"><span className="first-letter:uppercase inline-block">{formatFecha(cita.fecha, "EEEE d 'de' MMMM")}</span></Fila>
            <Fila etiqueta="Hora"><span className="tabular">{cita.hora}</span></Fila>
            {monto != null && <Fila etiqueta="Total"><span className="tabular">{formatCLP(Number(monto))}</span></Fila>}
          </dl>

          <div className="mt-6 space-y-3">
            {accion === "confirmar" && estado === "pendiente" && (
              <form method="post" action={formAccion}>
                <Button type="submit" className="h-12 w-full">Sí, confirmar mi cita</Button>
              </form>
            )}

            {accion === "cancelar" && activa && !tarde && (
              <>
                <form method="post" action={formAccion}>
                  <Button type="submit" variant="destructive" className="h-12 w-full">Sí, cancelar mi cita</Button>
                </form>
                <Button asChild variant="outline" className="h-12 w-full">
                  <Link href={`/${slug}/reprogramar?${new URLSearchParams({ id, token })}`}>¿Prefieres cambiar la hora?</Link>
                </Button>
              </>
            )}

            {accion === "cancelar" && tarde && (
              <div role="note" className="rounded-lg border border-border p-4 text-sm">
                <p className="flex gap-2 font-medium">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                  Ya no puedes cancelar en línea
                </p>
                <p className="mt-2 text-muted-foreground">
                  Si no asistes, la barbería podría cobrarte un recargo o no permitirte reservar en el futuro. Contáctala:
                </p>
                <ul className="mt-2 space-y-1">
                  {telefono && <li><a href={`tel:${telefono}`} className="underline underline-offset-4">{telefono}</a></li>}
                  {barberia.email_contacto && <li><a href={`mailto:${barberia.email_contacto}`} className="underline underline-offset-4 break-all">{barberia.email_contacto}</a></li>}
                  {!telefono && !barberia.email_contacto && <li><Link href={`/${slug}`} className="underline underline-offset-4">Página de {barberia.nombre}</Link></li>}
                </ul>
              </div>
            )}

            {estado === "cancelada" ? (
              <Button asChild className="h-12 w-full">
                <Link href={`/${slug}/agendar`}>Agendar nueva cita</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" className="h-12 w-full">
                <Link href={`/${slug}`}>Volver a {barberia.nombre}</Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
