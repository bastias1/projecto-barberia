import { NextRequest, NextResponse } from "next/server";
import { PreApproval } from "mercadopago";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { mercadoPagoClient } from "@/lib/suscripcion";

/** Detiene la renovación automática; la suscripción sigue vigente hasta su fecha de término. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;

  const supabase = createServiceRoleClient();
  const { data: sus } = await supabase
    .from("suscripcion")
    .select("id_suscripcion, id_suscripcion_externa")
    .eq("id_barberia", auth.ctx.barberia.id_barberia)
    .not("id_suscripcion_externa", "is", null)
    .order("id_suscripcion", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sus?.id_suscripcion_externa) {
    return NextResponse.json({ error: "No hay un cobro automático activo" }, { status: 404 });
  }

  try {
    await new PreApproval(mercadoPagoClient()).update({ id: sus.id_suscripcion_externa, body: { status: "cancelled" } });
  } catch (error) {
    console.error("Suscripción - error cancelando la preapproval:", error);
    return NextResponse.json({ error: "Mercado Pago no pudo cancelar el cobro. Intenta nuevamente." }, { status: 502 });
  }

  await supabase.from("suscripcion").update({ id_suscripcion_externa: null }).eq("id_suscripcion", sus.id_suscripcion);
  return NextResponse.json({ success: true });
}
