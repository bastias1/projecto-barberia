import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { getBarberiaBySlug, isSlugValido } from "./barberia";

/**
 * Barbería de la URL, cacheada por request para que el layout de /[slug] y
 * sus páginas no repitan la consulta. Solo para Server Components.
 */
export const getBarberiaCached = cache(async (slug: string) => {
  // Rutas como /favicon.png nunca son una barbería: se evita la consulta
  if (!isSlugValido(slug)) return null;
  return getBarberiaBySlug(await createClient(), slug);
});

/** Módulos vigentes según la suscripción (RPC modulos_barberia): agenda, ecommerce, bi. */
export const getModulosCached = cache(async (idBarberia: string): Promise<string[]> => {
  const { data, error } = await (await createClient()).rpc("modulos_barberia", { p_barberia: idBarberia });
  if (error) {
    console.error("Error fetching módulos:", error);
    return [];
  }
  return (data as string[]) ?? [];
});
