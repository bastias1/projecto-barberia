import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Clock, CalendarX, MapPin } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getBarberSchedules, getBlockedDates } from "@/lib/services/schedule-service";
import { getSucursalesDelProfesional } from "@/lib/barberia";
import { requireStaff } from "@/lib/staff-context";
import { WeeklySchedule } from "@/components/dashboard/weekly-schedule";
import { BlockedDates } from "@/components/dashboard/blocked-dates";

export default async function HorariosPage({ params }: { params: Promise<{ slug: string }> }) {
  const ctx = await requireStaff((await params).slug);

  const idBarberia = ctx.barberia.id_barberia;

  // Get barber schedules, blocked dates and branches
  const [schedules, blockedDates, sucursales] = await Promise.all([
    getBarberSchedules(idBarberia, ctx.userId),
    getBlockedDates(idBarberia, ctx.userId),
    // Solo puede atender en las sucursales a las que lo asignó el administrador
    getSucursalesDelProfesional(await createClient(), idBarberia, ctx.userId),
  ]);

  const scheduleProps = { barberId: ctx.userId, barberiaId: idBarberia, sucursales, initialSchedules: schedules };
  const blockedProps = { barberId: ctx.userId, barberiaId: idBarberia, initialBlockedDates: blockedDates };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Horarios
        </h1>
        <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 mt-0.5 md:mt-1">
          Configura tu disponibilidad semanal
        </p>
      </div>

      {sucursales.length === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <MapPin className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            {ctx.isAdmin
              ? "No estás asignado a ninguna sucursal. Asígnate en Mi Barbería → Sucursales para definir tu horario."
              : "Aún no estás asignado a ninguna sucursal. Pide al administrador que te asigne para poder definir tu horario."}
          </p>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:block space-y-6">
        <WeeklySchedule {...scheduleProps} />
        <BlockedDates {...blockedProps} />
      </div>

      {/* Mobile Layout - Accordion */}
      <Accordion type="single" collapsible defaultValue="schedule" className="md:hidden space-y-2">
        <AccordionItem value="schedule" className="border rounded-lg bg-white dark:bg-zinc-900">
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Horario Semanal</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Días y horarios disponibles</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <WeeklySchedule {...scheduleProps} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="blocked" className="border rounded-lg bg-white dark:bg-zinc-900">
          <AccordionTrigger className="hover:no-underline px-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <CalendarX className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Fechas Bloqueadas</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Vacaciones y días no laborables</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <BlockedDates {...blockedProps} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
