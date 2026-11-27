import type { SupabaseClient } from "@supabase/supabase-js";
import { notificarCambioReserva } from "./notifications";
import { eliminarSuscripcion, ultimaSuscripcion, type OpcionesSuscripcion } from "./suscripcion";
import type { ResultadoAccion } from "./utils";

const NO_PROPIETARIO = "Solo el propietario puede eliminar la barbería";
const PENDIENTES = "Tienes pedidos pagados sin entregar. Entrégalos o cancélalos antes de eliminar la barbería.";
const FALLO = "No se pudo eliminar la barbería";

/**
 * Borrado lógico de una barbería (RPC eliminar_barberia). `admin` es service role: quien llama ya
 * autenticó a `idUsuario`. El orden importa: primero se corta el cobro; si falla, no se toca nada.
 */
export async function eliminarBarberiaDe(
  admin: SupabaseClient,
  { idBarberia, idUsuario }: { idBarberia: string; idUsuario: string },
  opts?: OpcionesSuscripcion,
): Promise<ResultadoAccion> {
  const { data: barberia } = await admin.from("barberia").select("id_propietario, eliminada_at").eq("id_barberia", idBarberia).maybeSingle();
  if (!barberia || barberia.id_propietario !== idUsuario || barberia.eliminada_at) return { success: false, error: NO_PROPIETARIO };

  // La RPC lo vuelve a comprobar; aquí para no cancelar el cobro de una barbería que no se podrá eliminar
  const { count, error: errorPedidos } = await admin
    .from("pedido")
    .select("id_pedido", { count: "exact", head: true })
    .eq("id_barberia", idBarberia)
    .eq("estado_pago", "pagado")
    .not("estado", "in", "(entregado,cancelado)");
  if (errorPedidos) return { success: false, error: FALLO };
  if (count) return { success: false, error: PENDIENTES };

  const sus = await ultimaSuscripcion(admin, idBarberia);
  if (sus && (sus.id_suscripcion_externa || ["prueba", "activa"].includes(sus.estado))) {
    const cancelada = await eliminarSuscripcion(admin, idBarberia, opts);
    if (!cancelada.ok) return { success: false, error: cancelada.error };
  }

  const { error: errorMp } = await admin.rpc("mp_borrar", { p_barberia: idBarberia });
  if (errorMp) {
    console.error("[eliminar barbería] mp_borrar:", errorMp);
    return { success: false, error: FALLO };
  }

  const { data: citas, error } = await admin.rpc("eliminar_barberia", { p_barberia: idBarberia, p_usuario: idUsuario });
  if (error) {
    console.error("[eliminar barbería]", error);
    return { success: false, error: error.message === "PEDIDOS_PENDIENTES" ? PENDIENTES : FALLO };
  }

  for (const id of (citas ?? []) as number[]) {
    await notificarCambioReserva(id, "cancelada").catch((e) => console.error("[eliminar barbería] aviso de cita:", e));
  }
  return { success: true };
}
