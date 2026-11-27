import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { one } from "@/lib/utils";
import type { ReservaCuenta } from "@/components/cuenta/historial-reservas";
import type { PedidoCuenta } from "@/components/cuenta/historial-pedidos";
import { separarReservas } from "@/lib/reservas-cuenta";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Sesión de la petición, una sola consulta a Auth para el layout y la página. */
export const getSesionCuenta = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

/** Sesión de una sección de la cuenta; sin ella, al login volviendo a esa sección. */
export async function requireCuenta(ruta: string) {
  const { supabase, user } = await getSesionCuenta();
  if (!user) redirect(`/login?next=${encodeURIComponent(ruta)}`);
  return { supabase, user };
}

/** Invitaciones pendientes y vigentes dirigidas al correo de la cuenta. */
export async function getInvitaciones(supabase: SupabaseClient, correo: string | undefined) {
  // El filtro por correo es necesario: RLS también deja ver al admin (y al superadmin) las que envió
  const { data } = await supabase
    .from("invitacion")
    .select("id_invitacion, token, rol, expira_at, barberia:barberia!invitacion_id_barberia_fkey (nombre, slug)")
    .eq("correo", (correo ?? "").toLowerCase())
    .eq("estado", "pendiente")
    .gte("expira_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? []).map((inv) => ({ ...inv, barberia: one<{ nombre: string; slug: string }>(inv.barberia) }));
}

/** Reservas de la cuenta y las de invitado hechas con su correo (RPC mis_reservas, máx. 200), en próximas y anteriores. */
export async function getReservas(supabase: SupabaseClient) {
  // shortcut: mis_reservas caps at 200, paginate if a client ever gets close
  const { data, error } = await supabase.rpc("mis_reservas");
  if (error) console.error("[cuenta] reservas:", error);
  return separarReservas((data ?? []) as ReservaCuenta[], Date.now());
}

/** Compras de la cuenta, la más nueva primero; `enCurso`: pagadas y aún sin entregar ni cancelar. */
export async function getCompras(supabase: SupabaseClient, idUsuario: string, { limite = 100, enCurso = false } = {}) {
  // El filtro por cliente es necesario: al personal RLS también le muestra los pedidos de otros
  let query = supabase
    .from("pedido")
    .select(`
      id:id_pedido, created_at, monto_total, estado, estado_pago, tipo_entrega, direccion_envio,
      barberia:barberia!pedido_id_barberia_fkey (nombre),
      detalle_pedido!detalle_pedido_pedido_fkey (
        id:id_detalle, cantidad, subtotal,
        producto:producto!detalle_pedido_producto_fkey (nombre, precio, imagen_url)
      )
    `)
    .eq("id_cliente", idUsuario);
  // Un pago rechazado o abandonado deja el pedido pendiente: eso no es una compra en curso
  if (enCurso) query = query.eq("estado_pago", "pagado").not("estado", "in", "(entregado,cancelado)");
  const { data, error } = await query.order("id_pedido", { ascending: false }).limit(limite);
  if (error) console.error("[cuenta] pedidos:", error);
  return (data ?? []).map((o) => ({
    ...o,
    barberia: one<{ nombre: string }>(o.barberia)?.nombre ?? null,
    detalle_pedido: (o.detalle_pedido ?? []).map((d) => ({ ...d, producto: one(d.producto) })),
  })) as unknown as PedidoCuenta[];
}
