import { createClient } from "@/utils/supabase/server";
import { DEFAULT_TZ } from "@/lib/barberia";
import { addDays, dayOfWeek, fromZoned, todayIn, toZoned } from "@/lib/datetime";
import { one, todasLasFilas } from "@/lib/utils";

/**
 * Dashboard service functions for fetching barber statistics and appointments.
 * Las fechas se calculan en la zona horaria de la barbería, no la del servidor.
 */

export interface DashboardStats {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  clientCount: number;
  monthlyRevenue: number;
  nextAppointmentTime: string | null;
}

export interface AppointmentClient {
  nombre: string;
  apellido: string;
  telefono: string | null;
  correo: string;
  registrado: boolean;
}

export interface Appointment {
  id: number;
  fecha: string; // YYYY-MM-DD local
  hora: string;  // HH:mm local
  estado: string;
  created_at: string;
  notas: string | null;
  servicio: {
    nombre: string;
    precio: number;
  } | null;
  cliente: AppointmentClient | null;
}

export type Booking = Appointment;

const RESERVA_COLUMNS = `
  id_reserva, fecha_hora_inicio, estado, monto, notas, created_at,
  servicio:servicio!reserva_servicio_fkey (nombre, precio),
  guest:guest_usuario!reserva_guest_fkey (nombre, apellido, correo, telefono),
  usuario:usuario!reserva_cliente_fkey (nombre, apellido, email, telefono)
`;

type ReservaRow = {
  id_reserva: number;
  fecha_hora_inicio: string;
  estado: string;
  monto: number;
  notas: string | null;
  created_at: string;
  servicio: unknown;
  guest: unknown;
  usuario: unknown;
};

function toClient(row: ReservaRow): AppointmentClient | null {
  const guest = one<{ nombre: string; apellido: string; correo: string; telefono: string | null }>(row.guest);
  if (guest) {
    return { ...guest, registrado: false };
  }
  const usuario = one<{ nombre: string; apellido: string | null; email: string; telefono: string | null }>(row.usuario);
  if (usuario) {
    return { nombre: usuario.nombre, apellido: usuario.apellido || "", correo: usuario.email, telefono: usuario.telefono, registrado: true };
  }
  return null;
}

function toAppointment(row: ReservaRow): Appointment {
  const { fecha, hora } = toZoned(row.fecha_hora_inicio, DEFAULT_TZ);
  const servicio = one<{ nombre: string; precio: number }>(row.servicio);
  return {
    id: row.id_reserva,
    fecha,
    hora,
    estado: row.estado,
    created_at: row.created_at,
    notas: row.notas,
    // El monto queda fijado en la reserva; puede diferir del precio actual
    servicio: servicio ? { nombre: servicio.nombre, precio: Number(row.monto ?? servicio.precio) } : null,
    cliente: toClient(row),
  };
}

/** Inicio (UTC ISO) de un día local de la barbería. */
function startOf(fecha: string) {
  return fromZoned(fecha, "00:00", DEFAULT_TZ).toISOString();
}

async function getContext(idBarberia: string) {
  return { supabase: await createClient(), idBarberia };
}

// Síncrona a propósito: el builder de PostgREST es "thenable" y devolverlo
// desde una función async ejecutaría la consulta antes de agregar filtros.
function reservasDelBarbero(
  { supabase, idBarberia }: Awaited<ReturnType<typeof getContext>>,
  barberId: string
) {
  return supabase
    .from('reserva')
    .select(RESERVA_COLUMNS)
    .eq('id_barberia', idBarberia)
    .eq('id_profesional', barberId);
}

async function countReservas(idBarberia: string, barberId: string, desde: string, hasta: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('reserva')
    .select('id_reserva', { count: 'exact', head: true })
    .eq('id_barberia', idBarberia)
    .eq('id_profesional', barberId)
    .neq('estado', 'cancelada')
    .gte('fecha_hora_inicio', startOf(desde))
    .lt('fecha_hora_inicio', startOf(hasta));
  return count || 0;
}

/** Citas de hoy que aún hay que atender (pendientes o confirmadas): badge de la barra móvil. */
export async function countCitasPorAtenderHoy(idBarberia: string, barberId: string): Promise<number> {
  const supabase = await createClient();
  const today = todayIn(DEFAULT_TZ);
  const { count } = await supabase
    .from('reserva')
    .select('id_reserva', { count: 'exact', head: true })
    .eq('id_barberia', idBarberia)
    .eq('id_profesional', barberId)
    .in('estado', ['pendiente', 'confirmada'])
    .gte('fecha_hora_inicio', startOf(today))
    .lt('fecha_hora_inicio', startOf(addDays(today, 1)));
  return count || 0;
}

/**
 * Get dashboard statistics for a barber
 */
export async function getDashboardStats(idBarberia: string, barberId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const today = todayIn(DEFAULT_TZ);
  const weekStart = addDays(today, -dayOfWeek(today));
  const monthStart = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split('-').map(Number);
  const nextMonthStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const [todayCount, weekCount, monthCount, clientsRes, revenueRes, nextRes] = await Promise.all([
    countReservas(idBarberia, barberId, today, addDays(today, 1)),
    countReservas(idBarberia, barberId, weekStart, addDays(weekStart, 7)),
    countReservas(idBarberia, barberId, monthStart, nextMonthStart),
    todasLasFilas<{ id_cliente: string | null; id_guest: string | null }>(() => supabase
      .from('reserva')
      .select('id_cliente, id_guest')
      .eq('id_barberia', idBarberia)
      .eq('id_profesional', barberId)
      .order('id_reserva')),
    supabase
      .from('reserva')
      .select('monto')
      .eq('id_barberia', idBarberia)
      .eq('id_profesional', barberId)
      .eq('estado', 'completada')
      .gte('fecha_hora_inicio', startOf(monthStart))
      .lt('fecha_hora_inicio', startOf(nextMonthStart)),
    supabase
      .from('reserva')
      .select('fecha_hora_inicio')
      .eq('id_barberia', idBarberia)
      .eq('id_profesional', barberId)
      .in('estado', ['pendiente', 'confirmada'])
      .gte('fecha_hora_inicio', new Date().toISOString())
      .lt('fecha_hora_inicio', startOf(addDays(today, 1)))
      .order('fecha_hora_inicio', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const clientes = new Set(clientsRes.data.map((r) => r.id_cliente ?? r.id_guest));
  const monthlyRevenue = (revenueRes.data ?? []).reduce((total, r) => total + Number(r.monto || 0), 0);

  return {
    todayCount,
    weekCount,
    monthCount,
    clientCount: clientes.size,
    monthlyRevenue,
    nextAppointmentTime: nextRes.data ? toZoned(nextRes.data.fecha_hora_inicio, DEFAULT_TZ).hora : null,
  };
}

/**
 * Get upcoming appointments for a barber (next 7 days)
 */
export async function getUpcomingAppointments(idBarberia: string, barberId: string, limit = 10): Promise<Appointment[]> {
  const today = todayIn(DEFAULT_TZ);

  const { data, error } = await reservasDelBarbero(await getContext(idBarberia), barberId)
    .gte('fecha_hora_inicio', startOf(today))
    .lt('fecha_hora_inicio', startOf(addDays(today, 7)))
    .order('fecha_hora_inicio', { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching upcoming appointments:", error);
    return [];
  }

  return (data as ReservaRow[]).map(toAppointment);
}

/**
 * Get today's appointments for a barber
 */
export async function getTodayAppointments(idBarberia: string, barberId: string): Promise<Appointment[]> {
  const today = todayIn(DEFAULT_TZ);

  const { data, error } = await reservasDelBarbero(await getContext(idBarberia), barberId)
    .gte('fecha_hora_inicio', startOf(today))
    .lt('fecha_hora_inicio', startOf(addDays(today, 1)))
    .order('fecha_hora_inicio', { ascending: true });

  if (error) {
    console.error("Error fetching today's appointments:", error);
    return [];
  }

  return (data as ReservaRow[]).map(toAppointment);
}

/**
 * Get recent bookings for a barber
 */
export async function getRecentBookings(idBarberia: string, barberId: string, limit = 5): Promise<Booking[]> {
  const { data, error } = await reservasDelBarbero(await getContext(idBarberia), barberId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent bookings:", error);
    return [];
  }

  return (data as ReservaRow[]).map(toAppointment);
}

/**
 * Get all appointments for a barber (for full appointments list)
 */
export async function getAllAppointments(idBarberia: string, barberId: string): Promise<Appointment[]> {
  const context = await getContext(idBarberia);
  const { data, error } = await todasLasFilas<ReservaRow>(() => reservasDelBarbero(context, barberId)
    .order('fecha_hora_inicio', { ascending: true })
    .order('id_reserva'));

  if (error) {
    console.error("Error fetching all appointments:", error);
    return [];
  }

  return (data as ReservaRow[]).map(toAppointment);
}

export interface MonthlyAttendanceStat {
  month: string;
  completadas: number;
  ausentes: number;
}

/**
 * Get monthly attendance stats (completadas vs no asistió) for the last 6 months
 */
export async function getMonthlyAttendanceStats(idBarberia: string, barberId: string): Promise<MonthlyAttendanceStat[]> {
  const supabase = await createClient();

  const now = new Date();

  // Build slots for the last 6 months
  const slots: Array<{ key: string; label: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    slots.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-CL', { month: 'short' }),
    });
  }

  const { data, error } = await todasLasFilas<{ fecha_hora_inicio: string; estado: string }>(() => supabase
    .from('reserva')
    .select('fecha_hora_inicio, estado')
    .eq('id_barberia', idBarberia)
    .eq('id_profesional', barberId)
    .in('estado', ['completada', 'no_asistio'])
    .gte('fecha_hora_inicio', startOf(`${slots[0].key}-01`))
    .order('id_reserva'));

  const result: MonthlyAttendanceStat[] = slots.map((s) => ({
    month: s.label,
    completadas: 0,
    ausentes: 0,
  }));

  if (error) return result;

  for (const booking of data) {
    const key = toZoned(booking.fecha_hora_inicio, DEFAULT_TZ).fecha.slice(0, 7);
    const idx = slots.findIndex((s) => s.key === key);
    if (idx === -1) continue;
    if (booking.estado === 'completada') result[idx].completadas++;
    else result[idx].ausentes++;
  }

  return result;
}

export interface ClientStat {
  correo: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  registrado: boolean;
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

function soloDigitos(telefono: string | null | undefined) {
  return (telefono ?? '').replace(/\D/g, '');
}

/**
 * Get all unique clients (grouped by email) with booking stats for a barber
 */
export async function getClientsWithStats(idBarberia: string, barberId: string): Promise<ClientStat[]> {
  const context = await getContext(idBarberia);
  const { supabase } = context;

  const [{ data, error }, { data: blockedList }] = await Promise.all([
    todasLasFilas<ReservaRow>(() => reservasDelBarbero(context, barberId)
      .order('fecha_hora_inicio', { ascending: true })
      .order('id_reserva')),
    supabase
      .from('cliente_bloqueado')
      .select('correo, telefono, razon')
      .eq('id_barberia', idBarberia),
  ]);

  if (error) return [];

  const blockedByEmail = new Map((blockedList ?? []).map((b) => [b.correo, b.razon ?? null]));
  const blockedByPhone = new Map(
    (blockedList ?? []).filter((b) => soloDigitos(b.telefono)).map((b) => [soloDigitos(b.telefono), b.razon ?? null])
  );

  // Group by correo to unify same person across multiple bookings
  const clientMap = new Map<string, ClientStat>();

  for (const row of data as ReservaRow[]) {
    const booking = toAppointment(row);
    const cliente = booking.cliente;
    if (!cliente?.correo) continue;

    const key = cliente.correo.toLowerCase();
    const phone = soloDigitos(cliente.telefono);
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        correo: cliente.correo,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        registrado: cliente.registrado,
        total_reservas: 0,
        completadas: 0,
        ausentes: 0,
        canceladas: 0,
        pendientes: 0,
        primera_visita: booking.fecha,
        ultima_visita: null,
        attendance_percentage: null,
        bloqueado: blockedByEmail.has(key) || (phone ? blockedByPhone.has(phone) : false),
        razon_bloqueo: blockedByEmail.get(key) ?? (phone ? blockedByPhone.get(phone) ?? null : null),
      });
    }

    const stat = clientMap.get(key)!;
    // Update with latest info (most recent booking's contact data)
    stat.nombre = cliente.nombre;
    stat.apellido = cliente.apellido;
    stat.telefono = cliente.telefono ?? stat.telefono;
    stat.total_reservas++;

    switch (booking.estado) {
      case 'completada': stat.completadas++; break;
      case 'no_asistio': stat.ausentes++;    break;
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

  // Compute attendance % only from resolved bookings (completada + no_asistio)
  for (const stat of clientMap.values()) {
    const resolved = stat.completadas + stat.ausentes;
    stat.attendance_percentage = resolved > 0
      ? Math.round((stat.completadas / resolved) * 100)
      : null;
  }

  return Array.from(clientMap.values()).sort((a, b) => b.total_reservas - a.total_reservas);
}

export interface ClientBookingDetail {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  servicio_nombre: string | null;
}

/**
 * All bookings of one client (by email) with a barber
 */
export async function getClientBookings(idBarberia: string, barberId: string, correo: string): Promise<ClientBookingDetail[]> {
  const context = await getContext(idBarberia);
  const { supabase } = context;
  // ilike para ignorar mayúsculas; se escapan los comodines (_ es común en correos)
  const email = correo.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`);

  // El mismo correo puede corresponder a un invitado y/o a un cliente registrado
  const [{ data: guests }, { data: usuarios }] = await Promise.all([
    supabase.from('guest_usuario').select('id_guest').eq('id_barberia', idBarberia).ilike('correo', email),
    supabase.from('usuario').select('id_usuario').ilike('email', email),
  ]);

  const guestIds = (guests ?? []).map((g) => g.id_guest);
  const userIds = (usuarios ?? []).map((u) => u.id_usuario);
  const filtros = [
    guestIds.length ? `id_guest.in.(${guestIds.join(',')})` : null,
    userIds.length ? `id_cliente.in.(${userIds.join(',')})` : null,
  ].filter(Boolean);
  if (filtros.length === 0) return [];

  const { data, error } = await reservasDelBarbero(context, barberId).or(filtros.join(','));
  if (error || !data) return [];

  return (data as ReservaRow[]).map((row) => {
    const b = toAppointment(row);
    return { id: b.id, fecha: b.fecha, hora: b.hora, estado: b.estado, servicio_nombre: b.servicio?.nombre ?? null };
  });
}

/**
 * Block a client by email (and phone) in this barbershop
 */
export async function blockClient(
  idBarberia: string,
  correo: string,
  razon: string | null,
  telefono?: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('cliente_bloqueado')
    .upsert(
      {
        id_barberia: idBarberia,
        correo: correo.toLowerCase(),
        telefono: telefono?.trim() || null,
        razon,
        bloqueado_por: user?.id ?? null,
      },
      { onConflict: 'id_barberia,correo' }
    );

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
  idBarberia: string,
  correo: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('cliente_bloqueado')
    .delete()
    .eq('id_barberia', idBarberia)
    .eq('correo', correo.toLowerCase());

  if (error) {
    console.error('Error unblocking client:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
