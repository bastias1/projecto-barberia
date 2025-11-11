import { createClient } from "@/utils/supabase/client";
import { Database } from "../database.types";

export type Reserva = Database["public"]["Tables"]["reserva"]["Row"];
export type ReservaInsert = Database["public"]["Tables"]["reserva"]["Insert"];

export interface BookingData {
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
    // First, create or get the guest user (cliente)
    const { data: userData, error: userError } = await supabase
      .from("usuario")
      .select("id")
      .eq("correo", bookingData.customerInfo.email)
      .maybeSingle();

    let clienteId: string;

    if (userData) {
      // User already exists
      clienteId = userData.id;
    } else {
      // Create a new guest user with UUID
      const userId = crypto.randomUUID();
      
      const { data: newUser, error: createUserError } = await supabase
        .from("usuario")
        .insert({
          id: userId,
          nombre: bookingData.customerInfo.firstName,
          apellido: bookingData.customerInfo.lastName,
          correo: bookingData.customerInfo.email,
          telefono: bookingData.customerInfo.phone,
          rol: "cliente"
        })
        .select()
        .single();

      if (createUserError) {
        console.error("Error creating user:", createUserError);
        return { success: false, error: "No se pudo crear el usuario" };
      }

      clienteId = newUser.id;
    }

    // Format date and time for PostgreSQL
    const fecha = bookingData.date.toISOString().split('T')[0]; // YYYY-MM-DD
    const hora = bookingData.time; // HH:MM format

    // Create the reservation
    const { data: reservaData, error: reservaError } = await supabase
      .from("reserva")
      .insert({
        fecha,
        hora,
        estado: "pendiente",
        cliente: clienteId,
        servicio: bookingData.serviceId,
        barbero: null // Can be assigned later
      })
      .select()
      .single();

    if (reservaError) {
      console.error("Error creating reservation:", reservaError);
      return { success: false, error: "No se pudo crear la reserva" };
    }

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

  // Get all bookings for the selected date
  const { data: bookings, error } = await supabase
    .from("reserva")
    .select("hora")
    .eq("fecha", fecha)
    .neq("estado", "cancelada");

  if (error) {
    console.error("Error fetching bookings:", error);
    return [];
  }

  // All possible time slots
  const allTimeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
  ];

  // Filter out booked time slots
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

  return !data; // If no data, slot is available
}
