'use server'

import { createClient } from "@/utils/supabase/server";
import { getBarberiaBySlug, getSucursales, DEFAULT_TZ } from "@/lib/barberia";
import { fromZoned } from "@/lib/datetime";
import { notificarReservaCreada } from "@/lib/notifications";
import { VERSION_POLITICA } from "@/lib/plataforma";

export interface CrearReservaInput {
  slug: string; // barbería de la URL
  barberoId: string;
  serviceId: number;
  idSucursal: number;
  fecha: string; // YYYY-MM-DD local de la sucursal
  hora: string;  // HH:mm
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  aceptaPrivacidad: boolean;
}

export type CrearReservaResult =
  | { success: true; idReserva: number }
  | { success: false; error: string };

export async function crearReserva(input: CrearReservaInput): Promise<CrearReservaResult> {
  const supabase = await createClient();
  const barberia = await getBarberiaBySlug(supabase, input.slug);
  if (!barberia) {
    return { success: false, error: "Barbería no encontrada" };
  }
  const idBarberia = barberia.id_barberia;
  const sucursales = await getSucursales(supabase, idBarberia);
  const sucursal = sucursales.find((s) => s.id_sucursal === input.idSucursal);
  if (!sucursal) {
    return { success: false, error: "La sucursal no está disponible" };
  }
  const tz = sucursal.zona_horaria || DEFAULT_TZ;

  const { data: idReserva, error } = await supabase.rpc("reservar_como_invitado", {
    p_barberia: idBarberia,
    p_sucursal: input.idSucursal,
    p_profesional: input.barberoId,
    p_servicio: input.serviceId,
    p_inicio: fromZoned(input.fecha, input.hora, tz).toISOString(),
    p_nombre: input.customerInfo.firstName.trim(),
    p_apellido: input.customerInfo.lastName.trim(),
    p_correo: input.customerInfo.email.trim().toLowerCase(),
    p_telefono: input.customerInfo.phone.trim() || null,
    p_acepta_privacidad: input.aceptaPrivacidad,
    p_version_politica: VERSION_POLITICA,
  });

  if (error) {
    console.error("Error creating reservation:", error);
    if (error.message.includes("CLIENTE_BLOQUEADO")) {
      return { success: false, error: "CLIENT_BLOCKED" };
    }
    if (error.code === "23P01") {
      return { success: false, error: "Ese horario acaba de ser reservado. Por favor elige otro." };
    }
    if (error.code === "23514") {
      // Mensajes de validación de los triggers (horario, día bloqueado, etc.)
      return { success: false, error: error.message };
    }
    return { success: false, error: "No se pudo crear la reserva" };
  }

  await notificarReservaCreada(idReserva as number);

  return { success: true, idReserva: idReserva as number };
}
