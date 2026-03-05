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

export interface MonthlyAttendanceStat {
  month: string;
  completadas: number;
  ausentes: number;
}

/**
 * Get monthly attendance stats (completadas vs ausentes) for the last 6 months
 */
export async function getMonthlyAttendanceStats(barberId: string): Promise<MonthlyAttendanceStat[]> {
  const supabase = await createClient();

  const now = new Date();

  // Build slots for the last 6 months
  const slots: Array<{ year: number; month: number; label: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('es-CL', { month: 'short' });
    slots.push({ year: d.getFullYear(), month: d.getMonth(), label });
  }

  const startDate = `${slots[0].year}-${String(slots[0].month + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('reserva')
    .select('fecha, estado')
    .eq('barbero', barberId)
    .in('estado', ['completada', 'ausente'])
    .gte('fecha', startDate);

  const result: MonthlyAttendanceStat[] = slots.map((s) => ({
    month: s.label,
    completadas: 0,
    ausentes: 0,
  }));

  if (error || !data) return result;

  for (const booking of data) {
    const parts = booking.fecha.split('-');
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1; // convert to 0-indexed
    const idx = slots.findIndex((s) => s.year === y && s.month === m);
    if (idx === -1) continue;
    if (booking.estado === 'completada') result[idx].completadas++;
    else if (booking.estado === 'ausente') result[idx].ausentes++;
  }

  return result;
}

export interface ClientStat {
  correo: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  total_reservas: number;
  completadas: number;
  ausentes: number;
  canceladas: number;
  pendientes: number;
  primera_visita: string | null;
  ultima_visita: string | null;
  attendance_percentage: number | null;
  bloqueado: boolean;
  razon_bloqueo: string | null;
}

/**
 * Get all unique clients (grouped by email) with booking stats for a barber
 */
export async function getClientsWithStats(barberId: string): Promise<ClientStat[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reserva')
    .select(`
      fecha,
      estado,
      guest_usuario:guest_cliente (nombre, apellido, correo, telefono)
    `)
    .eq('barbero', barberId)
    .not('guest_cliente', 'is', null);

  if (error || !data) return [];

  // Fetch all blocked emails, phones and reasons in one query
  const { data: blockedList } = await supabase
    .from('cliente_bloqueado')
    .select('correo, telefono, razon');
  const blockedEmails = new Set((blockedList ?? []).map((b) => b.correo.toLowerCase()));
  const blockedPhones = new Set((blockedList ?? []).filter((b) => b.telefono).map((b) => b.telefono!));
  const blockedReasonByEmail = new Map((blockedList ?? []).map((b) => [b.correo.toLowerCase(), b.razon ?? null]));
  const blockedReasonByPhone = new Map((blockedList ?? []).filter((b) => b.telefono).map((b) => [b.telefono!, b.razon ?? null]));

  // Group by correo to unify same person across multiple bookings
  const clientMap = new Map<string, ClientStat>();

  for (const booking of data) {
    const guest = booking.guest_usuario as any;
    if (!guest?.correo) continue;

    const key = guest.correo;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        correo: guest.correo,
        nombre: guest.nombre,
        apellido: guest.apellido,
        telefono: guest.telefono,
        total_reservas: 0,
        completadas: 0,
        ausentes: 0,
        canceladas: 0,
        pendientes: 0,
        primera_visita: booking.fecha,
        ultima_visita: null,
        attendance_percentage: null,
        bloqueado: blockedEmails.has(guest.correo.toLowerCase()) || (guest.telefono ? blockedPhones.has(guest.telefono) : false),
        razon_bloqueo: blockedReasonByEmail.get(guest.correo.toLowerCase()) ?? (guest.telefono ? blockedReasonByPhone.get(guest.telefono) ?? null : null),
      });
    }

    const stat = clientMap.get(key)!;
    // Update with latest info (most recent booking's contact data)
    stat.nombre = guest.nombre;
    stat.apellido = guest.apellido;
    stat.telefono = guest.telefono;
    stat.total_reservas++;

    switch (booking.estado) {
      case 'completada': stat.completadas++; break;
      case 'ausente':    stat.ausentes++;    break;
      case 'cancelada':  stat.canceladas++;  break;
      default:           stat.pendientes++;  break;
    }

    if (!stat.primera_visita || booking.fecha < stat.primera_visita) {
      stat.primera_visita = booking.fecha;
    }
    if (!stat.ultima_visita || booking.fecha > stat.ultima_visita) {
      stat.ultima_visita = booking.fecha;
    }
  }

  // Compute attendance % only from resolved bookings (completada + ausente)
  for (const stat of clientMap.values()) {
    const resolved = stat.completadas + stat.ausentes;
    stat.attendance_percentage = resolved > 0
      ? Math.round((stat.completadas / resolved) * 100)
      : null;
  }

  return Array.from(clientMap.values()).sort((a, b) => b.total_reservas - a.total_reservas);
}

/**
 * Block a client by email
 */
export async function blockClient(
  correo: string,
  razon: string | null,
  barberoId: string,
  telefono?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('cliente_bloqueado')
    .upsert({ correo: correo.toLowerCase(), telefono: telefono?.trim() || null, razon, bloqueado_por: barberoId });

  if (error) {
    console.error('Error blocking client:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Unblock a client by email
 */
export async function unblockClient(
  correo: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('cliente_bloqueado')
    .delete()
    .eq('correo', correo.toLowerCase());

  if (error) {
    console.error('Error unblocking client:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
