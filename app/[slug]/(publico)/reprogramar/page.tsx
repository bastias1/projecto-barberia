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

/**
 * HU-22: elegir otra fecha y hora para una reserva propia (mismo barbero y servicio).
 * Se llega con sesión (desde Mi Perfil) o con el link firmado del correo (?token=).
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

  const conLink = /^\d+$/.test(id) && verifyLink("cancelar-reserva", id, token);
  const supabase = conLink ? createServiceRoleClient() : await createClient();
  // Sin link, RLS solo devuelve la reserva a su dueño
  const { data } = /^\d+$/.test(id)
    ? await supabase
        .from("reserva")
        .select(`
          id_reserva, id_profesional, fecha_hora_inicio, estado,
          servicio:servicio!reserva_servicio_fkey (id_servicio, nombre, precio, duracion_min),
          sucursal:sucursal!reserva_sucursal_fkey (zona_horaria)
        `)
        .eq("id_reserva", id)
        .eq("id_barberia", barberia.id_barberia)
        .maybeSingle()
    : { data: null };

  const servicio = one<{ id_servicio: number; nombre: string; precio: number; duracion_min: number }>(data?.servicio);
  const modificable = data && servicio && ["pendiente", "confirmada"].includes(data.estado);

  return (
    <main id="contenido" className="pagina-barberia min-h-dvh bg-background p-4 py-8 pb-28">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Cambiar la hora de tu cita</h1>
        {modificable ? (
          <ReprogramarForm
            idReserva={data.id_reserva}
            token={conLink ? token : null}
            barberoId={data.id_profesional}
            servicio={{ id: servicio.id_servicio, nombre: servicio.nombre, descripcion: null, precio: Number(servicio.precio) }}
            duracion={servicio.duracion_min}
            actual={(() => {
              const { fecha, hora } = toZoned(data.fecha_hora_inicio, one<{ zona_horaria: string }>(data.sucursal)?.zona_horaria || DEFAULT_TZ);
              return `${formatFecha(fecha, "EEEE d 'de' MMMM")}, ${hora}`;
            })()}
            plazo={formatPlazo(barberia.plazo_cancelacion_min)}
          />
        ) : (
          <div className="text-center space-y-4 mt-8">
            <p className="text-muted-foreground">
              {data ? "Esta cita ya no se puede modificar." : "No encontramos esta cita. Si es tuya, inicia sesión o abre el link del correo de tu reserva."}
            </p>
            <Button asChild>
              <Link href={data ? `/${slug}` : `/login?${new URLSearchParams({ barberia: slug, next: `/${slug}/reprogramar?id=${id}` })}`}>
                {data ? `Volver a ${barberia.nombre}` : "Iniciar sesión"}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
