import { createClient } from "@/utils/supabase/server";

/**
 * Dashboard service functions for fetching barber statistics and appointments
 */

export interface DashboardStats {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  clientCount: number;
  monthlyRevenue: number;
  nextAppointmentTime: string | null;
}

export interface Appointment {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  servicio: {
    nombre: string;
    precio: number;
  } | null;
  guest_usuario: {
    nombre: string;
    apellido: string;
    telefono: string;
    correo: string;
  } | null;
}

export interface Booking {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  created_at: string;
  servicio: {
    nombre: string;
    precio: number;
  } | null;
  guest_usuario: {
    nombre: string;
    apellido: string;
  } | null;
}

/**
 * Get barber information by user ID
 */
export async function getBarberInfo(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('barbero')
    .select('*, usuario!inner(profile_image)')
    .eq('id', userId)
    .single();

  if (error) {
    console.error("Error fetching barber info:", error);
    return null;
  }

  return data;
}

/**
 * Helper to format date as YYYY-MM-DD in local timezone
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get dashboard statistics for a barber
 */
export async function getDashboardStats(barberId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = formatLocalDate(today);
  const tomorrowStr = formatLocalDate(tomorrow);

  // Get today's appointments count
  const { count: todayCount } = await supabase
    .from('reserva')
    .select('*', { count: 'exact' })
    .eq('barbero', barberId)
    .eq('fecha', todayStr);

  // Get this week's appointments count
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const { count: weekCount } = await supabase
    .from('reserva')
    .select('*', { count: 'exact' })
    .eq('barbero', barberId)
    .gte('fecha', formatLocalDate(weekStart))
    .lt('fecha', formatLocalDate(weekEnd));

  // Get this month's appointments count
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const { count: monthCount } = await supabase
    .from('reserva')
    .select('*', { count: 'exact' })
    .eq('barbero', barberId)
    .gte('fecha', formatLocalDate(monthStart))
    .lte('fecha', formatLocalDate(monthEnd));

  // Get total unique clients count
  const { count: clientCount } = await supabase
    .from('reserva')
    .select('guest_cliente', { count: 'exact' })
    .eq('barbero', barberId);

  // Get monthly revenue
  const { data: monthlyAppointments } = await supabase
    .from('reserva')
    .select('servicio(precio)')
    .eq('barbero', barberId)
    .gte('fecha', formatLocalDate(monthStart))
    .lte('fecha', formatLocalDate(monthEnd));

  const monthlyRevenue = monthlyAppointments?.reduce((total, apt) => {
    const serviceData = apt.servicio as { precio: number } | { precio: number }[] | null;
    const precio = Array.isArray(serviceData)
      ? serviceData[0]?.precio
      : serviceData?.precio;
    return total + (precio || 0);
  }, 0) || 0;

  // Get next appointment time for today
  const { data: nextAppointment } = await supabase
    .from('reserva')
    .select('hora')
    .eq('barbero', barberId)
    .eq('fecha', todayStr)
    .order('hora', { ascending: true })
    .limit(1)
    .single();

  return {
    todayCount: todayCount || 0,
    weekCount: weekCount || 0,
    monthCount: monthCount || 0,
    clientCount: clientCount || 0,
    monthlyRevenue,
    nextAppointmentTime: nextAppointment?.hora?.substring(0, 5) || null,
  };
}

/**
 * Get upcoming appointments for a barber (next 7 days)
 */
export async function getUpcomingAppointments(barberId: string, limit = 10): Promise<Appointment[]> {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const { data, error } = await supabase
    .from('reserva')
    .select(`
      *,
      servicio (nombre, precio),
      guest_usuario:guest_cliente (nombre, apellido, correo, telefono)
    `)
    .eq('barbero', barberId)
    .gte('fecha', formatLocalDate(today))
    .lt('fecha', formatLocalDate(weekEnd))
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching upcoming appointments:", error);
    return [];
  }

  return data || [];
}

/**
 * Get today's appointments for a barber
 */
export async function getTodayAppointments(barberId: string): Promise<Appointment[]> {
  const supabase = await createClient();

  const today = new Date();
  const todayStr = formatLocalDate(today);

  const { data, error } = await supabase
    .from('reserva')
    .select(`
      *,
      servicio (nombre, precio),
      guest_usuario:guest_cliente (nombre, apellido, correo, telefono)
    `)
    .eq('barbero', barberId)
    .eq('fecha', todayStr)
    .order('hora', { ascending: true });

  if (error) {
    console.error("Error fetching today's appointments:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recent bookings for a barber
 */
export async function getRecentBookings(barberId: string, limit = 5): Promise<Booking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reserva')
    .select(`
      *,
      servicio (nombre, precio),
      guest_usuario:guest_cliente (nombre, apellido, correo, telefono)
    `)
    .eq('barbero', barberId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent bookings:", error);
    return [];
  }

  return data || [];
}

/**
 * Get all appointments for a barber (for full appointments list)
 */
export async function getAllAppointments(barberId: string): Promise<Appointment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reserva')
    .select(`
      *,
      servicio (nombre, precio),
      guest_usuario:guest_cliente (nombre, apellido, correo, telefono)
    `)
    .eq('barbero', barberId)
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });

  if (error) {
    console.error("Error fetching all appointments:", error);
    return [];
  }

  return data || [];
}
