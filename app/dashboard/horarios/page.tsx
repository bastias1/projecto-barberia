import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Clock, CalendarX } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getBarberSchedules, getBlockedDates } from "@/lib/services/schedule-service";
import { WeeklySchedule } from "@/components/dashboard/weekly-schedule";
import { BlockedDates } from "@/components/dashboard/blocked-dates";

export default async function HorariosPage() {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/login');
  }

  // Get barber schedules and blocked dates
  const schedules = await getBarberSchedules(user.id);
  const blockedDates = await getBlockedDates(user.id);

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

      {/* Desktop Layout */}
      <div className="hidden md:block space-y-6">
        <WeeklySchedule barberId={user.id} initialSchedules={schedules} />
        <BlockedDates barberId={user.id} initialBlockedDates={blockedDates} />
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
            <WeeklySchedule barberId={user.id} initialSchedules={schedules} />
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
            <BlockedDates barberId={user.id} initialBlockedDates={blockedDates} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
