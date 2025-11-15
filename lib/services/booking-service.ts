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
      // Guest user already exists - update their information
      const { data: updatedGuest, error: updateError } = await supabase
        .from("guest_usuario")
        .update({
          nombre: bookingData.customerInfo.firstName,
          apellido: bookingData.customerInfo.lastName,
          telefono: bookingData.customerInfo.phone,
        })
        .eq("id", guestData.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating guest user:", updateError);
        return { success: false, error: "No se pudo actualizar el usuario invitado" };
      }

      guestClienteId = updatedGuest.id;
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

// Get available time slots for a specific date and barber
export async function getAvailableTimeSlots(date: Date, barberId?: string): Promise<string[]> {
  const supabase = createClient();
  
  const fecha = date.toISOString().split('T')[0];
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // If barber is specified, check if date is blocked
  if (barberId) {
    const { data: blockedDate } = await supabase
      .from('dia_bloqueado')
      .select('id')
      .eq('barbero', barberId)
      .eq('fecha', fecha)
      .maybeSingle();

    if (blockedDate) {
      return []; // Date is blocked
    }

    // Get barber's schedule for this day
    const { data: schedules } = await supabase
      .from('horario_barbero')
      .select('hora_inicio, hora_fin')
      .eq('barbero', barberId)
      .eq('dia_semana', dayOfWeek)
      .eq('activo', true);

    if (!schedules || schedules.length === 0) {
      return []; // No schedule configured for this day
    }

    // Generate time slots based on barber's schedule
    const allTimeSlots: string[] = [];
    schedules.forEach(schedule => {
      const startHour = parseInt(schedule.hora_inicio.split(':')[0]);
      const endHour = parseInt(schedule.hora_fin.split(':')[0]);
      
      for (let hour = startHour; hour < endHour; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        if (!allTimeSlots.includes(timeSlot)) {
          allTimeSlots.push(timeSlot);
        }
      }
    });

    // Get already booked times for this barber
    const { data: bookings } = await supabase
      .from("reserva")
      .select("hora")
      .eq("fecha", fecha)
      .eq("barbero", barberId)
      .neq("estado", "cancelada");

    const bookedTimes = bookings?.map(b => b.hora.substring(0, 5)) || [];
    let availableSlots = allTimeSlots.filter(slot => !bookedTimes.includes(slot));

    // Filter out slots that are less than 2 hours from now for same-day bookings
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate.getTime() === today.getTime()) {
      // Same day booking - require 2 hours advance
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const minHour = twoHoursFromNow.getHours();
      const minMinute = twoHoursFromNow.getMinutes();
      
      availableSlots = availableSlots.filter(slot => {
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        return slotHour > minHour || (slotHour === minHour && slotMinute >= minMinute);
      });
    }

    return availableSlots.sort();
  }

  // Fallback to default slots if no barber specified
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