import { createClient } from "@/utils/supabase/client";
import { getProfesionalesDeSucursal } from "@/lib/barberia";

export interface Barbero {
  id: string;
  nombre: string;
  especialidad: string | null;
  profile_image: string | null;
}

// Fetch active barbers (public: uses the profesionales_publicos RPC, which
// exposes only the visible name, photo and specialty). With idSucursal, only
// the barbers assigned to that sucursal.
export async function getBarberos(idBarberia: string, idSucursal?: number): Promise<Barbero[]> {
  const supabase = createClient();

  const [{ data, error }, asignados] = await Promise.all([
    supabase.rpc("profesionales_publicos", { p_barberia: idBarberia }),
    idSucursal ? getProfesionalesDeSucursal(supabase, idBarberia, idSucursal) : Promise.resolve(null),
  ]);

  if (error) {
    console.error("Error fetching barbers:", error.message);
    throw new Error(`Failed to fetch barbers: ${error.message}`);
  }

  type Row = { id_profesional: string; nombre_visible: string; profile_image: string | null; especialidad: string | null };
  return ((data || []) as Row[])
    .filter((p) => !asignados || asignados.includes(p.id_profesional))
    .map((p) => ({
      id: p.id_profesional,
      nombre: p.nombre_visible,
      especialidad: p.especialidad,
      profile_image: p.profile_image,
    }));
}
