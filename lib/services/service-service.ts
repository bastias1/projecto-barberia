import { createClient } from "@/utils/supabase/client";
import { Database } from "../database.types";

export type Service = Database["public"]["Tables"]["servicio"]["Row"] & {
  activo?: boolean;
};

// Fetch all services (for dashboard - includes archived)
export async function getServices(): Promise<Service[]> {
  try {
    const supabase = createClient();

    const { data: servicio, error } = await supabase
      .from("servicio")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
      throw error;
    }

    return servicio || [];
  } catch (error) {
    console.error("Exception in getServices:", error);
    throw error;
  }
}

// Fetch only active services (for public booking page)
export async function getActiveServices(): Promise<Service[]> {
  try {
    const supabase = createClient();

    const { data: servicio, error } = await supabase
      .from("servicio")
      .select("*")
      .neq("activo", false) // Include services where activo is true or null (for backwards compatibility)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching active services:", error);
      throw error;
    }

    return servicio || [];
  } catch (error) {
    console.error("Exception in getActiveServices:", error);
    throw error;
  }
}

// Fetch services for a specific barber (only active services for booking)
export async function getServicesByBarber(barberoId: string): Promise<Service[]> {
  try {
    const supabase = createClient();

    // Get service IDs for this barber
    const { data: barberServices, error: barberError } = await supabase
      .from("barbero_servicio")
      .select("servicio")
      .eq("barbero", barberoId);

    if (barberError) {
      console.error("Error fetching barber services:", barberError);
      throw barberError;
    }

    const serviceIds = barberServices?.map(bs => bs.servicio) || [];

    if (serviceIds.length === 0) {
      return [];
    }

    // Fetch the actual service details (only active services)
    const { data: servicio, error } = await supabase
      .from("servicio")
      .select("*")
      .in("id", serviceIds)
      .neq("activo", false) // Only active services
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
      throw error;
    }

    return servicio || [];
  } catch (error) {
    console.error("Exception in getServicesByBarber:", error);
    throw error;
  }
}

// Fetch a single service by ID
export async function getServiceById(id: number): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching service:", error);
    return null;
  }

  return data;
}

// Create a new service
export async function createService(service: { nombre: string; precio: number; duracion: number }): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .insert(service)
    .select()
    .single();

  if (error) {
    console.error("Error creating service:", error);
    throw error;
  }

  return data;
}

// Delete a service (will fail if has reservations)
export async function deleteService(id: number): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from("servicio")
    .delete()
    .eq("id", id);

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

// Archive service (soft delete - keeps reservation history)
export async function archiveService(id: number): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .update({ activo: false })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error archiving service:", error.message);
    throw new Error('Error al archivar el servicio');
  }

  return data;
}

// Restore archived service
export async function restoreService(id: number): Promise<Service | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("servicio")
    .update({ activo: true })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error restoring service:", error.message);
    throw new Error('Error al restaurar el servicio');
  }

  return data;
}

// Toggle a service for a barber (add or remove from barbero_servicio)
export async function toggleBarberService(barberId: string, serviceId: number, isSelected: boolean): Promise<boolean> {
  const supabase = createClient();

  if (isSelected) {
    // Add connection
    const { error } = await supabase
      .from("barbero_servicio")
      .insert({ barbero: barberId, servicio: serviceId });

    if (error) {
      // Ignore duplicate key error if it already exists
      if (error.code === '23505') return true;
      console.error("Error adding service to barber:", error);
      throw error;
    }
  } else {
    // Remove connection
    const { error } = await supabase
      .from("barbero_servicio")
      .delete()
      .eq("barbero", barberId)
      .eq("servicio", serviceId);

    if (error) {
      console.error("Error removing service from barber:", error);
      throw error;
    }
  }

  return true;
}
