import { AppointmentsCalendar, type Vista } from "@/components/dashboard/appointments-calendar";
import { getAllAppointments } from "@/lib/services/dashboard-service";
import { getSucursalesDelProfesional } from "@/lib/barberia";
import { requireStaff } from "@/lib/staff-context";
import { createClient } from "@/utils/supabase/server";

export default async function CitasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vista?: string; fecha?: string }>;
}) {
  const ctx = await requireStaff((await params).slug);
  const { vista, fecha } = await searchParams;
  const idBarberia = ctx.barberia.id_barberia;

  const [appointments, sucursales] = await Promise.all([
    getAllAppointments(idBarberia, ctx.userId),
    ctx.isProfesional ? getSucursalesDelProfesional(await createClient(), idBarberia, ctx.userId) : Promise.resolve([]),
  ]);

  // ?vista=dia|semana|mes&fecha=YYYY-MM-DD (lo que no calce, se ignora)
  const vistaInicial: Vista = vista === "dia" || vista === "mes" ? vista : "semana";
  const fechaInicial = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !isNaN(Date.parse(fecha)) ? fecha : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Mis Citas
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">
          Tu agenda por día
        </p>
      </div>

      <AppointmentsCalendar
        appointments={appointments}
        vistaInicial={vistaInicial}
        fechaInicial={fechaInicial}
        nuevaCita={ctx.isProfesional && sucursales.length > 0 ? { barberoId: ctx.userId, sucursales } : null}
      />
    </div>
  );
}
