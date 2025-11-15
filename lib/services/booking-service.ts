import { createClient } from "@/utils/supabase/client";
import { Database } from "../database.types";

export type Reserva = Database["public"]["Tables"]["reserva"]["Row"];
export type ReservaInsert = Database["public"]["Tables"]["reserva"]["Insert"];

export interface BookingData {
  barberoId: string;
  serviceId: number;
  date: Date;
  time: string;
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

// Create a new booking
export async function createBooking(bookingData: BookingData): Promise<{ success: boolean; data?: Reserva; error?: string }> {
  const supabase = createClient();

  try {
    // Check if guest user already exists
    const { data: guestData, error: guestCheckError } = await supabase
      .from("guest_usuario")
      .select("id")
      .eq("correo", bookingData.customerInfo.email)
      .maybeSingle();

    let guestClienteId: string;

    if (guestData) {
      // Guest user already exists
      guestClienteId = guestData.id;
    } else {
      // Create a new guest user
      const { data: newGuest, error: createGuestError } = await supabase
        .from("guest_usuario")
        .insert({
          nombre: bookingData.customerInfo.firstName,
          apellido: bookingData.customerInfo.lastName,
          correo: bookingData.customerInfo.email,
          telefono: bookingData.customerInfo.phone,
        })
        .select()
        .single();

      if (createGuestError) {
        console.error("Error creating guest user:", createGuestError);
        return { success: false, error: "No se pudo crear el usuario invitado" };
      }

      guestClienteId = newGuest.id;
    }

    // Format date and time for PostgreSQL
    const fecha = bookingData.date.toISOString().split('T')[0];
    const hora = bookingData.time;

    // Create the reservation - el webhook se dispara automáticamente
    const { data: reservaData, error: reservaError } = await supabase
      .from("reserva")
      .insert({
        fecha,
        hora,
        estado: "pendiente",
        guest_cliente: guestClienteId,
        cliente: null,
        servicio: bookingData.serviceId,
        barbero: bookingData.barberoId
      })
      .select(`
        *,
        barbero:barbero(nombre, apellido),
        servicio:servicio(nombre, precio, duracion)
      `)
      .single();

    if (reservaError) {
      console.error("Error creating reservation:", reservaError);
      return { success: false, error: "No se pudo crear la reserva" };
    }

    console.log("✅ Reserva creada exitosamente. Email enviándose automáticamente vía webhook...");

    return { success: true, data: reservaData };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { success: false, error: "Error inesperado al crear la reserva" };
  }
}

// Get available time slots for a specific date
export async function getAvailableTimeSlots(date: Date): Promise<string[]> {
  const supabase = createClient();
  
  const fecha = date.toISOString().split('T')[0];

  const { data: bookings, error } = await supabase
    .from("reserva")
    .select("hora")
    .eq("fecha", fecha)
    .neq("estado", "cancelada");

  if (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }

  const allTimeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
  ];

  const bookedTimes = bookings?.map(b => b.hora.substring(0, 5)) || [];
  const availableSlots = allTimeSlots.filter(slot => !bookedTimes.includes(slot));

  return availableSlots;
}

// Check if a specific time slot is available
export async function isTimeSlotAvailable(date: Date, time: string): Promise<boolean> {
  const supabase = createClient();
  
  const fecha = date.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from("reserva")
    .select("id")
    .eq("fecha", fecha)
    .eq("hora", time)
    .neq("estado", "cancelada")
    .maybeSingle();

  if (error) {
    console.error("Error checking availability:", error);
    return false;
  }

  return !data;
}