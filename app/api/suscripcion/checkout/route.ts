import { NextRequest, NextResponse } from "next/server";
import { PreApproval } from "mercadopago";
import { requireAdmin } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { mercadoPagoClient } from "@/lib/pagos";
import { aplicarPreapproval, referenciaSuscripcion, sincronizarCobros, urlPublicaMP } from "@/lib/suscripcion";
import { MONTO_MINIMO_SUSCRIPCION } from "@/lib/planes";

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
  if (Number(plan.precio_mensual) < MONTO_MINIMO_SUSCRIPCION) {
    return NextResponse.json({ error: `Mercado Pago no permite cobros menores a $${MONTO_MINIMO_SUSCRIPCION}` }, { status: 400 });
  }

  let preapproval;
  try {
    preapproval = await new PreApproval(mercadoPagoClient()).create({
      body: {
        reason: `Plan ${plan.nombre} · ${ctx.barberia.nombre}`,
        external_reference: referenciaSuscripcion(sus.id_suscripcion, plan.id_plan),
        // Con credenciales de prueba el pagador también debe ser un usuario de prueba
        payer_email: process.env.MERCADOPAGO_TEST_PAYER_EMAIL || ctx.email,
        card_token_id: token,
        back_url: `${urlPublicaMP()}/${ctx.barberia.slug}/dashboard/suscripcion`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: Number(plan.precio_mensual),
          currency_id: "CLP",
        },
        status: "authorized",
      },
    });
  } catch (error) {
    // Las preapprovals traen el motivo en `message` (tarjeta rechazada, datos inválidos…)
    console.error("Suscripción - error creando la preapproval:", error);
    // Tarjetas con CVV opcional (p. ej. la Mastercard de prueba de Chile): el token puede salir sin CVV
    const mensaje = error instanceof Error ? error.message : "";
    return NextResponse.json({
      error: /without cvv/i.test(mensaje)
        ? "Esta tarjeta no envió el código de seguridad, que es obligatorio para el cobro mensual. Recarga la página e ingrésalo, o usa otra tarjeta."
        : /token was used/i.test(mensaje)
          ? "La validación de la tarjeta expiró. Vuelve a intentar el pago."
          // CC_VAL_433: Mercado Pago no validó la tarjeta (las de débito se rechazan para cobros recurrentes)
          : /CC_VAL_433/i.test(mensaje)
            ? "Mercado Pago no pudo validar la tarjeta para el cobro mensual. Usa una tarjeta de crédito."
            : "Mercado Pago rechazó la tarjeta. Revisa los datos o usa otra tarjeta.",
    }, { status: 402 });
  }

  if (preapproval.status !== "authorized") {
    console.error(`Suscripción - preapproval ${preapproval.id} quedó en estado ${preapproval.status}`);
    return NextResponse.json({ error: "Mercado Pago no autorizó el cobro con esta tarjeta. Usa otra tarjeta." }, { status: 402 });
  }

  // Activa el plan y, si es un cambio, cancela la preapproval anterior
  await aplicarPreapproval(supabase, preapproval);
  // El primer cobro se genera al crearla: se registra sin esperar al webhook
  if (preapproval.id) await sincronizarCobros(supabase, preapproval.id);
  return NextResponse.json({ estado: preapproval.status });
}
