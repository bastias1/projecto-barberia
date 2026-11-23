import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { suscribir } from "@/lib/suscripcion";

/**
 * Suscribe la barbería a un plan con la tarjeta tokenizada en
 * /[slug]/dashboard/suscripcion/pagar (preapproval autorizada, sin redirigir a
 * Mercado Pago). Se aplica al tiro; el webhook lo repite y registra los cobros.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  const { idPlan, token } = await request.json().catch(() => ({}));
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Faltan los datos de la tarjeta" }, { status: 400 });
  }

  const r = await suscribir(createServiceRoleClient(), { barberia: ctx.barberia, email: ctx.email, idPlan: Number(idPlan), token });
  return r.ok ? NextResponse.json({ estado: r.estado }) : NextResponse.json({ error: r.error }, { status: r.status });
}
