'use server'

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { getSuperadmin, registrarAccion } from "@/lib/superadmin";
import {
  activarCortesia as activarCortesiaSus, cambiarPlan as cambiarPlanSus, extenderVigencia as extenderVigenciaSus,
} from "@/lib/suscripcion";

type Resultado = { success: true } | { success: false; error: string };

const SIN_PERMISO: Resultado = { success: false, error: "Solo un administrador de la plataforma puede hacer esto" };

function refrescar(idBarberia?: string) {
  revalidatePath("/admin", "layout");
  if (idBarberia) revalidatePath("/[slug]", "layout");
}

// ------------------------------------------------------------------ barberías

/** Resultado del módulo → bitácora (`antes`/`despues` los arma `lib/suscripcion.ts`) y refresco. */
async function aplicarCambio(
  admin: NonNullable<Awaited<ReturnType<typeof getSuperadmin>>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  accion: string,
  idBarberia: string,
  r: Awaited<ReturnType<typeof extenderVigenciaSus>>,
): Promise<Resultado> {
  if (!r.ok) return { success: false, error: r.error };
  await registrarAccion(supabase, admin, accion, "barberia", idBarberia, { antes: r.antes, despues: r.despues });
  refrescar(idBarberia);
  return { success: true };
}

/** Nueva fecha de término (prueba o suscripción). Si estaba vencida o cancelada, vuelve a activa. */
export async function extenderVigencia(input: { idBarberia: string; fecha: string }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  const supabase = await createClient();
  return aplicarCambio(admin, supabase, "extender_vigencia", input.idBarberia, await extenderVigenciaSus(supabase, input.idBarberia, input.fecha));
}

/** Cambia el plan (y su precio pactado). El cobro de Mercado Pago no cambia hasta que el dueño vuelva a pagar. */
export async function cambiarPlan(input: { idBarberia: string; idPlan: number }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  const supabase = await createClient();
  return aplicarCambio(admin, supabase, "cambiar_plan", input.idBarberia, await cambiarPlanSus(supabase, input.idBarberia, input.idPlan));
}

/** Suscripción activa sin cobro (fecha opcional: sin fecha = indefinida). */
export async function activarCortesia(input: { idBarberia: string; fecha: string | null }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  const supabase = await createClient();
  return aplicarCambio(admin, supabase, "activar_cortesia", input.idBarberia, await activarCortesiaSus(supabase, input.idBarberia, input.fecha));
}

/** Suspender cierra la página y el dashboard de la barbería; reactivar los vuelve a abrir. */
export async function cambiarEstadoBarberia(input: { idBarberia: string; activa: boolean }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("barberia")
    .update({ activa: input.activa })
    .eq("id_barberia", input.idBarberia)
    .select("nombre")
    .maybeSingle();
  if (error || !data) return { success: false, error: error?.message ?? "Barbería no encontrada" };

  await registrarAccion(supabase, admin, input.activa ? "reactivar_barberia" : "suspender_barberia", "barberia", input.idBarberia, {
    nombre: data.nombre,
  });
  refrescar(input.idBarberia);
  return { success: true };
}

// ------------------------------------------------------------------ planes

export interface PlanInput {
  idPlan: number | null; // null = nuevo
  nombre: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  modulos: string[]; // códigos opcionales: ecommerce, bi
  limites: Record<string, number | null>; // null = sin límite
}

export async function guardarPlan(input: PlanInput): Promise<Resultado & { idPlan?: number }> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  const nombre = input.nombre.trim();
  if (!nombre) return { success: false, error: "El plan necesita un nombre" };
  if (!Number.isFinite(input.precio) || input.precio < 0) return { success: false, error: "Precio inválido" };

  const supabase = await createClient();
  const [{ data: modulos }, { data: tipos }] = await Promise.all([
    supabase.from("modulo").select("id_modulo, codigo, es_base"),
    supabase.from("tipo_limite").select("id_tipo_limite, codigo"),
  ]);

  const datos = { nombre, descripcion: input.descripcion.trim() || null, precio_mensual: Math.round(input.precio), activo: input.activo };
  const { data: plan, error } = input.idPlan
    ? await supabase.from("plan_suscripcion").update(datos).eq("id_plan", input.idPlan).select("id_plan").single()
    : await supabase.from("plan_suscripcion").insert(datos).select("id_plan").single();
  if (error || !plan) {
    return { success: false, error: error?.code === "23505" ? "Ya existe un plan con ese nombre" : error?.message ?? "No se pudo guardar el plan" };
  }

  // Módulos: los opcionales elegidos (agenda es base para todos los planes)
  const opcionales = (modulos ?? []).filter((m) => !m.es_base);
  await supabase.from("plan_modulo").delete().eq("id_plan", plan.id_plan).in("id_modulo", opcionales.map((m) => m.id_modulo));
  const elegidos = opcionales.filter((m) => input.modulos.includes(m.codigo));
  if (elegidos.length) {
    await supabase.from("plan_modulo").insert(elegidos.map((m) => ({ id_plan: plan.id_plan, id_modulo: m.id_modulo })));
  }

  // Límites: número = tope; null = sin límite (sin fila)
  for (const tipo of tipos ?? []) {
    if (!(tipo.codigo in input.limites)) continue;
    const valor = input.limites[tipo.codigo];
    if (valor === null) {
      await supabase.from("plan_limite").delete().eq("id_plan", plan.id_plan).eq("id_tipo_limite", tipo.id_tipo_limite);
    } else {
      await supabase
        .from("plan_limite")
        .upsert({ id_plan: plan.id_plan, id_tipo_limite: tipo.id_tipo_limite, valor: Math.max(0, Math.round(valor)) }, { onConflict: "id_plan,id_tipo_limite" });
    }
  }

  await registrarAccion(supabase, admin, input.idPlan ? "editar_plan" : "crear_plan", "plan", plan.id_plan, {
    nombre, precio: datos.precio_mensual, activo: input.activo, modulos: input.modulos, limites: input.limites,
  });
  revalidatePath("/", "layout"); // la portada muestra los planes
  return { success: true, idPlan: plan.id_plan };
}

// ------------------------------------------------------------------ usuarios

/** Dar o quitar rol de administrador de plataforma (usuario.rol no es editable por RLS: service role). */
export async function cambiarSuperadmin(input: { idUsuario: string; superadmin: boolean }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  if (input.idUsuario === admin.userId && !input.superadmin) {
    return { success: false, error: "No puedes quitarte tu propio rol" };
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("usuario")
    .update({ rol: input.superadmin ? "superadmin" : "usuario" })
    .eq("id_usuario", input.idUsuario)
    .select("email")
    .maybeSingle();
  if (error || !data) return { success: false, error: error?.message ?? "Usuario no encontrado" };

  await registrarAccion(await createClient(), admin, input.superadmin ? "dar_superadmin" : "quitar_superadmin", "usuario", input.idUsuario, {
    email: data.email,
  });
  refrescar();
  return { success: true };
}

/** Suspender bloquea el inicio de sesión (ban en Auth) y marca el perfil; reactivar lo revierte. */
export async function cambiarSuspensionUsuario(input: { idUsuario: string; suspender: boolean }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  if (input.idUsuario === admin.userId) return { success: false, error: "No puedes suspender tu propia cuenta" };

  const service = createServiceRoleClient();
  const { error: authError } = await service.auth.admin.updateUserById(input.idUsuario, {
    ban_duration: input.suspender ? "876000h" : "none",
  });
  if (authError) return { success: false, error: authError.message };

  const { data } = await service
    .from("usuario")
    .update({ deleted_at: input.suspender ? new Date().toISOString() : null })
    .eq("id_usuario", input.idUsuario)
    .select("email")
    .maybeSingle();

  await registrarAccion(await createClient(), admin, input.suspender ? "suspender_usuario" : "reactivar_usuario", "usuario", input.idUsuario, {
    email: data?.email,
  });
  refrescar();
  return { success: true };
}

/**
 * Ejecuta una solicitud de eliminación de datos ya aprobada (Ley 21.719, ver /eliminar-datos):
 * anonimiza la cuenta con ese correo, si existe, y sus registros como invitado en todas las barberías.
 * Reservas, pedidos y pagos se conservan sin datos de identificación.
 */
export async function eliminarDatosPersona(input: { correo: string }): Promise<Resultado> {
  const admin = await getSuperadmin();
  if (!admin) return SIN_PERMISO;
  const correo = input.correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return { success: false, error: "Correo inválido" };

  const supabase = await createClient();
  const [{ data: usuario }, { data: invitados }] = await Promise.all([
    supabase.from("usuario").select("id_usuario").eq("email", correo).maybeSingle(),
    // ilike sin comodines: el correo de invitado puede venir con mayúsculas
    supabase.from("guest_usuario").select("id_guest").ilike("correo", correo.replace(/[\%_]/g, "\$&")),
  ]);
  if (!usuario && !invitados?.length) return { success: false, error: "No hay datos asociados a ese correo" };
  if (usuario?.id_usuario === admin.userId) return { success: false, error: "No puedes eliminar los datos de tu propia cuenta desde aquí" };

  for (const g of invitados ?? []) {
    const { error } = await supabase.rpc("anonimizar_guest", { p_guest: g.id_guest });
    if (error) return { success: false, error: error.message };
  }

  if (usuario) {
    const { error } = await supabase.rpc("anonimizar_usuario", { p_usuario: usuario.id_usuario });
    if (error) return { success: false, error: error.message };

    // auth.users conserva correo, nombre y contraseña: se reemplazan y se bloquea el acceso
    const service = createServiceRoleClient();
    const { error: authError } = await service.auth.admin.updateUserById(usuario.id_usuario, {
      email: `eliminado-${usuario.id_usuario}@anon.invalid`,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { nombre: null, apellido: null },
      ban_duration: "876000h",
    });
    // Para reintentar, el correo ya anonimizado sigue encontrando la cuenta
    if (authError) {
      return { success: false, error: `Datos anonimizados, pero no se pudo cerrar la cuenta de acceso (${authError.message}). Reintenta con eliminado-${usuario.id_usuario}@anon.invalid` };
    }

    // Fotos de perfil: avatars/<id_usuario>-*
    const { data: fotos } = await service.storage.from("imgs").list("avatars", { search: usuario.id_usuario });
    const propias = (fotos ?? []).filter((f) => f.name.startsWith(`${usuario.id_usuario}-`));
    if (propias.length) await service.storage.from("imgs").remove(propias.map((f) => `avatars/${f.name}`));
  }

  // Sin el correo en el detalle: la bitácora no debe volver a guardar el dato eliminado
  await registrarAccion(supabase, admin, "eliminar_datos", "usuario", usuario?.id_usuario ?? "invitado", {
    cuenta: Boolean(usuario),
    registros_invitado: invitados?.length ?? 0,
  });
  refrescar();
  return { success: true };
}
