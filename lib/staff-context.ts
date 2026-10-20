import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Barberia } from "./barberia";
import { getBarberiaCached } from "./barberia-server";
import { getRolApp, isAdminRol, isStaffRol, type RolApp } from "./roles";

export interface StaffContext {
  userId: string;
  email: string;
  barberia: Barberia;
  rol: RolApp;
  isStaff: boolean;
  isAdmin: boolean;
  /** Tiene ficha de profesional activa (agenda, servicios, horarios). */
  isProfesional: boolean;
  usuario: {
    nombre: string;
    apellido: string | null;
    email: string;
    telefono: string | null;
    profile_image: string | null;
  };
  profesional: { alias: string | null; especialidad: string | null } | null;
}

/**
 * Contexto del usuario autenticado en el dashboard de una barbería (por slug).
 * Cacheado por request para que layout y páginas no repitan las mismas consultas.
 * Devuelve null sin sesión o si la barbería no existe.
 */
export const getStaffContext = cache(async (slug: string): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const barberia = await getBarberiaCached(slug);
  if (!barberia) return null;

  const [rol, { data: usuario }, { data: profesional }] = await Promise.all([
    getRolApp(supabase, user.id, barberia.id_barberia),
    supabase
      .from("usuario")
      .select("nombre, apellido, email, telefono, profile_image")
      .eq("id_usuario", user.id)
      .maybeSingle(),
    supabase
      .from("profesional")
      .select("alias, especialidad, activo")
      .eq("id_barberia", barberia.id_barberia)
      .eq("id_profesional", user.id)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    email: user.email || "",
    barberia,
    rol,
    isStaff: isStaffRol(rol),
    isAdmin: isAdminRol(rol),
    isProfesional: !!profesional?.activo,
    usuario: usuario ?? {
      nombre: user.email?.split("@")[0] || "Usuario",
      apellido: null,
      email: user.email || "",
      telefono: null,
      profile_image: null,
    },
    profesional: profesional ? { alias: profesional.alias, especialidad: profesional.especialidad } : null,
  };
});

/**
 * Para páginas del dashboard: devuelve el contexto del personal o redirige
 * (login sin sesión, perfil si es cliente, dashboard si exige admin).
 */
export async function requireStaff(slug: string, { admin = false } = {}): Promise<StaffContext> {
  const barberia = await getBarberiaCached(slug);
  if (!barberia) notFound();

  const ctx = await getStaffContext(slug);
  if (!ctx) redirect(`/login?barberia=${slug}&next=/${slug}/dashboard`);
  if (!ctx.isStaff) redirect(`/${slug}/profile`);
  if (admin && !ctx.isAdmin) redirect(`/${slug}/dashboard`);
  return ctx;
}
