'use server'

import { createClient } from "@/utils/supabase/server";
import { DEFAULT_TZ, isSlugValido } from "@/lib/barberia";
import { VERSION_POLITICA } from "@/lib/plataforma";
import { notificarBarberiaRegistrada } from "@/lib/notifications";

export interface RegistrarBarberiaInput {
  nombre: string;
  slug: string;
  idPlan: number;
  sucursal: string;
  direccion: string;
  comuna: string;
  aceptaTerminos: boolean;
}

export type RegistrarBarberiaResult =
  | { success: true; slug: string }
  | { success: false; error: string };

/**
 * Crea la barbería (RPC registrar_barberia): suscripción en prueba, el usuario
 * como admin y la primera sucursal, todo en una transacción.
 */
export async function registrarBarberia(input: RegistrarBarberiaInput): Promise<RegistrarBarberiaResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión para registrar tu barbería" };
  }

  if (input.aceptaTerminos !== true) {
    return { success: false, error: "Debes aceptar los términos de servicio y la política de privacidad" };
  }

  const nombre = input.nombre.trim();
  const slug = input.slug.trim().toLowerCase();
  const sucursal = input.sucursal.trim() || "Casa matriz";
  const direccion = input.direccion.trim();
  const comuna = input.comuna.trim();

  if (!nombre || !direccion || !comuna) {
    return { success: false, error: "Completa el nombre, la dirección y la comuna" };
  }
  if (!isSlugValido(slug) || slug.length < 3 || slug.length > 40) {
    return { success: false, error: "La dirección web debe tener entre 3 y 40 letras minúsculas, números o guiones" };
  }

  const { error } = await supabase.rpc("registrar_barberia", {
    p_nombre: nombre,
    p_slug: slug,
    p_id_plan: input.idPlan,
    p_sucursal: sucursal,
    p_direccion: direccion,
    p_comuna: comuna,
    p_zona_horaria: DEFAULT_TZ,
  });

  if (error) {
    console.error("Error registering barbería:", error);
    if (error.code === "23503") {
      return { success: false, error: "Tu cuenta no está lista. Cierra sesión y vuelve a entrar." };
    }
    if (error.code === "23505") {
      return { success: false, error: "Esa dirección web ya está en uso. Prueba con otra." };
    }
    if (error.code === "23514" && error.message.includes("slug")) {
      return { success: false, error: "Esa dirección web no está disponible. Prueba con otra." };
    }
    if (error.code === "23514" || error.code === "42501") {
      return { success: false, error: error.message };
    }
    return { success: false, error: "No se pudo registrar la barbería" };
  }

  // Prueba de que aceptó los términos al contratar (la política RLS solo deja insertar los propios)
  const { error: errorConsentimiento } = await supabase.from("consentimiento").insert({
    id_usuario: user.id,
    tipo: "terminos",
    version_politica: VERSION_POLITICA,
    aceptado: true,
  });
  if (errorConsentimiento) console.error("Error saving consentimiento:", errorConsentimiento);

  if (user.email) await notificarBarberiaRegistrada(user.email, nombre, slug).catch((e) => console.error("[registro] correo de bienvenida:", e));

  return { success: true, slug };
}
