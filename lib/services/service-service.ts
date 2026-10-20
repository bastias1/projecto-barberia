import { createClient } from "@/utils/supabase/client";

export interface Service {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  duracion: number;
  activo: boolean;
}

// Alias de columnas para mantener la forma que usa la UI
const SERVICE_COLUMNS = "id:id_servicio, nombre, descripcion, precio, duracion:duracion_min, activo";

// Fetch all services (for dashboard - includes archived)
export async function getServices(idBarberia: string): Promise<Service[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .select(SERVICE_COLUMNS)
    .eq("id_barberia", idBarberia)
    .order("id_servicio", { ascending: true });

  if (error) {
    console.error("Error fetching services:", error);
    throw error;
  }

  return (data as Service[]) || [];
}

// Fetch only active services (for public booking page)
export async function getActiveServices(idBarberia: string): Promise<Service[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .select(SERVICE_COLUMNS)
    .eq("id_barberia", idBarberia)
    .eq("activo", true)
    .order("id_servicio", { ascending: true });

  if (error) {
    console.error("Error fetching active services:", error);
    throw error;
  }

  return (data as Service[]) || [];
}

// Fetch services for a specific barber (only active services for booking)
export async function getServicesByBarber(idBarberia: string, barberoId: string): Promise<Service[]> {
  const supabase = createClient();

  const { data: barberServices, error: barberError } = await supabase
    .from("profesional_servicio")
    .select("id_servicio")
    .eq("id_barberia", idBarberia)
    .eq("id_profesional", barberoId);

  if (barberError) {
    console.error("Error fetching barber services:", barberError);
    throw barberError;
  }

  const serviceIds = barberServices?.map((bs) => bs.id_servicio) || [];
  if (serviceIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("servicio")
    .select(SERVICE_COLUMNS)
    .eq("id_barberia", idBarberia)
    .in("id_servicio", serviceIds)
    .eq("activo", true)
    .order("id_servicio", { ascending: true });

  if (error) {
    console.error("Error fetching services:", error);
    throw error;
  }

  return (data as Service[]) || [];
}

// Fetch a single service by ID
export async function getServiceById(id: number): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .select(SERVICE_COLUMNS)
    .eq("id_servicio", id)
    .single();

  if (error) {
    console.error("Error fetching service:", error);
    return null;
  }

  return data as Service;
}

// Create a new service (solo administradores, por RLS)
export async function createService(idBarberia: string, service: { nombre: string; precio: number; duracion: number }): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .insert({
      id_barberia: idBarberia,
      nombre: service.nombre,
      precio: service.precio,
      duracion_min: service.duracion,
    })
    .select(SERVICE_COLUMNS)
    .single();

  if (error) {
    console.error("Error creating service:", error);
    throw error;
  }

  return data as Service;
}

// Delete a service (will fail if has reservations)
export async function deleteService(id: number): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("servicio")
    .delete()
    .eq("id_servicio", id);

  if (error) {
    console.error("Error deleting service:", error.message, error.code);

    // Check for foreign key constraint violation
    if (error.code === '23503') {
      throw new Error('No se puede eliminar el servicio porque tiene reservas asociadas');
    }

    throw new Error(error.message || 'Error al eliminar el servicio');
  }

  return true;
}

async function setServiceActive(id: number, activo: boolean): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .update({ activo })
    .eq("id_servicio", id)
    .select(SERVICE_COLUMNS)
    .single();

  if (error) {
    console.error(`Error ${activo ? "restoring" : "archiving"} service:`, error.message);
    throw new Error(activo ? 'Error al restaurar el servicio' : 'Error al archivar el servicio');
  }

  return data as Service;
}

// Archive service (soft delete - keeps reservation history)
export async function archiveService(id: number): Promise<Service | null> {
  return setServiceActive(id, false);
}

// Restore archived service
export async function restoreService(id: number): Promise<Service | null> {
  return setServiceActive(id, true);
}

// Toggle a service for a barber (add or remove from profesional_servicio)
export async function toggleBarberService(idBarberia: string, barberId: string, serviceId: number, isSelected: boolean): Promise<boolean> {
  const supabase = createClient();

  if (isSelected) {
    const { error } = await supabase
      .from("profesional_servicio")
      .insert({ id_barberia: idBarberia, id_profesional: barberId, id_servicio: serviceId });

    if (error) {
      // Ignore duplicate key error if it already exists
      if (error.code === '23505') return true;
      console.error("Error adding service to barber:", error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("profesional_servicio")
      .delete()
      .eq("id_barberia", idBarberia)
      .eq("id_profesional", barberId)
      .eq("id_servicio", serviceId);

    if (error) {
      console.error("Error removing service from barber:", error);
      throw error;
    }
  }

  return true;
}
