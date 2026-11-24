import { NextRequest } from "next/server";
import { getStaffContext } from "@/lib/staff-context";
import { canjearCodigo, guardarTokens, leerState, nombreDeCuenta } from "@/lib/mercadopago-oauth";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { volverABarberia } from "../volver";

/** Vuelta de Mercado Pago: guarda los tokens en Vault y crea el vínculo `barberia_mercadopago`. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = leerState(params.get("state"));
  if (!state) return volverABarberia(request, null, "error");
  const { userId, slug } = state;

  const code = params.get("code"); // sin code = el vendedor canceló en Mercado Pago
  // La sesión debe ser la misma que pidió el vínculo: el state solo no basta si alguien comparte el link
  const ctx = await getStaffContext(slug);
  if (!code || !ctx || ctx.userId !== userId || !ctx.isAdmin) return volverABarberia(request, slug, "error");

  try {
    const tokens = await canjearCodigo(code);
    const admin = createServiceRoleClient();
    // Antes de tocar Vault: guardar los tokens pisaría el vínculo actual de esta barbería
    const { data: duena } = await admin.from("barberia_mercadopago").select("id_barberia").eq("mp_user_id", tokens.userId).maybeSingle();
    if (duena && duena.id_barberia !== ctx.barberia.id_barberia) return volverABarberia(request, slug, "en-uso");

    const idSecreto = await guardarTokens(admin, ctx.barberia.id_barberia, tokens);
    const { error } = await admin.from("barberia_mercadopago").upsert({
      id_barberia: ctx.barberia.id_barberia,
      mp_user_id: tokens.userId,
      cuenta: await nombreDeCuenta(tokens.accessToken),
      id_secreto: idSecreto,
      expira_at: tokens.expiraAt.toISOString(),
      estado: "conectada",
      conectado_at: new Date().toISOString(),
      ultimo_error: null,
    });
    // 23505: otra barbería vinculó la misma cuenta entre la consulta y el upsert. Los tokens guardados ya
    // no son los del vínculo anterior, así que se borra todo en vez de dejar un vínculo que cobraría a otra cuenta.
    // shortcut: la consulta previa no es atómica; si esta carrera llega a importar, mover el vínculo a una RPC.
    if (error?.code === "23505") {
      await admin.rpc("mp_borrar", { p_barberia: ctx.barberia.id_barberia });
      return volverABarberia(request, slug, "en-uso");
    }
    if (error) throw error;
    return volverABarberia(request, slug, "ok");
  } catch (error) {
    console.error("Mercado Pago - error al vincular:", error);
    return volverABarberia(request, slug, "error");
  }
}
