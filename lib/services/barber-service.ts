import { createClient } from "@/utils/supabase/client";
import { Database } from "../database.types";

export type Barbero = Database["public"]["Tables"]["barbero"]["Row"];

export interface BarberoWithServices extends Barbero {
  servicios?: number[];
}

// Fetch all barbers
export async function getBarberos(): Promise<Barbero[]> {
  try {
    const supabase = createClient();

    console.log("Fetching barbers from Supabase...");

    const { data, error } = await supabase
      .from("barbero")
      .select("*, usuario(profile_image)")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error fetching barbers:", error);
      throw error;
    }

    console.log("Barbers fetched successfully:", data);
    return data || [];
  } catch (error) {
    console.error("Exception in getBarberos:", error);
    throw error;
  }
}

// Fetch services for a specific barber
export async function getBarberServices(barberoId: string): Promise<number[]> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("barbero_servicio")
      .select("servicio")
      .eq("barbero", barberoId);

    if (error) {
      console.error("Error fetching barber services:", error);
      throw error;
    }

    return data?.map(item => item.servicio) || [];
  } catch (error) {
    console.error("Exception in getBarberServices:", error);
    throw error;
  }
}

// Fetch barber by ID
export async function getBarberoById(id: string): Promise<Barbero | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("barbero")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching barber:", error);
    return null;
  }

  return data;
}
