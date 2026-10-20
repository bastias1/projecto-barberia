'use server'

import { blockClient, unblockClient, getClientBookings, type ClientBookingDetail } from "@/lib/services/dashboard-service";

export async function fetchClientBookings(
  idBarberia: string,
  barberId: string,
  correo: string
): Promise<ClientBookingDetail[]> {
  return getClientBookings(idBarberia, barberId, correo);
}

export async function toggleClientBlock(
  idBarberia: string,
  correo: string,
  block: boolean,
  razon?: string,
  telefono?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (block) {
    return blockClient(idBarberia, correo, razon ?? null, telefono);
  }
  return unblockClient(idBarberia, correo);
}
