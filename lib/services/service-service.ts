import { createClient } from "@/utils/supabase/client";
import { Database } from "../database.types";

export type Service = Database["public"]["Tables"]["servicio"]["Row"];

// Fetch all services
export async function getServices(): Promise<Service[]> {
  try {
    const supabase = createClient();
    
    console.log("Fetching services from Supabase...");
    
    const { data: servicio, error } = await supabase
      .from("servicio")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
      throw error;
    }

    console.log("Services fetched successfully:", servicio);
    return servicio || [];
  } catch (error) {
    console.error("Exception in getServices:", error);
    throw error;
  }
}

// Fetch services for a specific barber
export async function getServicesByBarber(barberoId: string): Promise<Service[]> {
  try {
    const supabase = createClient();
    
    console.log("Fetching services for barber:", barberoId);
    
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
      console.log("No services found for this barber");
      return [];
    }

    // Fetch the actual service details
    const { data: servicio, error } = await supabase
      .from("servicio")
      .select("*")
      .in("id", serviceIds)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching services:", error);
      throw error;
    }

    console.log("Services fetched for barber:", servicio);
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
