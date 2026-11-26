import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getBarberiaCached } from "@/lib/barberia-server";
import { DEFAULT_TZ, formatPlazo } from "@/lib/barberia";
import { formatFecha, toZoned } from "@/lib/datetime";
import { verifyLink } from "@/lib/signed-links";
import { one } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReprogramarForm } from "@/components/booking/reprogramar-form";
import type { ReservaCuenta } from "@/components/cuenta/historial-reservas";

interface Cita {
  id: number;
  estado: string;
  inicio: string;
  zona: string;
  barberoId: string;
  idServicio: number;
  servicio: string;
  precio: number;
  duracion: number;
}

/** El link firmado del correo ya autorizó: se lee con service role. */
async function citaPorLink(idBarberia: string, id: string): Promise<Cita | null> {
  const { data } = await createServiceRoleClient()
    .from("reserva")
    .select(`
      id_reserva, id_profesional, fecha_hora_inicio, estado,
      servicio:servicio!reserva_servicio_fkey (id_servicio, nombre, precio, duracion_min),
      sucursal:sucursal!reserva_sucursal_fkey (zona_horaria)
    `)
    .eq("id_reserva", id)
    .eq("id_barberia", idBarberia)
    .maybeSingle();
  const servicio = one<{ id_servicio: number; nombre: string; precio: number; duracion_min: number }>(data?.servicio);
  if (!data || !servicio) return null;
  return {
    id: data.id_reserva,
    estado: data.estado,
    inicio: data.fecha_hora_inicio,
    zona: one<{ zona_horaria: string }>(data.sucursal)?.zona_horaria || DEFAULT_TZ,
    barberoId: data.id_profesional,
    idServicio: servicio.id_servicio,
    servicio: servicio.nombre,
    precio: Number(servicio.precio),
    duracion: servicio.duracion_min,
  };
}

/** Con sesión: la RPC solo devuelve reservas de la cuenta (o de invitado con su correo confirmado). */
async function citaPropia(idBarberia: string, id: string): Promise<Cita | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mis_reservas", { p_reserva: Number(id) });
  const r = (data as ReservaCuenta[] | null)?.find((x) => x.id_barberia === idBarberia);
  if (!r) return null;
  return {
    id: r.id_reserva,
    estado: r.estado,
    inicio: r.fecha_hora_inicio,
    zona: r.zona_horaria,
    barberoId: r.id_profesional,
    idServicio: r.id_servicio,
    servicio: r.servicio,
    precio: Number(r.servicio_precio),
    duracion: r.duracion_min,
  };
}

/**
 * HU-22: elegir otra fecha y hora para una reserva propia (mismo barbero y servicio).
 * Se llega con sesión (desde /cuenta) o con el link firmado del correo (?token=).
 */
export default async function ReprogramarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { slug } = await params;
  const { id = "", token } = await searchParams;
  const barberia = await getBarberiaCached(slug);
  if (!barberia) notFound();

  const idValido = /^\d+$/.test(id);
  const conLink = idValido && verifyLink("cancelar-reserva", id, token);
  const cita = !idValido ? null : conLink ? await citaPorLink(barberia.id_barberia, id) : await citaPropia(barberia.id_barberia, id);
  const modificable = cita && ["pendiente", "confirmada"].includes(cita.estado);

  return (
    <main id="contenido" className="pagina-barberia min-h-dvh bg-background p-4 py-8 pb-28">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Cambiar la hora de tu cita</h1>
        {modificable ? (
          <ReprogramarForm
            idReserva={cita.id}
            token={conLink ? token : null}
            barberoId={cita.barberoId}
            servicio={{ id: cita.idServicio, nombre: cita.servicio, descripcion: null, precio: cita.precio }}
            duracion={cita.duracion}
            actual={(() => {
              const { fecha, hora } = toZoned(cita.inicio, cita.zona);
              return `${formatFecha(fecha, "EEEE d 'de' MMMM")}, ${hora}`;
            })()}
            plazo={formatPlazo(barberia.plazo_cancelacion_min)}
          />
        ) : (
          <div className="text-center space-y-4 mt-8">
            <p className="text-muted-foreground">
              {cita ? "Esta cita ya no se puede modificar." : "No encontramos esta cita. Si es tuya, inicia sesión o abre el link del correo de tu reserva."}
            </p>
            <Button asChild>
              <Link href={cita ? `/${slug}` : `/login?${new URLSearchParams({ barberia: slug, next: `/${slug}/reprogramar?id=${id}` })}`}>
                {cita ? `Volver a ${barberia.nombre}` : "Iniciar sesión"}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
