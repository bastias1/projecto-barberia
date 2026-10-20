import { createClient } from "@/utils/supabase/client";
import { getSucursales, DEFAULT_TZ } from "@/lib/barberia";
import { dayOfWeek, fromZoned, localDateString, addDays } from "@/lib/datetime";

export interface TimeSlot {
  hora: string; // HH:mm local de la sucursal
  idSucursal: number;
}

// Intervalo entre horarios ofrecidos y anticipación mínima para reservar
const SLOT_STEP_MIN = 30;
const MIN_ADVANCE_MS = 2 * 60 * 60 * 1000;

function toMinutes(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function toHora(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Horarios disponibles de un barbero para una fecha y la duración del servicio.
 * Cruza su horario de atención con los días bloqueados y las reservas existentes
 * (vía RPC públicas, ya que un visitante no puede leer reservas ajenas).
 */
export async function getAvailableTimeSlots(
  idBarberia: string,
  date: Date,
  barberId: string,
  duracionMin: number,
  idSucursal?: number,
  // El personal agenda sin anticipación (p. ej. alguien que llega sin hora)
  minAnticipacionMs: number = MIN_ADVANCE_MS,
): Promise<TimeSlot[]> {
  const supabase = createClient();
  const fecha = localDateString(date);

  const [{ data: bloqueados }, { data: todosHorarios }, sucursales] = await Promise.all([
    supabase.rpc("dias_bloqueados", { p_barberia: idBarberia, p_profesional: barberId, p_desde: fecha, p_hasta: fecha }),
    supabase
      .from("horario_atencion")
      .select("id_sucursal, hora_inicio, hora_fin")
      .eq("id_barberia", idBarberia)
      .eq("id_profesional", barberId)
      .eq("dia_semana", dayOfWeek(fecha))
      .eq("activo", true),
    getSucursales(supabase, idBarberia),
  ]);

  // Solo turnos de sucursales activas (y de la elegida, si se indicó)
  const horarios = (todosHorarios ?? []).filter((h) =>
    sucursales.some((s) => s.id_sucursal === h.id_sucursal) && (!idSucursal || h.id_sucursal === idSucursal)
  );

  if ((bloqueados && bloqueados.length > 0) || horarios.length === 0) {
    return [];
  }

  const tzOf = (idSucursal: number) =>
    sucursales.find((s) => s.id_sucursal === idSucursal)?.zona_horaria || DEFAULT_TZ;

  const tz = tzOf(horarios[0].id_sucursal);
  const { data: ocupados } = await supabase.rpc("horarios_ocupados", {
    p_barberia: idBarberia,
    p_profesional: barberId,
    p_desde: fromZoned(fecha, "00:00", tz).toISOString(),
    p_hasta: fromZoned(addDays(fecha, 1), "00:00", tz).toISOString(),
  });
  const busy = (ocupados || []).map((o: { inicio: string; fin: string }) => [Date.parse(o.inicio), Date.parse(o.fin)]);

  const minStart = Date.now() + minAnticipacionMs;
  const duracionMs = duracionMin * 60 * 1000;
  const slots = new Map<string, TimeSlot>();

  for (const horario of horarios) {
    const fin = toMinutes(horario.hora_fin);
    for (let t = toMinutes(horario.hora_inicio); t + duracionMin <= fin; t += SLOT_STEP_MIN) {
      const hora = toHora(t);
      const inicio = fromZoned(fecha, hora, tzOf(horario.id_sucursal)).getTime();
      const termino = inicio + duracionMs;

      if (inicio < minStart) continue;
      if (busy.some(([bInicio, bFin]: number[]) => inicio < bFin && termino > bInicio)) continue;

      slots.set(hora, { hora, idSucursal: horario.id_sucursal });
    }
  }

  return Array.from(slots.values()).sort((a, b) => a.hora.localeCompare(b.hora));
}
