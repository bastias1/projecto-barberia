import { createClient } from "@/utils/supabase/server";

export interface HorarioBarbero {
  id: number;
  id_sucursal: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

export interface DaySchedule {
  dia_semana: number;
  horarios: HorarioBarbero[];
}

export interface BlockedDate {
  id: number;
  fecha: string;
  motivo: string | null;
}

/**
 * Get all schedules for a barber grouped by day
 */
export async function getBarberSchedules(idBarberia: string, barberId: string): Promise<DaySchedule[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('horario_atencion')
    .select('id:id_horario, id_sucursal, dia_semana, hora_inicio, hora_fin, activo')
    .eq('id_barberia', idBarberia)
    .eq('id_profesional', barberId)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    console.error("Error fetching schedules:", error);
    return [];
  }

  // Group by day
  const grouped: { [key: number]: HorarioBarbero[] } = {};
  (data as HorarioBarbero[])?.forEach(schedule => {
    if (!grouped[schedule.dia_semana]) {
      grouped[schedule.dia_semana] = [];
    }
    grouped[schedule.dia_semana].push(schedule);
  });

  return Object.keys(grouped).map(day => ({
    dia_semana: parseInt(day),
    horarios: grouped[parseInt(day)]
  }));
}

/**
 * Get blocked dates for a barber
 */
export async function getBlockedDates(idBarberia: string, barberId: string): Promise<BlockedDate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('dia_bloqueado')
    .select('id:id_dia_bloqueado, fecha, motivo')
    .eq('id_barberia', idBarberia)
    .eq('id_profesional', barberId)
    .order('fecha', { ascending: true });

  if (error) {
    console.error("Error fetching blocked dates:", error);
    return [];
  }

  return (data as BlockedDate[]) || [];
}
