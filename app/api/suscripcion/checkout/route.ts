import { NextRequest, NextResponse } from "next/server";
import { PreApproval } from "mercadopago";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { mercadoPagoClient, referenciaSuscripcion, urlPublicaMP } from "@/lib/suscripcion";

/**
 * Inicia el pago mensual de un plan con Mercado Pago (preapproval). El estado
 * de la suscripción lo cambia el webhook cuando el dueño autoriza el cobro.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  const { idPlan } = await request.json().catch(() => ({}));
  const supabase = createServiceRoleClient();

  const [{ data: plan }, { data: sus }] = await Promise.all([
    supabase.from("plan_suscripcion").select("id_plan, nombre, precio_mensual").eq("id_plan", Number(idPlan)).eq("activo", true).maybeSingle(),
    supabase
      .from("suscripcion")
      .select("id_suscripcion, id_plan, estado, id_suscripcion_externa")
      .eq("id_barberia", ctx.barberia.id_barberia)
      .order("id_suscripcion", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!plan) return NextResponse.json({ error: "Elige un plan válido" }, { status: 400 });
  if (!sus) return NextResponse.json({ error: "La barbería no tiene una suscripción registrada" }, { status: 404 });
  if (sus.estado === "activa" && sus.id_suscripcion_externa && sus.id_plan === plan.id_plan) {
    return NextResponse.json({ error: `Ya estás pagando el plan ${plan.nombre}` }, { status: 409 });
  }

  try {
    const preapproval = await new PreApproval(mercadoPagoClient()).create({
      body: {
        reason: `Plan ${plan.nombre} · ${ctx.barberia.nombre}`,
        external_reference: referenciaSuscripcion(sus.id_suscripcion, plan.id_plan),
        payer_email: ctx.email,
        back_url: `${urlPublicaMP()}/${ctx.barberia.slug}/dashboard/suscripcion?pago=retorno`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: Number(plan.precio_mensual),
          currency_id: "CLP",
        },
        status: "pending",
      },
    });

    if (!preapproval.init_point) throw new Error("Mercado Pago no devolvió el link de pago");
    return NextResponse.json({ url: preapproval.init_point });
  } catch (error) {
    console.error("Suscripción - error creando la preapproval:", error);
    return NextResponse.json({ error: "No se pudo iniciar el pago con Mercado Pago. Intenta nuevamente." }, { status: 502 });
  }
}
