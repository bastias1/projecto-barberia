'use server'

import { createClient } from "@/utils/supabase/server";
import { blockClient, unblockClient } from "@/lib/services/dashboard-service";

export interface ClientBookingDetail {
  id: number;
  fecha: string;
  hora: string;
  estado: string;
  servicio_nombre: string | null;
}

export async function fetchClientBookings(
  barberId: string,
  correo: string
): Promise<ClientBookingDetail[]> {
  const supabase = await createClient();

  // Step 1: find all guest_usuario IDs that share this email
  const { data: guests, error: guestError } = await supabase
    .from('guest_usuario')
    .select('id')
    .eq('correo', correo);

  const guestIds = guests?.map((g) => g.id) ?? [];
  if (guestIds.length === 0) return [];

  // Step 2: fetch all bookings for this barber linked to those guests
  const { data, error } = await supabase
    .from('reserva')
    .select('id, fecha, hora, estado, servicio(nombre)')
    .eq('barbero', barberId)
    .in('guest_cliente', guestIds);

  if (error || !data) return [];

  return data.map((b) => ({
    id: b.id,
    fecha: b.fecha,
    hora: b.hora,
    estado: b.estado,
    servicio_nombre: (b.servicio as any)?.nombre ?? null,
  }));
}

export async function toggleClientBlock(
  correo: string,
  block: boolean,
  razon?: string,
  barberoId?: string,
  telefono?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (block) {
    return blockClient(correo, razon ?? null, barberoId ?? '', telefono);
  }
  return unblockClient(correo);
}
