import { createClient } from "@/utils/supabase/client";
import { Database } from "../database.types";

export type Service = Database["public"]["Tables"]["servicio"]["Row"];

// Fetch all services
export async function getServices(): Promise<Service[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("servicio")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching services:", error);
    throw error;
  }

  return data || [];
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
