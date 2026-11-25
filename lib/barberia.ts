import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * La plataforma atiende a varias barberías; cada una vive en /<slug>.
 * Toda consulta de datos de una barbería filtra por su id_barberia.
 */

// Zona horaria por defecto si una sucursal no define la suya
export const DEFAULT_TZ = "America/Santiago";

export interface Barberia {
  id_barberia: string;
  slug: string;
  nombre: string;
  telefono: string | null;
  email_contacto: string | null;
  logo_url: string | null;
  logo_oscuro_url: string | null;
  eslogan: string | null;
  descripcion: string | null;
  instagram: string | null;
  galeria: string[];
  plazo_cancelacion_min: number; // HU-22: anticipación mínima para que el cliente cancele o reprograme
  apariencia: unknown; // se lee con leerApariencia (lib/apariencia.ts)
}

/** 120 -> "2 horas", 90 -> "90 minutos" */
export function formatPlazo(minutos: number): string {
  if (minutos % 60 !== 0) return `${minutos} minutos`;
  return minutos === 60 ? "1 hora" : `${minutos / 60} horas`;
}

export interface Sucursal {
  id_sucursal: number;
  slug: string; // su página es /<barberia>/<sucursal>
  nombre: string;
  direccion: string;
  comuna: string;
  region: string | null;
  telefono: string | null;
  zona_horaria: string;
}

const SUCURSAL_COLUMNS = "id_sucursal, slug, nombre, direccion, comuna, region, telefono, zona_horaria";

const BARBERIA_COLUMNS =
  "id_barberia, slug, nombre, telefono, email_contacto, logo_url, logo_oscuro_url, eslogan, descripcion, instagram, galeria, plazo_cancelacion_min, apariencia";

/** Barbería activa por slug (null si no existe o está inactiva: RLS solo muestra las activas). */
export async function getBarberiaBySlug(supabase: SupabaseClient, slug: string): Promise<Barberia | null> {
  const { data, error } = await supabase
    .from("barberia")
    .select(BARBERIA_COLUMNS)
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching barbería "${slug}":`, error);
    return null;
  }
  return data as Barberia | null;
}

export async function getBarberiaById(supabase: SupabaseClient, idBarberia: string): Promise<Barberia | null> {
  const { data, error } = await supabase
    .from("barberia")
    .select(BARBERIA_COLUMNS)
    .eq("id_barberia", idBarberia)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching barbería ${idBarberia}:`, error);
    return null;
  }
  return data as Barberia | null;
}

export async function getSucursales(supabase: SupabaseClient, idBarberia: string): Promise<Sucursal[]> {
  const { data, error } = await supabase
    .from("sucursal")
    .select(SUCURSAL_COLUMNS)
    .eq("id_barberia", idBarberia)
    .eq("activa", true)
    .order("id_sucursal", { ascending: true });

  if (error) {
    console.error("Error fetching sucursales:", error);
    return [];
  }
  return data || [];
}

/** Sucursal activa por su slug dentro de la barbería. */
export async function getSucursalBySlug(supabase: SupabaseClient, idBarberia: string, slug: string): Promise<Sucursal | null> {
  if (!isSlugValido(slug)) return null;
  const { data, error } = await supabase
    .from("sucursal")
    .select(SUCURSAL_COLUMNS)
    .eq("id_barberia", idBarberia)
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching sucursal "${slug}":`, error);
    return null;
  }
  return data as Sucursal | null;
}

/** Ids de los barberos asignados a una sucursal (profesional_sucursal, lectura pública). */
export async function getProfesionalesDeSucursal(supabase: SupabaseClient, idBarberia: string, idSucursal: number): Promise<string[]> {
  const { data, error } = await supabase
    .from("profesional_sucursal")
    .select("id_profesional")
    .eq("id_barberia", idBarberia)
    .eq("id_sucursal", idSucursal);

  if (error) {
    console.error("Error fetching barberos de la sucursal:", error);
    return [];
  }
  return (data ?? []).map((r) => r.id_profesional);
}

/** Sucursales activas a las que está asignado un barbero. */
export async function getSucursalesDelProfesional(supabase: SupabaseClient, idBarberia: string, idProfesional: string): Promise<Sucursal[]> {
  const [sucursales, { data }] = await Promise.all([
    getSucursales(supabase, idBarberia),
    supabase
      .from("profesional_sucursal")
      .select("id_sucursal")
      .eq("id_barberia", idBarberia)
      .eq("id_profesional", idProfesional),
  ]);
  const asignadas = new Set((data ?? []).map((r) => r.id_sucursal));
  return sucursales.filter((s) => asignadas.has(s.id_sucursal));
}

/** Slug válido como primer segmento de la URL (mismo formato que el CHECK de la base). */
export function isSlugValido(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
