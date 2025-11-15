import { createClient } from "@/utils/supabase/server";

export interface HorarioBarbero {
  id: number;
  barbero: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

export interface DaySchedule {
  dia_semana: number;
  horarios: HorarioBarbero[];
}

/**
 * Get all schedules for a barber grouped by day
 */
export async function getBarberSchedules(barberId: string): Promise<DaySchedule[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('horario_barbero')
    .select('*')
    .eq('barbero', barberId)
    .order('dia_semana', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    console.error("Error fetching schedules:", error);
    return [];
  }

  // Group by day
  const grouped: { [key: number]: HorarioBarbero[] } = {};
  data?.forEach(schedule => {
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
export async function getBlockedDates(barberId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('dia_bloqueado')
    .select('*')
    .eq('barbero', barberId)
    .order('fecha', { ascending: true });

  if (error) {
    console.error("Error fetching blocked dates:", error);
    return [];
  }

  return data || [];
}
